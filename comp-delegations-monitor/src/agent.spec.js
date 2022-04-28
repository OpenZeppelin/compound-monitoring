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

const mockERC20Contract = {
  decimals: jest.fn().mockResolvedValue(mockDecimals),
  balanceOf: jest.fn(),
  proposalThreshold: jest.fn().mockResolvedValue(mockMinProposal),
  quorumVotes: jest.fn().mockResolvedValue(mockMinQuorum),
};

// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  ethers: {
    ...jest.requireActual('ethers'),
  },
}));

const {
  ethers,
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
} = require('forta-agent');

const config = require('../agent-config.json');

const compERC20Abi = require('../abi/CompERC20.json');

const { provideInitialize, provideHandleTransaction } = require('./agent');

// create COMP token interface from Abi
const iface = new ethers.utils.Interface(compERC20Abi);

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
    let inittializeData;
    let handleTransaction;
    let mockTxEvent;

    const mockDelegateAddress = '0x1212121212121212121212121212121212121212';
    const delegateEventName = 'DelegateVotesChanged';


    beforeEach(async () => {
      inittializeData = {};

      // initialize handler
      await (provideInitialize(inittializeData))();
      handleTransaction = provideHandleTransaction(inittializeData);

      // create empty transaction event to populate
      mockTxEvent = createTransactionEvent({});
    });

    it('returns no findings if no delegate event was emitted and no interaction with the COMP token occurred', async () => {

    });

    it('returns no findings if no delegate event was emitted, but transaction involed the COMP token address', async () => {

    })

    it('returns no findings if a delegate event occured with the COMP token, but threshold level was not crossed', async () => {

    })

    it('returns a finding if a delegate event occured with the COMP token and threshold level was crossed', async () => {
      
    })
  })
});
