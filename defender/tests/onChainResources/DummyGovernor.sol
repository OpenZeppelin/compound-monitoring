//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;


contract DummyGovernor {
     constructor() {
        owner = msg.sender;
    }

    function emitCanceled(uint256 propId) external onlyOwner {
        emit ProposalCanceled(propId);
    }

    function emitExecuted(uint256 propId) external onlyOwner {
        emit ProposalExecuted(propId);
    }
    
    function emitCreated(uint propId, address proposer, address[] targets, uint[] values, string[] signatures, bytes[] calldatas, uint startBlock, uint endBlock, string description) external onlyOwner {
        emit ProposalCreated(propId, proposer, targets, valiues, signatures, calldatas, startBlock, endBlock, description);
    }

    function emitQueued(uint256 propId, uint256 eta) external onlyOwner {
        emit ProposalQueued(propId, eta);
    }

    function emitVoted(address voter, uint propId, uint8 support, uint votes, string reason) external onlyOwner {
        emit VoteCast(voter, propId, support, votes, reason);
    }

   // Test data provided:
    function autoCanceled() external onlyOwner {
        emit ProposalCanceled(157);
    }

    function autoExecuted() external onlyOwner {
        emit ProposalExecuted(157);
    }
    
    function autoCreated() external onlyOwner {
        emit ProposalCreated(158, 0xc66e426404c742d81655a9d80ce58fdbcee468a9, [0xc66e426404c742d81655a9d80ce58fdbcee468a9], [1], [157], [200], 700, 766, "# Refresh Polygon COMP ## Explanation Since the launch of cUSDCv3 on Polygon mainnet a month ago the market has grown steadily and proven to be in good order. The initial seeding of rewards only provisioned enough for a few months as a conservative starting point. Now is a good time to renew the COMP rewards going to the market. This proposal bridges an additional 12 500 COMP to sustain the current rewards speeds of the market for an additional year (approximately). ## Proposal The proposal itself is to be made from [this pull request](https://github.com/compound-finance/comet/pull/735). The first action approves the transfer of COMP by the Polygon bridge contract. The second action triggers the transfer across the bridge to the rewards contract.");
    }

    function autoQueued() external onlyOwner {
        emit ProposalQueued(157, 23948);
    }

    function autoVoted() external onlyOwner {
        emit VoteCast(0xc66e426404c742d81655a9d80ce58fdbcee468a9, 157, 1, 6000, "seems legit");
    }



    modifier onlyOwner() {
        if (msg.sender != owner) revert onlyOwner();
        _;
    }

    event ProposalCanceled(uint256);
    event ProposalExecuted(uint256);
    event ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string);
    event ProposalQueued(uint256,uint256);
    event VoteCast(address,uint256,uint8,uint256,string);
    


}