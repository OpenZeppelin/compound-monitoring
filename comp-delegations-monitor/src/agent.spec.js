const BigNumber = require('bignumber.js');

// proposalThreshold and quorumVotes will be pulled from Governor Bravo contract
// Note: the Proposal threshold will be less than the Quorum threshold
const mockMinProposal = 1100;
const mockMinQuorum = 4400;
const mockDecimals = 2;

// Convert to bignumber and 10^x
const decimals = new BigNumber(10).pow(mockDecimals);

// convert to bignumber.js and divide by COMP decimals
const minQuorumVotes = new BigNumber(mockMinQuorum).div(decimals);
const minProposalVotes = new BigNumber(mockMinProposal).div(decimals);

const mockGovContract = {
  decimals: jest.fn().mockResolvedValue(mockDecimals),
  balanceOf: jest.fn(),
  proposalThreshold: jest.fn().mockResolvedValue(mockMinProposal),
  quorumVotes: jest.fn().mockResolvedValue(mockMinQuorum),
};

// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersProvider: jest.fn(),
  ethers: {
    ...jest.requireActual('ethers'),
    Contract: jest.fn().mockReturnValue(mockGovContract),
  },
}));

const {
  ethers,
  Finding,
  FindingSeverity,
  FindingType,
  TransactionEvent,
} = require('forta-agent');

// forta sdk for createTransactionEvent was giving bugs with jest mocking
function createTransactionEvent(txObject) {
  const txEvent = new TransactionEvent(
    null,
    null,
    {},
    [],
    {},
    {},
    txObject.logs,
    null,
  );
  return txEvent;
}

const config = require('../bot-config.json');

const compERC20Abi = require('../abi/CompERC20.json');

const { provideInitialize, provideHandleTransaction } = require('./agent');

// create COMP token interface from Abi
const compERC20Interface = new ethers.utils.Interface(compERC20Abi);

// constants for testing
const zeroAddress = ethers.constants.AddressZero;
const zeroHash = ethers.constants.HashZero;

// default empty log structure
const emptyLog = {
  address: zeroHash,
  logIndex: 0,
  blockNumber: 0,
  blockHash: zeroHash,
  transactionIndex: 0,
  transactionHash: zeroHash,
  removed: false,
};

// function to encode default values
function defaultType(type) {
  switch (type) {
    case 'address':
      return zeroAddress;
    case 'bool':
      return false;
    case 'string':
      return '';
    case 'bytes':
      return '';
    case 'array':
      throw new Error('array not implemented');
    case 'tuple':
      throw new Error('tuple not implemented');
    default:
      return 0;
  }
}

// creates log with sparse inputs
function createLog(eventAbi, inputArgs, logArgs) {
  const topics = [];
  const dataTypes = [];
  const dataValues = [];

  // initialize default log and assign passed in values
  const log = { ...emptyLog, ...logArgs };

  // build topics and data fields
  topics.push(ethers.utils.Interface.getEventTopic(eventAbi));

  // parse each input, save into topic or data depending on indexing, may
  // have to skip if param._isParamType is false, does not support dynamic types
  eventAbi.inputs.forEach((param) => {
    const { type } = param;
    const data = inputArgs[param.name] || defaultType(type);
    // indexed inputs go into topics, otherwise it goes into data
    if (param.indexed) {
      topics.push(ethers.utils.defaultAbiCoder.encode([type], [data]));
    } else {
      dataTypes.push(type);
      dataValues.push(data);
    }
  });

  // assign topic and data
  log.topics = topics;
  log.data = ethers.utils.defaultAbiCoder.encode(dataTypes, dataValues);

  return log;
}

