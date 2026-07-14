const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("QuorumGrants", function () {
  let contract, proposer, recipient, r1, r2, r3, other;

  beforeEach(async () => {
    [proposer, recipient, r1, r2, r3, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("QuorumGrants");
    contract = await Factory.deploy();
  });

  async function createGrant(threshold = 2) {
    const tx = await contract.connect(proposer).createGrant(
      recipient.address,
      "Build public goods tooling",
      [r1.address, r2.address, r3.address],
      threshold,
      { value: ethers.parseEther("1") }
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (l) => contract.interface.parseLog(l)?.name === "GrantCreated"
    );
    return contract.interface.parseLog(event).args.id;
  }

  it("creates a grant and stores it correctly", async () => {
    const id = await createGrant();
    const g = await contract.getGrant(id);
    expect(g.proposer).to.equal(proposer.address);
    expect(g.recipient).to.equal(recipient.address);
    expect(g.amount).to.equal(ethers.parseEther("1"));
    expect(g.quorumThreshold).to.equal(2n);
    expect(g.executed).to.be.false;
  });

  it("executes when quorum is reached", async () => {
    const id = await createGrant(2);
    const before = await ethers.provider.getBalance(recipient.address);

    await contract.connect(r1).approve(id);
    await contract.connect(r2).approve(id); // quorum hit → auto-execute

    const g = await contract.getGrant(id);
    expect(g.executed).to.be.true;
    expect(g.amount).to.equal(0n);

    const after = await ethers.provider.getBalance(recipient.address);
    expect(after - before).to.equal(ethers.parseEther("1"));
  });

  it("does not execute before quorum", async () => {
    const id = await createGrant(2);
    await contract.connect(r1).approve(id);
    const g = await contract.getGrant(id);
    expect(g.executed).to.be.false;
    expect(g.approvalCount).to.equal(1n);
  });

  it("prevents double approval", async () => {
    const id = await createGrant(3);
    await contract.connect(r1).approve(id);
    await expect(contract.connect(r1).approve(id)).to.be.revertedWith("Already approved");
  });

  it("prevents non-reviewer from approving", async () => {
    const id = await createGrant();
    await expect(contract.connect(other).approve(id)).to.be.revertedWith("Not a reviewer");
  });

  it("allows proposer to cancel and reclaims funds", async () => {
    const id = await createGrant();
    const before = await ethers.provider.getBalance(proposer.address);
    const tx = await contract.connect(proposer).cancel(id);
    const receipt = await tx.wait();
    const gas = receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(proposer.address);

    expect(after + gas - before).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.001"));
    const g = await contract.getGrant(id);
    expect(g.cancelled).to.be.true;
  });

  it("prevents approval after cancellation", async () => {
    const id = await createGrant();
    await contract.connect(proposer).cancel(id);
    await expect(contract.connect(r1).approve(id)).to.be.revertedWith("Grant not active");
  });

  it("tracks hasApproved correctly", async () => {
    const id = await createGrant(3);
    expect(await contract.hasApproved(id, r1.address)).to.be.false;
    await contract.connect(r1).approve(id);
    expect(await contract.hasApproved(id, r1.address)).to.be.true;
  });

  it("requires funding on creation", async () => {
    await expect(
      contract.connect(proposer).createGrant(recipient.address, "test", [r1.address], 1, { value: 0 })
    ).to.be.revertedWith("Must fund grant");
  });

  it("rejects invalid quorum threshold", async () => {
    await expect(
      contract.connect(proposer).createGrant(
        recipient.address, "test", [r1.address, r2.address], 3,
        { value: ethers.parseEther("1") }
      )
    ).to.be.revertedWith("Invalid threshold");
  });

  it("rejects a zero-address recipient", async () => {
    await expect(
      contract.connect(proposer).createGrant(
        ethers.ZeroAddress, "test", [r1.address, r2.address], 1,
        { value: ethers.parseEther("1") }
      )
    ).to.be.revertedWith("Invalid recipient");
  });

  it("rejects a zero-address reviewer", async () => {
    await expect(
      contract.connect(proposer).createGrant(
        recipient.address, "test", [r1.address, ethers.ZeroAddress], 1,
        { value: ethers.parseEther("1") }
      )
    ).to.be.revertedWith("Invalid reviewer");
  });

  it("rejects duplicate reviewers", async () => {
    await expect(
      contract.connect(proposer).createGrant(
        recipient.address, "test", [r1.address, r2.address, r1.address], 2,
        { value: ethers.parseEther("1") }
      )
    ).to.be.revertedWith("Duplicate reviewer");
  });

  it("reverts on getGrant for a non-existent id", async () => {
    await expect(contract.getGrant(0)).to.be.revertedWith("Grant does not exist");
  });

  it("reverts on hasApproved for a non-existent id", async () => {
    await expect(contract.hasApproved(0, r1.address)).to.be.revertedWith("Grant does not exist");
  });

  it("reverts on approve for a non-existent id", async () => {
    await expect(contract.connect(r1).approve(0)).to.be.revertedWith("Grant does not exist");
  });

  it("reverts on cancel for a non-existent id", async () => {
    await expect(contract.connect(proposer).cancel(0)).to.be.revertedWith("Grant does not exist");
  });

  it("prevents approval after execution", async () => {
    const id = await createGrant(2);
    await contract.connect(r1).approve(id);
    await contract.connect(r2).approve(id); // executes
    await expect(contract.connect(r3).approve(id)).to.be.revertedWith("Grant not active");
  });

  it("prevents cancellation after execution", async () => {
    const id = await createGrant(2);
    await contract.connect(r1).approve(id);
    await contract.connect(r2).approve(id); // executes
    await expect(contract.connect(proposer).cancel(id)).to.be.revertedWith("Grant not active");
  });

  it("indexes grant ids by reviewer", async () => {
    const idA = await createGrant(2);
    const idB = await createGrant(3);
    const r1Ids = await contract.getGrantIdsByReviewer(r1.address);
    expect(r1Ids.map((n) => Number(n))).to.deep.equal([Number(idA), Number(idB)]);
  });

  it("indexes grant ids by proposer", async () => {
    const idA = await createGrant(2);
    const idB = await createGrant(3);
    const proposerIds = await contract.getGrantIdsByProposer(proposer.address);
    expect(proposerIds.map((n) => Number(n))).to.deep.equal([Number(idA), Number(idB)]);
  });

  it("returns an empty array for an address with no grants", async () => {
    const ids = await contract.getGrantIdsByReviewer(other.address);
    expect(ids).to.deep.equal([]);
  });
});
