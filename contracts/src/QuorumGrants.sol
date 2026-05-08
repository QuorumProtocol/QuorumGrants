// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title QuorumGrants
/// @notice Quorum-based grant funding: a configurable set of reviewers must approve before funds release.
contract QuorumGrants {
    struct Grant {
        address proposer;
        address payable recipient;
        uint256 amount;
        string description;
        address[] reviewers;   // quorum set
        uint256 quorumThreshold; // how many approvals needed
        uint256 approvalCount;
        bool executed;
        bool cancelled;
        mapping(address => bool) approved;
    }

    uint256 public grantCount;
    mapping(uint256 => Grant) private grants;

    event GrantCreated(uint256 indexed id, address proposer, address recipient, uint256 amount, uint256 threshold);
    event Approved(uint256 indexed id, address reviewer);
    event GrantExecuted(uint256 indexed id, address recipient, uint256 amount);
    event GrantCancelled(uint256 indexed id);

    modifier onlyReviewer(uint256 id) {
        require(_isReviewer(id, msg.sender), "Not a reviewer");
        _;
    }

    modifier onlyProposer(uint256 id) {
        require(grants[id].proposer == msg.sender, "Not proposer");
        _;
    }

    modifier active(uint256 id) {
        require(!grants[id].executed && !grants[id].cancelled, "Grant not active");
        _;
    }

    /// @notice Create a grant. Caller sends the grant funds with the transaction.
    function createGrant(
        address payable recipient,
        string calldata description,
        address[] calldata reviewers,
        uint256 quorumThreshold
    ) external payable returns (uint256 id) {
        require(msg.value > 0, "Must fund grant");
        require(reviewers.length > 0, "Need reviewers");
        require(quorumThreshold > 0 && quorumThreshold <= reviewers.length, "Invalid threshold");

        id = grantCount++;
        Grant storage g = grants[id];
        g.proposer = msg.sender;
        g.recipient = recipient;
        g.amount = msg.value;
        g.description = description;
        g.reviewers = reviewers;
        g.quorumThreshold = quorumThreshold;

        emit GrantCreated(id, msg.sender, recipient, msg.value, quorumThreshold);
    }

    /// @notice A reviewer approves a grant. Executes automatically when quorum is reached.
    function approve(uint256 id) external onlyReviewer(id) active(id) {
        Grant storage g = grants[id];
        require(!g.approved[msg.sender], "Already approved");

        g.approved[msg.sender] = true;
        g.approvalCount++;

        emit Approved(id, msg.sender);

        if (g.approvalCount >= g.quorumThreshold) {
            _execute(id);
        }
    }

    /// @notice Proposer can cancel a grant before execution to reclaim funds.
    function cancel(uint256 id) external onlyProposer(id) active(id) {
        grants[id].cancelled = true;
        uint256 amount = grants[id].amount;
        grants[id].amount = 0;
        payable(msg.sender).transfer(amount);
        emit GrantCancelled(id);
    }

    function _execute(uint256 id) internal {
        Grant storage g = grants[id];
        g.executed = true;
        uint256 amount = g.amount;
        g.amount = 0;
        g.recipient.transfer(amount);
        emit GrantExecuted(id, g.recipient, amount);
    }

    function _isReviewer(uint256 id, address addr) internal view returns (bool) {
        address[] storage reviewers = grants[id].reviewers;
        for (uint256 i = 0; i < reviewers.length; i++) {
            if (reviewers[i] == addr) return true;
        }
        return false;
    }

    // --- View functions ---

    function getGrant(uint256 id) external view returns (
        address proposer,
        address recipient,
        uint256 amount,
        string memory description,
        address[] memory reviewers,
        uint256 quorumThreshold,
        uint256 approvalCount,
        bool executed,
        bool cancelled
    ) {
        Grant storage g = grants[id];
        return (
            g.proposer, g.recipient, g.amount, g.description,
            g.reviewers, g.quorumThreshold, g.approvalCount,
            g.executed, g.cancelled
        );
    }

    function hasApproved(uint256 id, address reviewer) external view returns (bool) {
        return grants[id].approved[reviewer];
    }
}
