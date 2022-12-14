const mockContract = {
  castVoteBySig: jest.fn(),
  delegateBySig: jest.fn(),
  getCurrentVotes: jest.fn(),
  state: jest.fn(),
};

// mock ethers
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn().mockReturnValue(mockContract),
}));

const { ethers } = require('ethers');

// mock the defender-relay-client package
const mockProvider = {
  getBalance: jest.fn().mockReturnValue(10),
};
const mockSigner = {
  getAddress: jest.fn().mockReturnValue(ethers.constants.AddressZero),
};

jest.mock('defender-relay-client/lib/ethers', () => ({
  DefenderRelayProvider: jest.fn().mockReturnValue(mockProvider),
  DefenderRelaySigner: jest.fn().mockReturnValue(mockSigner),
}));

const { handler } = require('../gasless_voting_dev/autotask-1/index');

function createAutotaskEvent(batchedTxs) {
  const autotaskEvent = {
    request: {
      body: batchedTxs,
    },
  };
  return autotaskEvent;
}

function createCastVoteObject(address, proposalId, support, v, r, s) {
  const voteObject = {
    address,
    proposalId,
    support,
    v,
    r,
    s,
  };

  return voteObject;
}

function createDelegateVoteObject(address, delegatee, nonce, expiry, v, r, s) {
  const delegateVoteObject = {
    address,
    delegatee,
    nonce,
    expiry,
    v,
    r,
    s,
  };

  return delegateVoteObject;
}

