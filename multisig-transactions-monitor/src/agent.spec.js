const {
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
  ethers,
} = require('forta-agent');

// require the bot
const { provideHandleTransaction, provideInitialize } = require('./agent');

const config = require('../bot-config.json');

const utils = require('./utils');

// check config file
describe('check bot configuration file', () => {
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
    const { comptroller } = contracts;

    expect(typeof (comptroller)).toBe('object');
    expect(comptroller).not.toBe({});

    const { address, events } = comptroller;

    // check that the address is a valid address
    expect(ethers.utils.isHexString(address, 20)).toBe(true);

    // check that there are events
    expect(events).not.toBe([]);
  });
});

// addresses and abi for each contract
const multisigAddress = '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c';
const govAddress = '0xc0Da02939E1441F497fd74F78cE7Decb17B66529';
const comptrollerAddress = '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B';
const cometAddress = '0xc3d688B66703497DAA19211EEdff47f25384cdc3';
const multisigAbi = utils.getAbi(config.contracts.multisig.abiFile);
const governanceAbi = utils.getAbi(config.contracts.governance.abiFile);
const comptrollerAbi = utils.getAbi(config.contracts.comptroller.abiFile);
const cometAbi = utils.getAbi(config.contracts.comet_usdc.abiFile);

// create interfaces from abi
const multisigInterface = new ethers.utils.Interface(multisigAbi.abi);
const governanceInterface = new ethers.utils.Interface(governanceAbi.abi);
const comptrollerInterface = new ethers.utils.Interface(comptrollerAbi.abi);
const cometInterface = new ethers.utils.Interface(cometAbi.abi);

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

