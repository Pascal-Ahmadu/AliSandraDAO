const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy AliSandraToken with an initial supply of 9,000,000 tokens (18 decimals)
  const initialSupply = ethers.parseEther("9000000"); // 9,000,000 AST
  const AliSandraToken = await ethers.getContractFactory("AliSandraToken");
  const token = await AliSandraToken.deploy(initialSupply);
  // Remove the .deployed() call and wait for deployment to complete
  await token.waitForDeployment();
  console.log("AliSandraToken deployed to:", await token.getAddress());

  // Deploy AliSandraDAO, passing in the token's address
  const AliSandraDAO = await ethers.getContractFactory("AliSandraDAO");
  const dao = await AliSandraDAO.deploy(await token.getAddress());
  // Remove the .deployed() call and wait for deployment to complete
  await dao.waitForDeployment();
  console.log("AliSandraDAO deployed to:", await dao.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });