const BigNumber = require('bignumber.js');

// Pulled from etherscan for testing (full decimals)
// get proposalThreshold and quorumVotes from Governor Alpha contract
const mockMinProposal = 11000;
const mockMinQuorum = 4400;
const mockDecimals = 2;

// Convert to bignumber and 10^x
let decimals = mockDecimals;
decimals = new BigNumber(decimals.toString());
decimals = new BigNumber(10).pow(decimals);

// convert to bignumber.js and divide by COMP decimals
const minQuorumVotes = new BigNumber(mockMinQuorum.toString()).div(decimals);
const minProposalVotes = new BigNumber(mockMinProposal.toString()).div(decimals);

const mockERC20Contract = {
  decimals: jest.fn().mockResolvedValue(0),
  // decimals: jest.fn().mockResolvedValue(18),
  balanceOf: jest.fn(),
  proposalVotes: jest.fn().mockResolvedValue(mockMinQuorum),
  quorumVotes: jest.fn().mockResolvedValue(mockMinProposal),
};

// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersProvider: jest.fn(),
  ethers: {
    ...jest.requireActual('ethers'),
    Contract: jest.fn().mockReturnValue(mockERC20Contract),
  },
}));

const {
  ethers, TransactionEvent, Finding, FindingType, FindingSeverity,
} = require('forta-agent');
const config = require('../agent-config.json');
const CErc20Abi = require('../abi/CErc20.json');

// local definitions
const { provideInitialize, provideHandleTransaction } = require('./agent');

