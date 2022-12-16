// Set the name of the Secret set in Autotask
const stackName = 'governance_automation';
const governanceAddressSecretName = `${stackName}_governanceAddress`;

require('dotenv').config();

const mockContract = {
  initialProposalId: jest.fn(),
  proposalCount: jest.fn(),
  proposals: jest.fn(),
  state: jest.fn(),
  queue: jest.fn(),
  execute: jest.fn(),
  provider: {
    getBlock: jest.fn(),
  },
};

// mock ethers
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn().mockReturnValue(mockContract),
}));

const { ethers } = require('ethers');

// mock the defender-relay-client package
const mockProvider = {};
const mockSigner = {
  getAddress: jest.fn().mockReturnValue(ethers.constants.AddressZero),
};

jest.mock('defender-relay-client/lib/ethers', () => ({
  DefenderRelayProvider: jest.fn().mockReturnValue(mockProvider),
  DefenderRelaySigner: jest.fn().mockReturnValue(mockSigner),
}));

// mock the defender-kvstore-client package
const mockKeyValueStoreClient = {
  get: jest.fn(),
  put: jest.fn(),
};

jest.mock('defender-kvstore-client', () => ({
  KeyValueStoreClient: jest.fn().mockReturnValue(mockKeyValueStoreClient),
}));

const { handler } = require('../governance_automation/autotask-1/index');

