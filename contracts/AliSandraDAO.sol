// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IAliSandraToken {
    function balanceOf(address account) external view returns (uint256);
    function snapshot() external returns (uint256);
    function balanceOfAt(address account, uint256 snapshotId) external view returns (uint256);
}

contract AliSandraDAO is ReentrancyGuard {
    IAliSandraToken public token;

    // Voting parameters
    uint public constant VOTING_PERIOD = 3 days;
    uint public constant TIMELOCK_DELAY = 1 days;
    // Quorum is expressed in token weight; for example, 10 AST tokens (with 18 decimals)
    uint public constant MINIMUM_QUORUM = 10 * 10**18;

    // System name
    string public constant name = "AliSandra";

    // Proposal structure
    struct Proposal {
        string description;
        address target;
        bytes callData;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 deadline;
        uint256 executionTime;
        bool executed;
        uint256 snapshotId;
    }

    Proposal[] public proposals;
    
    // Tracks whether an address has voted on a given proposal
    mapping(uint => mapping(address => bool)) public hasVoted;

    // Events
    event ProposalCreated(
        uint proposalId,
        string description,
        address target,
        uint deadline,
        uint executionTime
    );

    event VoteCast(uint proposalId, address voter, bool support, uint weight);
    event ProposalExecuted(uint proposalId, bool success);

    constructor(address tokenAddress) {
        token = IAliSandraToken(tokenAddress);
    }

    /**
     * @notice Creates a new proposal.
     * @param description A short description of the proposal.
     * @param target The contract address to be called upon execution.
     * @param callData The calldata to send to the target.
     * @return proposalId The new proposal's ID.
     */
    function createProposal(
        string calldata description,
        address target,
        bytes calldata callData
    ) external returns (uint proposalId) {
        require(target != address(0), "Invalid target address");
        uint snapshotId = token.snapshot();

        proposalId = proposals.length;
        uint deadline = block.timestamp + VOTING_PERIOD;
        uint executionTime = deadline + TIMELOCK_DELAY;
        proposals.push(Proposal({
            description: description,
            target: target,
            callData: callData,
            yesVotes: 0,
            noVotes: 0,
            deadline: deadline,
            executionTime: executionTime,
            executed: false,
            snapshotId: snapshotId
        }));
        emit ProposalCreated(proposalId, description, target, deadline, executionTime);
    }

    /**
     * @notice Casts a vote on a proposal. Votes are weighted by token balance at snapshot.
     * @param proposalId The ID of the proposal.
     * @param support True for yes, false for no.
     */
    function vote(uint proposalId, bool support) external {
        require(proposalId < proposals.length, "Invalid proposal id");
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp < proposal.deadline, "Voting has ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        hasVoted[proposalId][msg.sender] = true;
        uint weight = token.balanceOfAt(msg.sender, proposal.snapshotId);
        require(weight > 0, "No voting power");

        if (support) {
            proposal.yesVotes += weight;
        } else {
            proposal.noVotes += weight;
        }
        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Executes a proposal if it meets quorum, timelock has passed, and it has more yes than no votes.
     * @param proposalId The ID of the proposal.
     */
    function executeProposal(uint proposalId) external nonReentrant {
        require(proposalId < proposals.length, "Invalid proposal id");
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.executionTime, "Timelock not passed");
        require(!proposal.executed, "Proposal already executed");
        require(proposal.yesVotes + proposal.noVotes >= MINIMUM_QUORUM, "Quorum not met");
        require(proposal.yesVotes > proposal.noVotes, "Proposal rejected");

        proposal.executed = true;
        (bool success, ) = proposal.target.call(proposal.callData);
        emit ProposalExecuted(proposalId, success);
        require(success, "Execution failed");
    }
}
