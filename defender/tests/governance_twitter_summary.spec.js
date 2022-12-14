// Set the name of the Secrets set in Autotask
const stackName = 'governance_twitter_summary';
const governanceAddressSecretName = `${stackName}_governanceAddress`;
// Consumer Keys from an elevated developer account
const appKeySecretName = `${stackName}_appKey`;
const appSecretSecretName = `${stackName}_appSecret`;
// Authentication Tokens (must have write permissions)
const accessTokenSecretName = `${stackName}_accessToken`;
const accessSecretSecretName = `${stackName}_accessSecret`;

const secrets = {
  [governanceAddressSecretName]: 'GOVERNANCE_ADDRESS',
  [appKeySecretName]: 'TWITTER_APP_KEY',
  [appSecretSecretName]: 'TWITTER_APP_SECRET',
  [accessTokenSecretName]: 'TWITTER_ACCESS_TOKEN',
  [accessSecretSecretName]: 'TWITTER_ACCESS_SECRET',
};
const mockDecimals = 18;

const mockContract = {
  initialProposalId: jest.fn(),
  proposalCount: jest.fn(),
  state: jest.fn(),
  proposals: jest.fn(),
  comp: jest.fn(),
  quorumVotes: jest.fn(),
  decimals: jest.fn().mockReturnValue(mockDecimals),
};

// mock ethers
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn().mockReturnValue(mockContract),
}));

const { ethers } = require('ethers');

const exampleProposal = {
  id: 1, // id
  proposer: `0x${'a'.repeat(40)}`, // proposer 0xaaaa...
  eta: 0, // eta
  startBlock: 0, // startBlock
  endBlock: 94784, // endBlock 1 day, 2 hours, 3 minutes, 4 seconds later
  forVotes: ethers.BigNumber.from(0), // forVotes
  againstVotes: ethers.BigNumber.from(0), // againstVotes
  abstainVotes: ethers.BigNumber.from(0), // abstainVotes
  canceled: false, // canceled
  executed: false, // executed
};

// mock the defender-relay-client package
const mockProvider = {
  getBlock: jest.fn(),
};
const mockSigner = {
  getAddress: jest.fn().mockReturnValue(ethers.constants.AddressZero),
};

jest.mock('defender-relay-client/lib/ethers', () => ({
  DefenderRelayProvider: jest.fn().mockReturnValue(mockProvider),
  DefenderRelaySigner: jest.fn().mockReturnValue(mockSigner),
}));

jest.mock('axios', () => jest.fn());
const mockAxios = require('axios');

mockAxios.get = jest.fn();

jest.mock('axios-retry', () => jest.fn());

const { TwitterApi } = require('../governance_twitter_summary/autotask-1/twitter-api-v2');

// Spy on the tweet and reply methods. The first tweet will return with id_str: '1'
const mockTweet = jest.spyOn(TwitterApi.prototype.v1, 'tweet').mockImplementation(() => ({ id_str: '1' }));
// reply will prepend a 1 to the tweetID that it was passed. '1' => '11' => '111'
const mockReply = jest.spyOn(TwitterApi.prototype.v1, 'reply').mockImplementation((_msg, id) => ({ id_str: `1${id}` }));

const { handler } = require('../governance_twitter_summary/autotask-1/index');