describe('check autotask', () => {
  let mockKeyValueStore;
  let mockAutotaskEvent;
  beforeEach(() => {
    // reset the Object that mocks the key value store before each test case
    mockKeyValueStore = {};
    mockKeyValueStoreClient.get = jest.fn((key) => mockKeyValueStore[key]);
    mockKeyValueStoreClient.put = jest.fn((key, value) => {
      mockKeyValueStore[key] = value;
    });

    mockAutotaskEvent = {
      secrets: {
        [governanceAddressSecretName]: 'http://localhost/',
      },
    };
  });

  afterEach(() => {
    // reset the call counters for these mocked contract calls
    mockContract.queue.mockClear();
    mockContract.execute.mockClear();
  });

  it('does nothing if no proposals have been created', async () => {
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    const results = await handler(mockAutotaskEvent);
    expect(results).toStrictEqual(true);
    // no proposal IDs should be added to the key value store
    expect(mockKeyValueStore).toStrictEqual({ proposalIdsToIgnore: '' });
    expect(mockContract.queue).toBeCalledTimes(0);
    expect(mockContract.execute).toBeCalledTimes(0);
  });

  it('correctly handles an empty string stored for proposal IDs to ignore', async () => {
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(1));
    mockKeyValueStore.proposalIdsToIgnore = '';
    // set the state to pending, which should be ignored
    mockContract.state = jest.fn().mockResolvedValueOnce(0); // Canceled
    const results = await handler(mockAutotaskEvent);
    expect(results).toStrictEqual(true);
    // no proposal IDs should be added to the key value store
    expect(mockKeyValueStore).toStrictEqual({ proposalIdsToIgnore: '' });
    expect(mockContract.queue).toBeCalledTimes(0);
    expect(mockContract.execute).toBeCalledTimes(0);
  });

  it('ignores proposal IDs that are stored in the key-value store', async () => {
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(3));
    mockKeyValueStore.proposalIdsToIgnore = '1,2,3';
    const results = await handler(mockAutotaskEvent);
    expect(results).toStrictEqual(true);
    // no proposal IDs should be added to the key value store
    expect(mockKeyValueStore).toStrictEqual({ proposalIdsToIgnore: '1,2,3' });
    expect(mockContract.queue).toBeCalledTimes(0);
    expect(mockContract.execute).toBeCalledTimes(0);
  });

  it('stores proposal IDs for those that have been canceled, defeated, expired, or executed', async () => {
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(4));
    mockContract.state = jest.fn()
      .mockResolvedValueOnce(2) // Canceled
      .mockResolvedValueOnce(3) // Defeated
      .mockResolvedValueOnce(6) // Expired
      .mockResolvedValueOnce(7); // Executed
    const results = await handler(mockAutotaskEvent);
    expect(results).toStrictEqual(true);
    // all of the proposal IDs should be added to the key value store
    expect(mockKeyValueStore).toStrictEqual({
      proposalIdsToIgnore: '1,2,3,4',
    });
    expect(mockContract.queue).toBeCalledTimes(0);
    expect(mockContract.execute).toBeCalledTimes(0);
  });

  it('does nothing for proposals that are pending or active', async () => {
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(2));
    // first proposal is state 0 (pending), second proposal is state 1 (active)
    mockContract.state = jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const results = await handler(mockAutotaskEvent);
    expect(results).toStrictEqual(true);
    // no proposal IDs should be added to the key value store
    expect(mockKeyValueStore).toStrictEqual({ proposalIdsToIgnore: '' });
    expect(mockContract.queue).toBeCalledTimes(0);
    expect(mockContract.execute).toBeCalledTimes(0);
  });

  it('calls queue for proposals that are successful', async () => {
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(1));
    // proposal is state 4 (successful)
    mockContract.state = jest.fn().mockResolvedValueOnce(4);
    mockContract.provider.getBlock.mockResolvedValueOnce({ timestamp: 99 });
    mockContract.proposals.mockResolvedValueOnce({ eta: ethers.BigNumber.from(100) });
    const results = await handler(mockAutotaskEvent);
    expect(results).toStrictEqual(true);
    // the proposalIdsToIgnore should be added with an empty string as the value
    expect(mockKeyValueStore).toStrictEqual({ proposalIdsToIgnore: '' });
    expect(mockContract.queue).toBeCalledTimes(1);
    expect(mockContract.execute).toBeCalledTimes(0);
  });

  it('does nothing for proposals that are queued but have not been in the timelock long enough', async () => {
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(1));
    // proposal is state 5 (queued)
    mockContract.state = jest.fn().mockResolvedValueOnce(5);

    // set the timestamp on a mock block from the provider
    const mockTimestamp = 100;
    mockContract.provider.getBlock.mockResolvedValueOnce({ timestamp: mockTimestamp });

    // set the eta parameter of the proposal to be just AFTER the mock block timestamp
    // eta is a timestamp that specifies the earliest the the proposal can be executed
    // setting eta to a value GREATER the current block timestamp means that the proposal
    // cannot yet be executed
    // therefore, this should cause the Autotask to NOT call execute()
    mockContract.proposals = jest.fn()
      .mockResolvedValueOnce({ eta: ethers.BigNumber.from(mockTimestamp + 1) });

    const results = await handler(mockAutotaskEvent);
    expect(results).toStrictEqual(true);
    // the proposalIdsToIgnore should be added with an empty string as the value
    expect(mockKeyValueStore).toStrictEqual({ proposalIdsToIgnore: '' });
    expect(mockContract.queue).toBeCalledTimes(0);
    expect(mockContract.execute).toBeCalledTimes(0);
  });

  it('calls execute for proposals that are queued and ready to execute', async () => {
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(1));
    // proposal is state 5 (queued)
    mockContract.state = jest.fn().mockResolvedValueOnce(5);

    // set the timestamp on a mock block from the provider
    const mockTimestamp = 100;
    mockContract.provider.getBlock.mockResolvedValueOnce({ timestamp: mockTimestamp });

    // set the eta parameter of the proposal to be just BEFORE the mock block timestamp
    // eta is a timestamp that specifies the earliest the the proposal can be executed
    // setting eta to a value LESS THAN than the current block timestamp means that the proposal
    // CAN be executed
    // therefore, this should cause the Autotask to call execute()
    mockContract.proposals = jest.fn()
      .mockResolvedValueOnce({ eta: ethers.BigNumber.from(mockTimestamp - 1) });

    const results = await handler(mockAutotaskEvent);
    expect(results).toStrictEqual(true);
    // the proposalIdsToIgnore should be added with an empty string as the value
    expect(mockKeyValueStore).toStrictEqual({ proposalIdsToIgnore: '' });
    expect(mockContract.queue).toBeCalledTimes(0);
    expect(mockContract.execute).toBeCalledTimes(1);
  });
});