// check the configuration file to verify the values
describe('check agent configuration file', () => {
  it('protocolName key required', () => {
    const { protocolName } = config;
    expect(typeof (protocolName)).toBe('string');
    expect(protocolName).not.toBe('');
  });

  it('protocolAbbreviation key required', () => {
    const { protocolAbbreviation } = config;
    expect(typeof (protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  it('developerAbbreviation key required', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  it('COMPAddress key required', () => {
    const { COMPAddress } = config;
    expect(typeof (COMPAddress)).toBe('string');
    expect(COMPAddress).not.toBe('');
  });

  it('cCOMPAddress key required', () => {
    const { cCOMPAddress } = config;
    expect(typeof (cCOMPAddress)).toBe('string');
    expect(cCOMPAddress).not.toBe('');
  });

  it('borrowLevels key required', () => {
    const { borrowLevels } = config;
    expect(typeof (borrowLevels)).toBe('object');
    expect(borrowLevels).not.toBe({});
  });

  it('borrowLevels key values must be valid', () => {
    const { borrowLevels } = config;
    Object.keys(borrowLevels).forEach((key) => {
      const { minAmountCOMP, type, severity } = borrowLevels[key];

      // check that all the required values in the borrowLevel key are present and defined
      expect(typeof (minAmountCOMP)).toBe('number');
      expect(minAmountCOMP).not.toBe(undefined);
      expect(typeof (type)).toBe('string');
      expect(type).not.toBe('');
      expect(typeof (severity)).toBe('string');
      expect(severity).not.toBe('');

      // check type, this will fail if the value of type is not valid
      expect(Object.prototype.hasOwnProperty.call(FindingType, type)).toBe(true);

      // check severity, this will fail if the value of severity is not valid
      expect(Object.prototype.hasOwnProperty.call(FindingSeverity, severity)).toBe(true);
    });
  });
});

// agent tests
describe('handleTransaction', () => {
  const {
    developerAbbreviation,
    protocolName,
    protocolAbbreviation,
    cCOMPAddress,
    borrowLevels,
  } = config;
  const iface = new ethers.utils.Interface(CErc20Abi);
  const mockBorrowerAddress = '0x1212121212121212121212121212121212121212';
  let initializeData;
  let handleTransaction;

  beforeEach(async () => {
    initializeData = {};
    // initialize the handler
    await (provideInitialize(initializeData))();
    handleTransaction = provideHandleTransaction(initializeData);
    mockERC20Contract.balanceOf.mockReset();
  });

  it('returns no findings if no borrow event was emitted and no interaction with the cCOMP token occurred', async () => {
    const mockReceipt = {
      logs: [],
    };
    // create the mock txEvent
    const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

    // run the agent
    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
    expect(mockERC20Contract.balanceOf).toHaveBeenCalledTimes(0);
  });

  it('returns no findings if an event other than the borrow event is emitted from the cCOMP token contract', async () => {
    // build mock receipt for mock txEvent, in this case the log event topics will not correspond to
    // the Borrow event so we should not expect to see a finding
    const mockTopics = [
      ethers.utils.id('mockEvent(indexed address)'),
      ethers.utils.defaultAbiCoder.encode(
        ['address'], ['0x1111111111111111111111111111111111111111'],
      ),
    ];
    const mockReceipt = {
      logs: [{
        address: cCOMPAddress,
        topics: mockTopics,
        data: '0x',
      }],
    };

    // create the mock txEvent
    const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

    // run the agent
    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
    expect(mockERC20Contract.balanceOf).toHaveBeenCalledTimes(0);
  });

  it('returns no findings if a borrow event is emitted from not the cCOMP token contract', async () => {
    // build the mock receipt for mock txEvent, in this case the log event topics will correspond to
    // the Borrow event but the address will not be from cCOMP so we should not expect a finding
    const mockTopics = iface.encodeFilterTopics('Borrow', []);
    const mockData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256'],
      [mockBorrowerAddress, 1, 1, 1],
    );
    const mockReceipt = {
      logs: [{
        address: '0xMOCKADDRESS',
        topics: mockTopics,
        data: mockData,
      }],
    };

    // create the mock txEvent
    const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

    // run the agent
    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
    expect(mockERC20Contract.balanceOf).toHaveBeenCalledTimes(0);
  });

  it('returns no findings when a borrow event is emitted from the cCOMP token contract and the address that borrowed COMP is below all the defined governance thresholds', async () => {
    // set the balanceOf to a value that is lower than the minimum COMP threshold for the proposal
    // governance action
    mockERC20Contract.balanceOf.mockResolvedValue(1);
    // build the mock receipt for mock txEvent, in this case the log event topics will correspond to
    // the Borrow event with the cCOMP address
    const mockTopics = iface.encodeFilterTopics('Borrow', []);
    const mockData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256'],
      [mockBorrowerAddress, 1, 1, 1],
    );
    const mockReceipt = {
      logs: [{
        address: cCOMPAddress,
        topics: mockTopics,
        data: mockData,
      }],
    };

    // create the mock txEvent
    const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

    // run the agent
    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
    expect(mockERC20Contract.balanceOf).toHaveBeenCalledTimes(1);
  });

  it('returns a finding when a borrow event is emitted from the cCOMP token contract and the address that borrowed COMP exceeds the proposal threshold', async () => {
    // set the balanceOf to a value that is greater than the minimum COMP threshold for the proposal
    // governance action


    // const { minAmountCOMP, type, severity } = borrowLevels.proposal;
    const { type, severity } = borrowLevels.proposal;
    const minAmountCOMP = minProposalVotes;
    mockERC20Contract.balanceOf.mockResolvedValue(BigNumber.sum(minAmountCOMP, 1));
    // mockERC20Contract.balanceOf.mockResolvedValue((minAmountCOMP + 1).pow(decimals));
    // mockERC20Contract.balanceOf.mockResolvedValue(mockMinQuorum + 1);

    // TS
    console.log('Watch from here', minAmountCOMP);

    // build the mock receipt for mock txEvent, in this case the log event topics will correspond to
    // the Borrow event with the cCOMP address
    const mockTopics = iface.encodeFilterTopics('Borrow', []);
    const mockData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256'],
      [mockBorrowerAddress, 1, 1, 1],
    );
    const mockReceipt = {
      logs: [{
        address: cCOMPAddress,
        topics: mockTopics,
        data: mockData,
      }],
    };

    // create the mock txEvent
    const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

    // TS
    // console.log(minAmountCOMP);

    // run the agent
    const findings = await handleTransaction(txEvent);
    const expectedFinding = [Finding.fromObject({
      name: `${protocolName} Governance Threshold Alert`,
      description: `The address ${mockBorrowerAddress} has borrowed and accrued enough COMP token to pass`
        + 'the minimum threshold for the governance event: proposal',
      alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-THRESHOLD`,
      type: FindingType[type],
      severity: FindingSeverity[severity],
      protocol: protocolName,
      metadata: {
        borrowerAddress: mockBorrowerAddress,
        governanceLevel: 'proposal',
        minCOMPNeeded: minAmountCOMP.toString(),
        currCOMPOwned: (BigNumber.sum(minAmountCOMP, 1)).toString(),
      },
    })];

    // TS
    console.log((typeof minAmountCOMP), 'Type') ;

    expect(findings).toStrictEqual(expectedFinding);
    expect(mockERC20Contract.balanceOf).toHaveBeenCalledTimes(1);
  });

  it('returns two findings when a borrow event is emitted from the cCOMP token contract and the address that borrowed COMP exceeds the proposal and vote quorum thresholds', async () => {
    const {
      minAmountCOMP: proposalMinCOMP, type: proposalType, severity: proposalSeverity,
    } = borrowLevels.proposal;
    const {
      type: votingQuorumType, severity: votingQuorumSeverity,
    } = borrowLevels.votingQuorum;

    // set the balanceOf to a value that is greater than the minimum COMP threshold for the proposal
    // and vote quorum governance interactions
    // mockERC20Contract.balanceOf.mockResolvedValue(votingMinCOMP + 1);
    mockERC20Contract.balanceOf.mockResolvedValue(BigNumber.sum(minQuorumVotes, 1));
    //  mockERC20Contract.balanceOf.mockResolvedValue(mockMinProposal + decimals);

    // build the mock receipt for mock txEvent, in this case the log event topics will correspond to
    // the Borrow event with the cCOMP address
    const mockTopics = iface.encodeFilterTopics('Borrow', []);
    const mockData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256'],
      [mockBorrowerAddress, 1, 1, 1],
    );
    const mockReceipt = {
      logs: [{
        address: cCOMPAddress,
        topics: mockTopics,
        data: mockData,
      }],
    };

    // create the mock txEvent
    const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

    // run the agent
    const findings = await handleTransaction(txEvent);

    // because the total COMP balance of the mockBorrowerAddress has exceeded both the proposal and
    // vote quorum thresholds, we expect two findings to be returned after running handleTransaction
    const expectedFindingProposal = Finding.fromObject({
      name: `${protocolName} Governance Threshold Alert`,
      description: `The address ${mockBorrowerAddress} has borrowed and accrued enough COMP token to pass`
        + 'the minimum threshold for the governance event: proposal',
      alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-THRESHOLD`,
      type: FindingType[proposalType],
      severity: FindingSeverity[proposalSeverity],
      protocol: protocolName,
      metadata: {
        borrowerAddress: mockBorrowerAddress,
        governanceLevel: 'proposal',
        // minCOMPNeeded: proposalMinCOMP.toString(),
        minCOMPNeeded: minProposalVotes.toString(),
        // currCOMPOwned: (votingMinCOMP + 1).toString(),
        currCOMPOwned: (BigNumber.sum(minQuorumVotes, 1)).toString(),
      },
    });

    const expectedFindingVotingQuorum = Finding.fromObject({
      name: `${protocolName} Governance Threshold Alert`,
      description: `The address ${mockBorrowerAddress} has borrowed and accrued enough COMP token to pass`
        + 'the minimum threshold for the governance event: votingQuorum',
      alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-THRESHOLD`,
      type: FindingType[votingQuorumType],
      severity: FindingSeverity[votingQuorumSeverity],
      protocol: protocolName,
      metadata: {
        borrowerAddress: mockBorrowerAddress,
        governanceLevel: 'votingQuorum',
        // minCOMPNeeded: votingMinCOMP.toString(),
        minCOMPNeeded: minQuorumVotes.toString(),
        // currCOMPOwned: (votingMinCOMP + 1).toString(),
        currCOMPOwned: (BigNumber.sum(minQuorumVotes, 1)).toString(),
      },
    });

    expect(findings).toStrictEqual([expectedFindingProposal, expectedFindingVotingQuorum]);
    expect(mockERC20Contract.balanceOf).toHaveBeenCalledTimes(1);
  });
});
