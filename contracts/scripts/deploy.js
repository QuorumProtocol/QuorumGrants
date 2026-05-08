const { ethers } = require("hardhat");

async function main() {
  const QuorumGrants = await ethers.getContractFactory("QuorumGrants");
  const contract = await QuorumGrants.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("QuorumGrants deployed to:", address);

  // Write address to a file the backend/frontend can read
  const fs = require("fs");
  const out = { address, network: hre.network.name };
  fs.writeFileSync("../backend/src/contract-address.json", JSON.stringify(out, null, 2));
  console.log("Address written to backend/src/contract-address.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
