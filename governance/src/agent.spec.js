const {
  Finding, createTransactionEvent, ethers, FindingType, FindingSeverity,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize, getAbi } = require('./agent');

const { createMockEventLogs, getObjectsFromAbi } = require('./test-utils');

const config = require('../bot-config.json');

const MINIMUM_EVENT_LIST = [
  'ProposalCreated',
  'VoteCast',
  'ProposalCanceled',
  'ProposalExecuted',
];

const validDelegateAddress = '0xea6C3Db2e7FCA00Ea9d7211a03e83f568Fc13BF7';
// check the configuration file to verify the values
describe('check bot configuration file', () => {
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

  it('governance key required', () => {
    const { governance } = config;
    expect(typeof (governance)).toBe('object');
    expect(governance).not.toBe({});
  });

  it('governance key values must be valid', () => {
    const { governance } = config;
    const { abiFile, address } = governance;

    // check that the address is a valid address
    expect(ethers.utils.isHexString(address, 20)).toBe(true);

    // load the ABI from the specified file
    // the call to getAbi will fail if the file does not exist
    const abi = getAbi(abiFile);

    // extract all of the event names from the ABI
    const events = getObjectsFromAbi(abi, 'event');

    // verify that at least the minimum list of supported events are present
    MINIMUM_EVENT_LIST.forEach((eventName) => {
      if (Object.keys(events).indexOf(eventName) === -1) {
        throw new Error(`ABI does not contain minimum supported event: ${eventName}`);
      }
    });
  });
});

const abi = getAbi(config.governance.abiFile);

const invalidEvent = {
  anonymous: false,
  inputs: [
    {
      indexed: false,
      internalType: 'uint256',
      name: 'testValue',
      type: 'uint256',
    },
  ],
  name: 'TESTMockEvent',
  type: 'event',
};
// push fake event to abi before creating the interface
abi.push(invalidEvent);
const iface = new ethers.utils.Interface(abi);

