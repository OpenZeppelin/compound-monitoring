const {
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
  ethers,
} = require('forta-agent');

// require the agent
const { provideHandleTransaction, provideInitialize } = require('./agent');

const config = require('../agent-config.json');

const utils = require('./utils.js');

// check config file
describe('check agent configuration file', () => {
  it('has a protocolName', () => {
    const { protocolName } = config;
    expect(typeof (protocolName)).toBe('string');
    expect(protocolName).not.toBe('');
  });

  it('has a protocolAbbreviation', () => {
    const { protocolAbbreviation } = config;
    expect(typeof (protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  it('has a developerAbbreviation', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  it('has a multisig key and values', () => {
    const { contracts } = config;
    const { multisig } = contracts;

    expect(typeof (multisig)).toBe('object');
    expect(multisig).not.toBe({});

    const { address, events } = multisig;

    // check that the address is a valid address
    expect(ethers.utils.isHexString(address, 20)).toBe(true);

    // check that there are events
    expect(events).not.toBe([]);
  });

  it('has a governance key and values', () => {
    const { contracts } = config;
    const { governance } = contracts;

    expect(typeof (governance)).toBe('object');
    expect(governance).not.toBe({});

    const { address, events } = governance;

    // check that the address is a valid address
    expect(ethers.utils.isHexString(address, 20)).toBe(true);

    // check that there are events
    expect(events).not.toBe([]);
  });

  it('has a comptroller key and values', () => {
    const { contracts } = config;
    const { governance } = contracts;

    expect(typeof (governance)).toBe('object');
    expect(governance).not.toBe({});

    const { address, events } = governance;

    // check that the address is a valid address
    expect(ethers.utils.isHexString(address, 20)).toBe(true);

    // check that there are events
    expect(events).not.toBe([]);
  });
});

const multisigAddress = '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c'.toLowerCase();
const multisigAbi = utils.getAbi(config.contracts.multisig.abiFile);
const governanceAbi = utils.getAbi(config.contracts.governance.abiFile);
const comptrollerAbi = utils.getAbi(config.contracts.comptroller.abiFile);

const multisigInterface = new ethers.utils.Interface(multisigAbi.abi);
const governanceInterface = new ethers.utils.Interface(governanceAbi.abi);
const comptrollerInterface = new ethers.utils.Interface(comptrollerAbi.abi);

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

describe('monitor multisig contract transactions', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;
    let mockTxEvent;
    let mulitsigValidEvent;
    let governanceValidEvent;
    let comptrollerValidEvent;
    const multisigValidEventName = 'AddedOwner';
    const governanceValidEventName = 'ProposalCreated';
    const comptrollerValidEventName = 'NewPauseGuardian';

    beforeEach(async () => {
      initializeData = {};

      // initialize handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      mockTxEvent = createTransactionEvent({});
    });

    xit('returns empty findings if multisig was not involed in a a tranasction', async () => {
      mockTxEvent.addresses[ethers.constants.AddressZero] = true;
      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    xit('returns empty findings if multisig was involved in a transaction, but no monitored events were emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;
      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    it('returns findings if multisig was involed in a transaction and monitored multisig event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use AddedOwner event to test
      const log = createLog(
        multisigInterface.getEvent(multisigValidEventName),
        { owner: multisigAddress },
        { address: zeroAddress },
      );
      let data = log.data
      // let decodedData = ethers.utils.defaultAbiCoder.decode(['string'], data)
      console.log("data here", data)


      mockTxEvent.logs = [log];
      console.log("log here", log)

      // run agent with mock transaction event
      const findings = await handleTransaction(mockTxEvent);
    });

    xit('returns findings if multisig was involed in a transaction and monitored governance event was emitted', async () => {
      
    })

    xit('returns findings if multisig was involed in a transaction and monitored comptroller event was emitted', async () => {
      
    })
  });
});