describe('check agent configuration file', () => {
  it('has a developer abbreviation', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  it('has a protocol name', () => {
    const { protocolName } = config;
    expect(typeof (protocolName)).toBe('string');
    expect(protocolName).not.toBe('');
  });

  it('has a protocol abbreviation', () => {
    const { protocolAbbreviation } = config;
    expect(typeof (protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  it('has a valid comp token address and abi', () => {
    const { compERC20 } = config;
    const { address, abi } = compERC20;
    expect(ethers.utils.isHexString(address, 20)).toBe(true);
    expect(typeof (abi)).toBe('string');
    expect(abi).not.toBe('');
  });

  it('has a valid governor bravo address and api ', () => {
    const { governorBravo } = config;
    const { address, abi } = governorBravo;
    expect(ethers.utils.isHexString(address, 20)).toBe(true);
    expect(typeof (abi)).toBe('string');
    expect(abi).not.toBe('');
  });

  describe('monitor COMP token delegation thresholds', () => {
    let initializeData;
    let handleTransaction;
    let mockTxEvent;

    const compERC20Address = '0xc00e94Cb662C3520282E6f5717214004A7f26888';
    const mockDelegateAddress = '0x1212121212121212121212121212121212121212';
    const delegateEventName = 'DelegateVotesChanged';
    const nonDelegateEventName = 'Transfer';

    beforeEach(async () => {
      initializeData = {};

      // initialize handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      // create empty transaction event to populate
      mockTxEvent = createTransactionEvent({});
    });

    it('returns no findings if no DelegateVotesChanged event was emitted and no interaction with the COMP token occurred', async () => {
      mockTxEvent.addresses[zeroAddress] = true;

      // use 'Transfer' as a non delegate event to test
      const log = createLog(
        compERC20Interface.getEvent(nonDelegateEventName),
        { from: zeroAddress, to: mockDelegateAddress, amount: 10 },
        { address: zeroAddress },
      );

      mockTxEvent.logs = [log];

      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    it('returns no findings if no DelegateVotesChanged event was emitted, but transaction involved the COMP token address', async () => {
      mockTxEvent.addresses[zeroAddress] = true;

      // use 'Transfer' as a non delegate event to test
      const log = createLog(
        compERC20Interface.getEvent(nonDelegateEventName),
        { from: zeroAddress, to: zeroAddress, amount: 10 },
        { address: compERC20Address },
      );

      mockTxEvent.logs = [log];

      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    it('returns no findings if a DelegateVotesChanged event occurred with the COMP token, but threshold level was not crossed', async () => {
      // use minProposalVotes - 1 (because proposal min is lower than quorum)
      const currCOMPOwned = BigNumber.sum(minProposalVotes, -1);
      // add the decimals back on before submitting
      mockGovContract.balanceOf.mockResolvedValue(currCOMPOwned.multipliedBy(decimals));

      const log = createLog(
        compERC20Interface.getEvent(delegateEventName),
        {
          delegate: mockDelegateAddress,
          previousBalance: 0,
          newBalance: currCOMPOwned.multipliedBy(decimals).toString(),
        },
        { address: compERC20Address }, // input involved address for .filterLog()
      );

      mockTxEvent.logs = [log];

      const finding = await handleTransaction(mockTxEvent);
      expect(finding).toStrictEqual([]);
    });

    it('returns a proposal threshold finding if delegate balance crosses proposal threshold, but not quorum threshold', async () => {
      // enough to cross threshold for proposal, but not quorum
      const currCOMPOwned = BigNumber.sum(minProposalVotes, 1);
      // add the decimals back on before submitting
      mockGovContract.balanceOf.mockResolvedValue(currCOMPOwned.multipliedBy(decimals));

      const log = createLog(
        compERC20Interface.getEvent(delegateEventName),
        {
          delegate: mockDelegateAddress,
          previousBalance: 0,
          newBalance: currCOMPOwned.multipliedBy(decimals).toString(),
        },
        { address: compERC20Address }, // input involved address for .filterLog()
      );

      mockTxEvent.logs = [log];

      const finding = await handleTransaction(mockTxEvent);

      const expectedProposalFinding = Finding.fromObject(
        {
          name: 'Compound Governance Delegate Threshold Alert',
          description: `The address ${mockDelegateAddress} has been delegated enough COMP token to pass the minimum threshold for the governance event: proposal`,
          alertId: 'AE-COMP-GOVERNANCE-DELEGATE-THRESHOLD',
          protocol: 'Compound',
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {
            delegateAddress: `${mockDelegateAddress}`,
            levelName: 'proposal',
            minAmountCOMP: `${minProposalVotes.toString()}`,
            delegateCOMPBalance: `${currCOMPOwned.toString()}`,
          },
        },
      );

      expect(finding).toStrictEqual([expectedProposalFinding]);
    });

    it('returns two findings if a delegate balance crosses the threshold level for both proposal and quorum', async () => {
      // use minQuorumVotes + 1
      const currCOMPOwned = BigNumber.sum(minQuorumVotes, 1);
      // add the decimals back on before submitting
      mockGovContract.balanceOf.mockResolvedValue(currCOMPOwned.multipliedBy(decimals));

      const log = createLog(
        compERC20Interface.getEvent(delegateEventName),
        {
          delegate: mockDelegateAddress,
          previousBalance: 0,
          newBalance: currCOMPOwned.multipliedBy(decimals).toString(),
        },
        { address: compERC20Address }, // input involved address for .filterLog()
      );

      mockTxEvent.logs = [log];
      const expectedProposalFinding = Finding.fromObject(
        {
          name: 'Compound Governance Delegate Threshold Alert',
          description: `The address ${mockDelegateAddress} has been delegated enough COMP token to pass the minimum threshold for the governance event: proposal`,
          alertId: 'AE-COMP-GOVERNANCE-DELEGATE-THRESHOLD',
          protocol: 'Compound',
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {
            delegateAddress: `${mockDelegateAddress}`,
            levelName: 'proposal',
            minAmountCOMP: `${minProposalVotes.toString()}`,
            delegateCOMPBalance: `${currCOMPOwned.toString()}`,
          },
        },
      );

      const expectedQuorumFinding = Finding.fromObject(
        {
          name: 'Compound Governance Delegate Threshold Alert',
          description: `The address ${mockDelegateAddress} has been delegated enough COMP token to pass the minimum threshold for the governance event: votingQuorum`,
          alertId: 'AE-COMP-GOVERNANCE-DELEGATE-THRESHOLD',
          protocol: 'Compound',
          severity: FindingSeverity.High,
          type: FindingType.Suspicious,
          metadata: {
            delegateAddress: `${mockDelegateAddress}`,
            levelName: 'votingQuorum',
            minAmountCOMP: `${minQuorumVotes.toString()}`,
            delegateCOMPBalance: `${currCOMPOwned.toString()}`,
          },
        },
      );

      const finding = await handleTransaction(mockTxEvent);
      expect(finding).toStrictEqual([expectedProposalFinding, expectedQuorumFinding]);
    });
  });
});