// tests
describe('monitor governance contracts for emitted events', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;
    let mockTxEvent;
    let validEvent;
    let secondValidEvent;
    let thirdValidEvent;
    let validContractAddress;
    const validEventName = 'ProposalCreated';
    const secondValidEventName = 'ProposalCanceled';
    const thirdValidEventName = 'VoteCast';
    const mockContractName = 'mockContractName';

    beforeEach(async () => {
      initializeData = {};

      // initialize the handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      validContractAddress = config.governance.address;

      const eventsInAbi = getObjectsFromAbi(abi, 'event');
      validEvent = eventsInAbi[validEventName];
      secondValidEvent = eventsInAbi[secondValidEventName];
      thirdValidEvent = eventsInAbi[thirdValidEventName];

      // initialize mock transaction event with default values
      mockTxEvent = createTransactionEvent({
        receipt: {
          logs: [
            {
              name: '',
              address: '',
              signature: '',
              topics: [],
              data: `0x${'0'.repeat(1000)}`,
              args: [],
            },
          ],
        },
      });
    });

    it('returns empty findings if no monitored events were emitted in the transaction', async () => {
      const findings = await handleTransaction(mockTxEvent);
      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if contract address does not match', async () => {
      // encode event data
      // valid event name with valid name, signature, topic, and args
      const {
        mockArgs,
        mockTopics,
        data,
      } = createMockEventLogs(validEvent, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = ethers.constants.AddressZero;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(validEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if contract address matches but no monitored event was emitted', async () => {
      // encode event data - invalid event with valid arguments
      const { mockArgs, mockTopics, data } = createMockEventLogs(invalidEvent, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(invalidEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns findings if contract address matches and monitored event was emitted', async () => {
      // encode event data - valid event with valid arguments
      const { mockArgs, mockTopics, data } = createMockEventLogs(validEvent, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(validEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(mockTxEvent);

      const proposal = {
        id: '0',
        _values: '0',
        calldatas: '0xff',
        description: 'test',
        endBlock: '0',
        startBlock: '0',
        targets: ethers.constants.AddressZero,
        proposer: ethers.constants.AddressZero,
        signatures: 'test',
      };
      const expectedFinding = Finding.fromObject({
        name: `${config.protocolName} Governance Proposal Created`,
        description: `Governance Proposal ${proposal.id} was just created`,
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-CREATED`,
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        protocol: config.protocolName,
        metadata: {
          address: validContractAddress,
          ...proposal,
        },
      });

      expect(findings).toStrictEqual([expectedFinding]);
    });

    it('returns finding with unknown proposal name if the ProposalCreated event was not observed (should only happen with initial deployment)', async () => {
      // create an event to run through the handler so we can see if the proposal name was saved
      const { mockArgs, mockTopics, data } = createMockEventLogs(secondValidEvent, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(secondValidEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const findings = await handleTransaction(mockTxEvent);

      const expectedFinding = Finding.fromObject({
        name: `${config.protocolName} Governance Proposal Canceled`,
        description: `Governance proposal ${defaultLog.args.id.toString()} has been canceled`,
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-CANCELED`,
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        protocol: config.protocolName,
        metadata: {
          address: validContractAddress,
          id: defaultLog.args.id.toString(),
          state: 'canceled',
          proposalName: '(unknown proposal name)',
        },
      });
      expect(findings).toStrictEqual([expectedFinding]);
    });

    it('returns finding with empty string for display name if no name was provided in cached data', async () => {
      // create an event to run through the handler so we can see if the proposal name was saved
      const { mockArgs, mockTopics, data } = createMockEventLogs(thirdValidEvent, iface);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;

      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(thirdValidEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      const voteInfo = {
        voter: mockArgs.voter,
        proposalId: mockArgs.proposalId.toString(),
        support: mockArgs.support,
        votes: mockArgs.votes.toString(),
        reason: mockArgs.reason,
      };

      const findings = await handleTransaction(mockTxEvent);

      const expectedFinding = Finding.fromObject({
        name: `${config.protocolName} Governance Proposal Vote Cast`,
        description: 'Vote cast with 0 votes against proposal 0',
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-VOTE-CAST`,
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        protocol: config.protocolName,
        metadata: {
          address: validContractAddress,
          displayName: '',
          id: voteInfo.proposalId,
          reason: voteInfo.reason,
          voter: voteInfo.voter,
          votes: voteInfo.votes,
          proposalName: '(unknown proposal name)',
        },
      });

      expect(findings).toStrictEqual([expectedFinding]);
    });

    it('returns finding with display name if name was provided in cached data', async () => {
      // create an event to run through the handler so we can see if the proposal name was saved
      const override = {
        name: 'voter',
        value: validDelegateAddress,
      };
      const { mockArgs, mockTopics, data } = createMockEventLogs(thirdValidEvent, iface, override);

      // update mock transaction event
      const [defaultLog] = mockTxEvent.receipt.logs;

      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.args.voter = validDelegateAddress;
      defaultLog.signature = iface
        .getEvent(thirdValidEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);
      const voteInfo = {
        voter: validDelegateAddress,
        proposalId: mockArgs.proposalId.toString(),
        support: mockArgs.support,
        votes: mockArgs.votes.toString(),
        reason: mockArgs.reason,
      };

      const findings = await handleTransaction(mockTxEvent);

      const expectedFinding = Finding.fromObject({
        name: `${config.protocolName} Governance Proposal Vote Cast`,
        description: 'Vote cast with 0 votes against proposal 0',
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-VOTE-CAST`,
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        protocol: config.protocolName,
        metadata: {
          address: validContractAddress,
          displayName: 'Polychain Capital',
          id: voteInfo.proposalId,
          reason: voteInfo.reason,
          voter: voteInfo.voter,
          votes: voteInfo.votes,
          proposalName: '(unknown proposal name)',
        },
      });

      expect(findings).toStrictEqual([expectedFinding]);
    });

    it('returns finding with proposal name if the ProposalCreated event was previously observed', async () => {
      // encode event data - valid event with valid arguments
      const proposalDescription = '# This is a super sweet proposal you should check out\nWords here describe the proposal';
      const override = {
        name: 'description',
        value: proposalDescription,
      };
      let { mockArgs, mockTopics, data } = createMockEventLogs(validEvent, iface, override);

      // update mock transaction event
      let [defaultLog] = mockTxEvent.receipt.logs;
      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(validEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      let findings = await handleTransaction(mockTxEvent);

      const proposal = {
        id: '0',
        _values: '0',
        calldatas: '0xff',
        description: proposalDescription,
        endBlock: '0',
        startBlock: '0',
        targets: ethers.constants.AddressZero,
        proposer: ethers.constants.AddressZero,
        signatures: 'test',
      };

      let expectedFinding = Finding.fromObject({
        name: `${config.protocolName} Governance Proposal Created`,
        description: `Governance Proposal ${proposal.id} was just created`,
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-CREATED`,
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        protocol: config.protocolName,
        metadata: {
          address: validContractAddress,
          ...proposal,
        },
      });

      expect(findings).toStrictEqual([expectedFinding]);

      // create an event to run through the handler so we can see if the proposal name was saved
      ({ mockArgs, mockTopics, data } = createMockEventLogs(secondValidEvent, iface));

      // update mock transaction event
      ([defaultLog] = mockTxEvent.receipt.logs);
      defaultLog.name = mockContractName;
      defaultLog.address = validContractAddress;
      defaultLog.topics = mockTopics;
      defaultLog.args = mockArgs;
      defaultLog.data = data;
      defaultLog.signature = iface
        .getEvent(secondValidEvent.name)
        .format(ethers.utils.FormatTypes.minimal)
        .substring(6);

      findings = await handleTransaction(mockTxEvent);

      const [shortDescription] = proposalDescription.split('\n');
      shortDescription.replaceAll('#', '').trim();

      expectedFinding = Finding.fromObject({
        name: `${config.protocolName} Governance Proposal Canceled`,
        description: `Governance proposal ${proposal.id} has been canceled`,
        alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-CANCELED`,
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        protocol: config.protocolName,
        metadata: {
          address: validContractAddress,
          id: mockArgs.id.toString(),
          state: 'canceled',
          proposalName: shortDescription,
        },
      });

      expect(findings).toStrictEqual([expectedFinding]);
    });
  });
});