describe('check autotask', () => {
  beforeEach(() => {
    mockContract.state.mockClear();
    mockContract.quorumVotes.mockClear();
    mockAxios.mockClear();
    mockTweet.mockClear();
    mockReply.mockClear();

    // define default values
    mockContract.state.mockResolvedValue(0); // Default to pending state
    mockContract.comp.mockResolvedValue(`0x${'1'.repeat(40)}`); // 0x1111...
    // need 100 Tokens to reach quorum
    mockContract.quorumVotes.mockResolvedValue(ethers.BigNumber.from(`100${'0'.repeat(mockDecimals)}`));

    // one block per second
    mockProvider.getBlock.mockClear();
    mockProvider.getBlock.mockImplementation((block) => {
      switch (block) {
        case 'latest':
          return {
            number: 1000, // Block 1000
            timestamp: 1000,
          };
        default:
          return {
            number: 0, // Block 0
            timestamp: 0,
          };
      }
    });

    mockAxios.get.mockImplementation((id) => {
      switch (id) {
        case 'https://api.compound.finance/api/v2/governance/proposals?proposal_ids[]=1':
          return {
            data: { proposals: [{ title: 'Prop1' }] },
          };
        case 'https://api.compound.finance/api/v2/governance/proposals?proposal_ids[]=2':
          return {
            data: { proposals: [{ title: 'Prop2' }] },
          };
        default:
          return null;
      }
    });

    mockContract.proposals.mockReset();
    mockContract.proposals.mockResolvedValue(exampleProposal);
  });

  afterEach(() => {
  });

  it('does nothing if no proposals have been created', async () => {
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));

    await handler({ secrets });

    // no proposals should be looked up
    expect(mockContract.state).toBeCalledTimes(0);
    expect(mockContract.proposals).toBeCalledTimes(0);
    expect(mockAxios).toBeCalledTimes(0);
  });

  it('does nothing for proposals that are not active', async () => {
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(6));

    // Active case is omitted
    mockContract.state = jest.fn()
      .mockResolvedValueOnce(0) // Pending
      .mockResolvedValueOnce(2) // Cancelled
      .mockResolvedValueOnce(3) // Defeated
      .mockResolvedValueOnce(4) // Successful
      .mockResolvedValueOnce(5) // Queued
      .mockResolvedValueOnce(6) // Expired
      .mockResolvedValueOnce(7); // Executed

    await handler({ secrets });

    // should look up the state of the 6 proposals but will not look up proposal info
    expect(mockContract.state).toBeCalledTimes(6);
    expect(mockContract.proposals).toBeCalledTimes(0);
    expect(mockAxios).toBeCalledTimes(0);
  });

  it('calls Twitter for a proposal that is active', async () => {
    const expectedProp1 = 'Proposal #1 - Prop1:\n'
      + 'FOR votes vs quorum threshold: 0%\n'
      + '👍 (for) votes: 0\n'
      + '👎 (against) votes: 0\n'
      + '🙊 (abstain) votes: 0\n'
      + 'Time left to vote: 1 day(s) 2 hour(s) 3 minutes(s) 4 seconds(s)\n'
      + 'https://compound.finance/governance/proposals/1';

    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(1));

    // proposal is state 1 (active)
    mockContract.state = jest.fn().mockResolvedValueOnce(1);

    const initialMessage = `Current Compound Governance Proposals as of ${new Date().toUTCString()}:`;
    await handler({ secrets });

    // should look up the state of the 1 proposal and look up that proposal's info
    expect(mockContract.state).toBeCalledTimes(1);
    expect(mockContract.proposals).toBeCalledTimes(1);

    // Initial tweet
    expect(mockTweet).toBeCalledTimes(1);
    expect(mockTweet.mock.calls[0][0]).toBe(initialMessage);

    // Reply to the initial tweet (ID:1)
    expect(mockReply).toBeCalledTimes(1);
    expect(mockReply.mock.calls[0][0]).toBe(expectedProp1);
    expect(mockReply.mock.calls[0][1]).toBe('1');
  });

  it('handles multiple proposals', async () => {
    const expectedProp1 = 'Proposal #1 - Prop1:\n'
      + 'FOR votes vs quorum threshold: 0%\n'
      + '👍 (for) votes: 0\n'
      + '👎 (against) votes: 0\n'
      + '🙊 (abstain) votes: 0\n'
      + 'Time left to vote: 1 day(s) 2 hour(s) 3 minutes(s) 4 seconds(s)\n'
      + 'https://compound.finance/governance/proposals/1';

    const expectedProp2 = 'Proposal #2 - Prop2:\n'
      + 'FOR votes vs quorum threshold: 10%\n'
      + '👍 (for) votes: 10\n'
      + '👎 (against) votes: 10\n'
      + '🙊 (abstain) votes: 10\n'
      + 'Time left to vote: 1 day(s) 2 hour(s) 3 minutes(s) 4 seconds(s)\n'
      + 'https://compound.finance/governance/proposals/2';

    const proposal0 = { ...exampleProposal };
    const proposal1 = { ...exampleProposal };

    const votes = ethers.BigNumber.from(10).mul((ethers.BigNumber.from(10).pow(mockDecimals)));
    proposal1.id = 2;
    proposal1.forVotes = votes;
    proposal1.againstVotes = votes;
    proposal1.abstainVotes = votes;

    mockContract.proposals.mockResolvedValueOnce(proposal0).mockResolvedValueOnce(proposal1);
    mockContract.initialProposalId = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(0));
    mockContract.proposalCount = jest.fn().mockResolvedValueOnce(ethers.BigNumber.from(2));

    // proposal is state 1 (active)
    mockContract.state = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const initialMessage = `Current Compound Governance Proposals as of ${new Date().toUTCString()}:`;
    await handler({ secrets });

    // Initial tweet
    expect(mockTweet).toBeCalledTimes(1);
    expect(mockTweet.mock.calls[0][0]).toBe(initialMessage);

    // Reply to the initial tweet (ID:'1')
    expect(mockReply).toBeCalledTimes(2);
    expect(mockReply.mock.calls[0][0]).toBe(expectedProp1);
    expect(mockReply.mock.calls[0][1]).toBe('1');

    // Reply to the reply(ID:'11')
    expect(mockReply.mock.calls[1][0]).toBe(expectedProp2);
    expect(mockReply.mock.calls[1][1]).toBe('11');
  });
});
