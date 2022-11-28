const mockContract = {
  castVoteBySig: jest.fn(),
  delegateBySig: jest.fn(),
};

// mock ethers
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn().mockReturnValue(mockContract),
}));

const { ethers } = require('ethers');

// mock the defender-relay-client package
jest.mock('defender-relay-client/lib/ethers', () => ({
  DefenderRelayProvider: jest.fn(),
  DefenderRelaySigner: jest.fn(),
}));

const { handler } = require('./Compound_Gasless_Voting');

function createAutotaskEvent(txsBatch) {
  const autotaskEvent = {
    request: {
      body: txsBatch,
    },
  };
  return autotaskEvent;
}

function createVoteObject(address, proposalId, support, v, r, s) {
  const voteObject = {
    address,
    proposalId,
    support,
    v,
    r,
    s,
  }

  return voteObject;
}

describe('check autotask', () => {
  it('casts votes when given a valid signature', async () => {
    // 'function castVoteBySig(uint proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s)',
    const validVote1 = createVoteObject("0x1", 0, 0, 8, "dsadas", "dsa")
    const validVote2 = 
  });

  it('does not cast vote when signature is invalid', async () => {

  });

  it('delegates votes when given a valid signature', async () => {
    // 'function delegateBySig(address delegatee, uint nonce, uint expiry, uint8 v, bytes32 r, bytes32 s)',

  });

  it('does not delegate votes signature is invalid', async () => {

  });
});