describe('check autotask', () => {
  beforeEach(() => {
    mockContract.getCurrentVotes.mockReset();
    mockContract.state.mockReset();
  });

  it('casts votes when given a valid signed message', async () => {
    mockContract.getCurrentVotes = jest.fn().mockResolvedValue(100);
    mockContract.state = jest.fn().mockResolvedValue(1);
    const validVote1 = createCastVoteObject(
      '0x1111111111111111111111111111111111111111',
      0,
      0,
      '0x1b',
      '0xda4429a9e8e6b54cb101b2df002039f2879ab4ca0e8fae64134942cb81f3e581',
      '0x3b90a37dc078a82dfc418695b1d4473661aa4d24dd874ac68678894ff44a6b27',
    );
    const validVote2 = createCastVoteObject(
      '0x2222222222222222222222222222222222222222',
      0,
      0,
      '0x1b',
      '0x2e04bc22ee95e9f1d77b8634a8f0bf68e73dc8dab0b531d7cce777878b2f00b0',
      '0xd73d470d9b221117d96c88f26a57d89ae8470d986e8bac4398d8315f4cca1460',
    );
    const batchedTxs = [validVote1, validVote2];
    const autotaskEvent = createAutotaskEvent(batchedTxs);
    await handler(autotaskEvent);

    expect(mockContract.castVoteBySig).toBeCalledTimes(2);
    expect(mockContract.delegateBySig).toBeCalledTimes(0);
    mockContract.castVoteBySig.mockClear();
    mockContract.delegateBySig.mockClear();
  });

  it('does not cast votes if the address has 0 delegated votes', async () => {
    mockContract.state = jest.fn().mockResolvedValue(2);
    mockContract.getCurrentVotes = jest.fn().mockResolvedValue(100);
    const validVote1 = createCastVoteObject(
      '0x1111111111111111111111111111111111111111',
      0,
      0,
      '0x1b',
      '0xda4429a9e8e6b54cb101b2df002039f2879ab4ca0e8fae64134942cb81f3e581',
      '0x3b90a37dc078a82dfc418695b1d4473661aa4d24dd874ac68678894ff44a6b27',
    );
    const validVote2 = createCastVoteObject(
      '0x2222222222222222222222222222222222222222',
      0,
      0,
      '0x1b',
      '0x2e04bc22ee95e9f1d77b8634a8f0bf68e73dc8dab0b531d7cce777878b2f00b0',
      '0xd73d470d9b221117d96c88f26a57d89ae8470d986e8bac4398d8315f4cca1460',
    );
    const batchedTxs = [validVote1, validVote2];
    const autotaskEvent = createAutotaskEvent(batchedTxs);
    await handler(autotaskEvent);

    expect(mockContract.castVoteBySig).toBeCalledTimes(0);
    expect(mockContract.delegateBySig).toBeCalledTimes(0);
    mockContract.castVoteBySig.mockClear();
    mockContract.delegateBySig.mockClear();
  });

  it('does not cast votes if the proposal is not active', async () => {
    mockContract.getCurrentVotes = jest.fn().mockResolvedValue(0);
    const validVote1 = createCastVoteObject(
      '0x1111111111111111111111111111111111111111',
      0,
      0,
      '0x1b',
      '0xda4429a9e8e6b54cb101b2df002039f2879ab4ca0e8fae64134942cb81f3e581',
      '0x3b90a37dc078a82dfc418695b1d4473661aa4d24dd874ac68678894ff44a6b27',
    );
    const validVote2 = createCastVoteObject(
      '0x2222222222222222222222222222222222222222',
      0,
      0,
      '0x1b',
      '0x2e04bc22ee95e9f1d77b8634a8f0bf68e73dc8dab0b531d7cce777878b2f00b0',
      '0xd73d470d9b221117d96c88f26a57d89ae8470d986e8bac4398d8315f4cca1460',
    );
    const batchedTxs = [validVote1, validVote2];
    const autotaskEvent = createAutotaskEvent(batchedTxs);
    await handler(autotaskEvent);

    expect(mockContract.castVoteBySig).toBeCalledTimes(0);
    expect(mockContract.delegateBySig).toBeCalledTimes(0);
    mockContract.castVoteBySig.mockClear();
    mockContract.delegateBySig.mockClear();
  });

  it('delegates votes when given a valid signed message', async () => {
    mockContract.balanceOf = jest.fn().mockResolvedValue(10);
    const validDelegateVote1 = createDelegateVoteObject(
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      1,
      100,
      '0x1b',
      '0xda4429a9e8e6b54cb101b2df002039f2879ab4ca0e8fae64134942cb81f3e581',
      '0x3b90a37dc078a82dfc418695b1d4473661aa4d24dd874ac68678894ff44a6b27',
    );
    const validDelegateVote2 = createDelegateVoteObject(
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
      1,
      100,
      '0x1b',
      '0x2e04bc22ee95e9f1d77b8634a8f0bf68e73dc8dab0b531d7cce777878b2f00b0',
      '0xd73d470d9b221117d96c88f26a57d89ae8470d986e8bac4398d8315f4cca1460',
    );

    const batchedTxs = [validDelegateVote1, validDelegateVote2];
    const autotaskEvent = createAutotaskEvent(batchedTxs);
    await handler(autotaskEvent);

    expect(mockContract.castVoteBySig).toBeCalledTimes(0);
    expect(mockContract.delegateBySig).toBeCalledTimes(2);
    mockContract.castVoteBySig.mockClear();
    mockContract.delegateBySig.mockClear();
  });

  it('does not delegate votes if the address has 0 COMP tokens', async () => {
    mockContract.balanceOf = jest.fn().mockResolvedValue(0);
    const validDelegateVote1 = createDelegateVoteObject(
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      1,
      100,
      '0x1b',
      '0xda4429a9e8e6b54cb101b2df002039f2879ab4ca0e8fae64134942cb81f3e581',
      '0x3b90a37dc078a82dfc418695b1d4473661aa4d24dd874ac68678894ff44a6b27',
    );
    const validDelegateVote2 = createDelegateVoteObject(
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
      1,
      100,
      '0x1b',
      '0x2e04bc22ee95e9f1d77b8634a8f0bf68e73dc8dab0b531d7cce777878b2f00b0',
      '0xd73d470d9b221117d96c88f26a57d89ae8470d986e8bac4398d8315f4cca1460',
    );

    const batchedTxs = [validDelegateVote1, validDelegateVote2];
    const autotaskEvent = createAutotaskEvent(batchedTxs);
    await handler(autotaskEvent);

    expect(mockContract.castVoteBySig).toBeCalledTimes(0);
    expect(mockContract.delegateBySig).toBeCalledTimes(0);
    mockContract.castVoteBySig.mockClear();
    mockContract.delegateBySig.mockClear();
  });

  it('does not vote if POST request information is not a delegate vote or a cast vote action', async () => {
    mockContract.balanceOf = jest.fn().mockResolvedValue(10);
    mockContract.getCurrentVotes = jest.fn().mockResolvedValue(100);
    mockContract.state = jest.fn().mockResolvedValue(1);
    // case for missing a support or delegatee field
    // in practice, this should not occur, as the api endpoint makes this a required field
    const invalidVoteObject = {
      address: '0x1111111111111111111111111111111111111111',
      proposalId: 0,
      v: 27,
      r: '0xda4429a9e8e6b54cb101b2df002039f2879ab4ca0e8fae64134942cb81f3e581',
      s: '0x3b90a37dc078a82dfc418695b1d4473661aa4d24dd874ac68678894ff44a6b27',
    };

    // this vote should still go through, even if the first one fails
    const validVote1 = createCastVoteObject(
      '0x1111111111111111111111111111111111111111',
      0,
      0,
      '0x1b',
      '0xda4429a9e8e6b54cb101b2df002039f2879ab4ca0e8fae64134942cb81f3e581',
      '0x3b90a37dc078a82dfc418695b1d4473661aa4d24dd874ac68678894ff44a6b27',
    );
    const batchedTxs = [invalidVoteObject, validVote1];
    const autotaskEvent = createAutotaskEvent(batchedTxs);
    await handler(autotaskEvent);

    expect(mockContract.castVoteBySig).toBeCalledTimes(1);
    expect(mockContract.delegateBySig).toBeCalledTimes(0);
    mockContract.castVoteBySig.mockClear();
    mockContract.delegateBySig.mockClear();
  });

  it('does not vote if POST request information is not a batched array', async () => {
    const validVote1 = createCastVoteObject(
      '0x1111111111111111111111111111111111111111',
      0,
      0,
      '0x1b',
      '0xda4429a9e8e6b54cb101b2df002039f2879ab4ca0e8fae64134942cb81f3e581',
      '0x3b90a37dc078a82dfc418695b1d4473661aa4d24dd874ac68678894ff44a6b27',
    );
    const autotaskEvent = createAutotaskEvent(validVote1); // not a batched tx
    await expect(handler(autotaskEvent)).rejects.toThrow('Request body must be an Array');

    expect(mockContract.castVoteBySig).toBeCalledTimes(0);
    expect(mockContract.delegateBySig).toBeCalledTimes(0);
    mockContract.castVoteBySig.mockClear();
    mockContract.delegateBySig.mockClear();
  });
});
