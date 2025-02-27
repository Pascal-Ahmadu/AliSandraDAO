const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AliSandraDAO", function () {
  let token, dao, dummyTarget;
  let deployer, addr1, addr2, addr3;
  const initialSupply = ethers.utils.parseEther("9000000");

  beforeEach(async function () {
    [deployer, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

    // Deploy AliSandraToken
    const AliSandraToken = await ethers.getContractFactory("AliSandraToken");
    token = await AliSandraToken.deploy(initialSupply);
    await token.deployed();

    // Distribute tokens to simulate different weights
    await token.transfer(addr1.address, ethers.utils.parseEther("100"));
    await token.transfer(addr2.address, ethers.utils.parseEther("200"));
    await token.transfer(addr3.address, ethers.utils.parseEther("300"));

    // Deploy DummyTarget contract
    const DummyTarget = await ethers.getContractFactory("DummyTarget");
    dummyTarget = await DummyTarget.deploy();
    await dummyTarget.deployed();

    // Deploy AliSandraDAO contract with the token's address
    const AliSandraDAO = await ethers.getContractFactory("AliSandraDAO");
    dao = await AliSandraDAO.deploy(token.address);
    await dao.deployed();
  });

  it("should create a proposal correctly", async () => {
    const callData = dummyTarget.interface.encodeFunctionData("setValue", [42]);
    const tx = await dao.createProposal("Test proposal", dummyTarget.address, callData);
    await tx.wait();
    const proposalId = 0;

    const proposal = await dao.proposals(proposalId);
    expect(proposal.description).to.equal("Test proposal");
    expect(proposal.target).to.equal(dummyTarget.address);
    expect(proposal.executed).to.equal(false);
    // Instead of checking deadline equals false, ensure it's a nonzero number.
    expect(proposal.deadline).to.be.gt(0);
    expect(proposal.executionTime).to.be.gt(proposal.deadline);
    expect(proposal.snapshotId).to.gt(0);
  });

  it("should allow weighted voting and tally correctly", async function () {
    const callData = dummyTarget.interface.encodeFunctionData("setValue", [42]);
    await dao.createProposal("Weighted Voting", dummyTarget.address, callData);
    const proposalId = 0;

    // addr1 votes YES (weight = 100 tokens)
    await dao.connect(addr1).vote(proposalId, true);
    // addr2 votes YES (weight = 200 tokens)
    await dao.connect(addr2).vote(proposalId, true);
    // addr3 votes NO (weight = 300 tokens)
    await dao.connect(addr3).vote(proposalId, false);

    const proposal = await dao.proposals(proposalId);
    expect(proposal.yesVotes).to.equal(ethers.utils.parseEther("300")); // 100 + 200 tokens
    expect(proposal.noVotes).to.equal(ethers.utils.parseEther("300"));  // 300 tokens
  });

  it("should not allow execution before timelock expires", async function () {
    const callData = dummyTarget.interface.encodeFunctionData("setValue", [42]);
    await dao.createProposal("Timelock Test", dummyTarget.address, callData);
    const proposalId = 0;

    // addr1 and addr2 vote YES to pass quorum
    await dao.connect(addr1).vote(proposalId, true);
    await dao.connect(addr2).vote(proposalId, true);

    // Try to execute immediately (timelock not passed)
    await expect(dao.executeProposal(proposalId)).to.be.revertedWith("Timelock not passed");
  });

  it("should execute proposal after timelock if conditions met", async function () {
    const callData = dummyTarget.interface.encodeFunctionData("setValue", [42]);
    await dao.createProposal("Execution Test", dummyTarget.address, callData);
    const proposalId = 0;

    // Cast votes so that yes votes exceed no votes and meet quorum.
    await dao.connect(addr1).vote(proposalId, true); // weight = 100 tokens
    await dao.connect(addr2).vote(proposalId, true); // weight = 200 tokens
    await dao.connect(addr3).vote(proposalId, false); // weight = 300 tokens

    // Add another vote for additional weight:
    const [ , , , , addr4 ] = await ethers.getSigners();
    await token.transfer(addr4.address, ethers.utils.parseEther("100"));
    await dao.connect(addr4).vote(proposalId, true); // weight = 100 tokens

    // Now yesVotes = 400, noVotes = 300. Quorum met (total votes = 700 tokens > MINIMUM_QUORUM)

    // Increase time beyond executionTime (voting period + timelock)
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]); // 4 days
    await ethers.provider.send("evm_mine", []);

    // Execute proposal
    const tx = await dao.executeProposal(proposalId);
    await tx.wait();

    // Check that DummyTarget has been called and its value is now 42.
    expect(await dummyTarget.value()).to.equal(42);
  });
});