describe('monitor multisig contract transactions', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;
    let mockTxEvent;

    // monitored events
    const multisigValidEventName = 'AddedOwner';
    const governanceValidEventName = 'NewAdmin';
    const comptrollerValidEventName = 'NewPauseGuardian';
    const cometValidEventName = 'PauseAction';

    // random address to pass in as an argument for test cases
    const testArgumentAddress = '0xa7EbE1285383bf567818EB6622e52782845C0bE2';

    beforeEach(async () => {
      initializeData = {};

      // initialize handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      // create empty transaction event to populate
      mockTxEvent = createTransactionEvent({});
    });

    it('returns empty findings if multisig was not involved in a a transaction', async () => {
      mockTxEvent.addresses[ethers.constants.AddressZero] = true;
      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if multisig was involved in a transaction, but no monitored events were emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;
      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    // tests for multisig events
    it('returns findings if multisig was involved in a transaction and the AddedOwner multisig event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use AddedOwner event to test
      const log = createLog(
        multisigInterface.getEvent(multisigValidEventName),
        { owner: zeroAddress },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Owner Added',
        description: `Address ${zeroAddress} was added as an owner`,
        alertId: 'AE-COMP-MULTISIG-OWNER-ADDED-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          owner: zeroAddress,
          multisigAddress,
          protocolVersion: undefined,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the ApproveHash event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use AddedOwner event to test
      const log = createLog(
        multisigInterface.getEvent('ApproveHash'),
        { owner: zeroAddress, approvedHash: zeroHash },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Approved Hash',
        description: `Hash ${zeroHash} was approved`,
        alertId: 'AE-COMP-MULTISIG-APPROVED-HASH-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          owner: zeroAddress,
          multisigAddress,
          protocolVersion: undefined,
          approvedHash: zeroHash,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the ChangedMasterCopy event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use ChangedMasterCopy event to test
      const log = createLog(
        multisigInterface.getEvent('ChangedMasterCopy'),
        { masterCopy: zeroAddress },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Changed Master Copy',
        description: `Master Copy changes to ${zeroAddress}`,
        alertId: 'AE-COMP-MULTISIG-CHANGED-MASTER-COPY-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          masterCopy: zeroAddress,
          multisigAddress,
          protocolVersion: undefined,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the ChangedThreshold event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      const thresholdValue = ethers.BigNumber.from(0);

      // use ChangedThreshold event to test
      const log = createLog(
        multisigInterface.getEvent('ChangedThreshold'),
        { threshold: thresholdValue },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Changed Threshold',
        description: `Threshold Changed To ${thresholdValue}`,
        alertId: 'AE-COMP-MULTISIG-CHANGED-THRESHOLD-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          multisigAddress,
          protocolVersion: undefined,
          threshold: thresholdValue,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the DisabledModule event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use DisabledModule event to test
      const log = createLog(
        multisigInterface.getEvent('DisabledModule'),
        { module: zeroAddress },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Disabled Module',
        description: `Disabled Module ${zeroAddress}`,
        alertId: 'AE-COMP-MULTISIG-DISABLED-MODULE-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          multisigAddress,
          protocolVersion: undefined,
          module: zeroAddress,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the EnabledModule event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use EnabledModule event to test
      const log = createLog(
        multisigInterface.getEvent('EnabledModule'),
        { module: zeroAddress },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Enabled Module',
        description: `Enabled Module ${zeroAddress}`,
        alertId: 'AE-COMP-MULTISIG-ENABLED-MODULE-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          multisigAddress,
          protocolVersion: undefined,
          module: zeroAddress,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the ExecutionFailure event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      const paymentValue = ethers.BigNumber.from(0);

      // use ExecutionFailure event to test
      const log = createLog(
        multisigInterface.getEvent('ExecutionFailure'),
        { txHash: zeroHash, payment: paymentValue },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Execution Failure',
        description: `Execution Failed For Transaction Hash ${zeroHash}`,
        alertId: 'AE-COMP-MULTISIG-EXECUTION-FAILURE-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          multisigAddress,
          protocolVersion: undefined,
          txHash: zeroHash,
          payment: paymentValue,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the ExecutionFromModuleFailure event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use ExecutionFromModuleFailure event to test
      const log = createLog(
        multisigInterface.getEvent('ExecutionFromModuleFailure'),
        { module: zeroAddress },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Execution From Module Failure',
        description: `Execution From Module ${zeroAddress} Failed`,
        alertId: 'AE-COMP-MULTISIG-EXECUTION-FROM-MODULE-FAILURE-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          multisigAddress,
          protocolVersion: undefined,
          module: zeroAddress,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the ExecutionFromModuleSuccess event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use ExecutionFromModuleSuccess event to test
      const log = createLog(
        multisigInterface.getEvent('ExecutionFromModuleSuccess'),
        { module: zeroAddress },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Execution From Module Success',
        description: `Execution From Module ${zeroAddress} Succeeded`,
        alertId: 'AE-COMP-MULTISIG-EXECUTION-FROM-MODULE-SUCCESS-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          multisigAddress,
          protocolVersion: undefined,
          module: zeroAddress,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the ExecutionSuccess event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      const paymentValue = ethers.BigNumber.from(0);

      // use ExecutionSuccess event to test
      const log = createLog(
        multisigInterface.getEvent('ExecutionSuccess'),
        { txHash: zeroHash, payment: paymentValue },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Execution Success',
        description: `Execution Succeeded For Transaction Hash ${zeroHash}`,
        alertId: 'AE-COMP-MULTISIG-EXECUTION-SUCCESS-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          multisigAddress,
          protocolVersion: undefined,
          txHash: zeroHash,
          payment: paymentValue,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the RemovedOwner event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use RemovedOwner event to test
      const log = createLog(
        multisigInterface.getEvent('RemovedOwner'),
        { owner: zeroAddress },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Owner Removed',
        description: `Address ${zeroAddress} was removed as an owner`,
        alertId: 'AE-COMP-MULTISIG-OWNER-REMOVED-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          multisigAddress,
          protocolVersion: undefined,
          owner: zeroAddress,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns findings if multisig was involved in a transaction and the SignMsg event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use SignMsg event to test
      const log = createLog(
        multisigInterface.getEvent('SignMsg'),
        { msgHash: zeroHash },
        { address: multisigAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      const expectedFindings = Finding.fromObject({
        name: 'Compound Multisig Sign Message',
        description: `Message Signed, Hash ${zeroHash}`,
        alertId: 'AE-COMP-MULTISIG-SIGN-MESSAGE-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          multisigAddress,
          protocolVersion: undefined,
          msgHash: zeroHash,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns empty findings if multisig was not involved in a transaction, but a monitored gnosis multisig event was emitted', async () => {
      mockTxEvent.addresses[testArgumentAddress] = true;

      // use AddedOwner event to test
      const log = createLog(
        multisigInterface.getEvent(multisigValidEventName),
        { owner: zeroAddress },
        { address: testArgumentAddress },
      );
      mockTxEvent.logs = [log];

      // run bot with mock transaction event
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    // test for governance events
    it('returns findings if multisig was involved in a transaction and monitored governance event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;
      mockTxEvent.addresses[govAddress] = true;

      // use NewAdmin event to test
      const log = createLog(
        governanceInterface.getEvent(governanceValidEventName),
        { oldAmin: zeroAddress, newAdmin: testArgumentAddress },
        { address: govAddress },
      );
      mockTxEvent.logs = [log];

      const findings = await handleTransaction(mockTxEvent);
      const expectedFindings = Finding.fromObject({
        name: 'Compound New Admin',
        description: `Governance Admin changed from ${zeroAddress} to ${testArgumentAddress}`,
        alertId: 'AE-COMP-GOVERNANCE-NEW-ADMIN-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          oldAdmin: zeroAddress,
          newAdmin: testArgumentAddress,
          multisigAddress,
          protocolVersion: undefined,
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns empty findings if multisig was not involved in a transaction, but a monitored governance event was emitted', async () => {
      mockTxEvent.addresses[govAddress] = true;

      // use NewAdmin event to test
      const log = createLog(
        governanceInterface.getEvent(governanceValidEventName),
        { oldAmin: zeroAddress, newAdmin: testArgumentAddress },
        { address: govAddress },
      );
      mockTxEvent.logs = [log];

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    // test for comptroller events
    it('returns findings if multisig was involved in a transaction and monitored comptroller(Compound V2) event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;
      mockTxEvent.addresses[comptrollerAddress] = true;

      // use NewPauseGuardian event to test
      const log = createLog(
        comptrollerInterface.getEvent(comptrollerValidEventName),
        { oldPauseGuardian: testArgumentAddress, newPauseGuardian: zeroAddress },
        { address: comptrollerAddress },
      );

      mockTxEvent.logs = [log];

      const findings = await handleTransaction(mockTxEvent);
      const expectedFindings = Finding.fromObject({
        name: 'Compound New Pause Guardian',
        description: `Pause Guardian changed from ${testArgumentAddress} to ${zeroAddress}`,
        alertId: 'AE-COMP-NEW-PAUSE-GUARDIAN-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          oldPauseGuardian: testArgumentAddress,
          newPauseGuardian: zeroAddress,
          multisigAddress,
          protocolVersion: '2',
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    // test for detecting v2/v3 address in new proposals events
    it('returns findings if multisig was involved in a transaction and monitored a new proposal which includes v2/v3 addresses', async () => {
      mockTxEvent.addresses[multisigAddress] = true;

      // use NewPauseGuardian event to test
      const log = createLog(
        governanceInterface.getEvent('ProposalCreated'),
        {
          id: 1,
          proposer: multisigAddress,
          targets: [comptrollerAddress, cometAddress],
          values: [],
          signatures: [],
          calldatas: [],
          startBlock: 1,
          endBlock: 2,
          description: 'This proposal affects Compound v2 and v3.',
        },
        { address: govAddress },
      );

      mockTxEvent.logs = [log];

      const findings = await handleTransaction(mockTxEvent);
      const expectedFindings = Finding.fromObject({
        name: 'Compound Proposal Created',
        description: `Governance Proposal 1 was just created by multisig ${multisigAddress}`,
        alertId: 'AE-COMP-GOVERNANCE-PROPOSAL-CREATED-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          proposalId: '1',
          multisigAddress,
          protocolVersion: '2,3',
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns empty findings if multisig was not involved in a transaction, but a monitored comptroller(Compound V2) event was emitted', async () => {
      mockTxEvent.addresses[comptrollerAddress] = true;

      // use NewAdmin event to test
      const log = createLog(
        comptrollerInterface.getEvent(comptrollerValidEventName),
        { oldPauseGuardian: testArgumentAddress, newPauseGuardian: zeroAddress },
        { address: comptrollerAddress },
      );

      mockTxEvent.logs = [log];

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    // test for comptroller events
    it('returns findings if multisig was involved in a transaction and monitored comet(Compound V3) event was emitted', async () => {
      mockTxEvent.addresses[multisigAddress] = true;
      mockTxEvent.addresses[cometAddress] = true;

      // use PauseAction event to test
      const log = createLog(
        cometInterface.getEvent(cometValidEventName),
        {
          supplyPaused: true,
          transferPaused: true,
          withdrawPaused: false,
          absorbPaused: false,
          buyPaused: false,
        },
        { address: cometAddress },
      );
      mockTxEvent.logs = [log];

      const findings = await handleTransaction(mockTxEvent);
      const expectedFindings = Finding.fromObject({
        name: 'Compound Actions Paused',
        description: `Actions Supply,Transfer were Paused by multisig ${multisigAddress}`,
        alertId: 'AE-COMP-ACTION-PAUSED-ALERT',
        protocol: 'Compound',
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          actions: 'Supply,Transfer',
          multisigAddress,
          protocolVersion: '3',
        },
      });

      expect(findings).toStrictEqual([expectedFindings]);
    });

    it('returns empty findings if multisig was not involved in a transaction, but a monitored comet(Compound V3) event was emitted', async () => {
      mockTxEvent.addresses[comptrollerAddress] = true;

      // use PauseAction event to test
      const log = createLog(
        cometInterface.getEvent(cometValidEventName),
        {
          supplyPaused: true,
          transferPaused: true,
          withdrawPaused: false,
          absorbPaused: false,
          buyPaused: false,
        },
        { address: cometAddress },
      );

      mockTxEvent.logs = [log];

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });
  });
});
