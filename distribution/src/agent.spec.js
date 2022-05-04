const mockedGetContract = jest.fn();

// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersProvider: jest.fn(),
  ethers: {
    ...jest.requireActual('ethers'),
    Contract: mockedGetContract,
  },
}));

const {
  TransactionEvent, ethers, FindingType, FindingSeverity, Finding,
} = require('forta-agent');
const BigNumber = require('bignumber.js');

const {
  provideHandleTransaction,
  provideInitialize,
  createExceedsRatioThresholdDistributionAlert,
  createExceedsSaneDistributionAlert,
} = require('./agent');

const {
  createMockEventLogs,
} = require('./test-utils');

const { getAbi } = require('./utils');

const config = require('../agent-config.json');

// utility function specific for this test module
// we are intentionally not using the Forta SDK function due to issues with
// jest mocking the module and interfering with default function values
function createTransactionEvent(txObject) {
  const txEvent = new TransactionEvent(
    null,
    null,
    txObject.transaction,
    [],
    txObject.addresses,
    txObject.block,
    txObject.logs,
    null,
  );
  return txEvent;
}

describe('distribution agent tests', () => {
  let protocolName;
  let protocolAbbreviation;
  let developerAbbreviation;
  let contracts;
  let validReceiverAddress;
  let validComptrollerAddress;
  let validCompoundTokenAddress;
  let distributionThresholdPercent;
  let minimumDistributionAmount;
  let maximumSaneDistributionAmount;

  beforeAll(async () => {
    protocolName = config.protocolName;
    protocolAbbreviation = config.protocolAbbreviation;
    developerAbbreviation = config.developerAbbreviation;
    contracts = config.contracts;
    distributionThresholdPercent = config.distributionThresholdPercent;
    minimumDistributionAmount = config.minimumDistributionAmount;
    maximumSaneDistributionAmount = config.maximumSaneDistributionAmount;
    validComptrollerAddress = config.contracts.Comptroller.address.toLowerCase();
    validCompoundTokenAddress = config.contracts.CompoundToken.address.toLowerCase();

    validReceiverAddress = `0x1${'0'.repeat(39)}`;
  });

  // check the configuration file to verify the values
  describe('check agent configuration file', () => {
    it('protocolName key required', () => {
      expect(typeof (protocolName)).toBe('string');
      expect(protocolName).not.toBe('');
    });

    it('protocolAbbreviation key required', () => {
      expect(typeof (protocolAbbreviation)).toBe('string');
      expect(protocolAbbreviation).not.toBe('');
    });

    it('developerAbbreviation key required', () => {
      expect(typeof (developerAbbreviation)).toBe('string');
      expect(developerAbbreviation).not.toBe('');
    });

    it('contracts key required', () => {
      expect(typeof (contracts)).toBe('object');
      expect(contracts).not.toBe({});
    });

    it('contracts key values must be valid', () => {
      const { Comptroller } = contracts;
      expect(typeof (Comptroller)).toBe('object');
      expect(Comptroller).not.toBe({});

      const { abiFile: ComptrollerAbiFile, address: ComptrollerAddress } = Comptroller;

      // check that the address is a valid address
      expect(ethers.utils.isHexString(ComptrollerAddress, 20)).toBe(true);

      // load the ABI from the specified file
      // the call to getAbi will fail if the file does not exist
      const ComptrollerAbi = getAbi(ComptrollerAbiFile);
      expect(typeof ComptrollerAbi).toBe('object');
    });

    it('distribution threshold must be valid', () => {
      expect(typeof (distributionThresholdPercent)).toBe('string');
      expect(distributionThresholdPercent).not.toBe('');
    });

    it('minimum distribution amount must be valid', () => {
      expect(typeof (minimumDistributionAmount)).toBe('string');
      expect(minimumDistributionAmount).not.toBe('');
    });

    it('maximum sane distribution amount must be valid', () => {
      expect(typeof (maximumSaneDistributionAmount)).toBe('string');
      expect(maximumSaneDistributionAmount).not.toBe('');
    });
  });

  describe('test finding creation', () => {
    it('returns a proper exceeds ratio threshold finding', () => {
      const amountCompDistributedBN = new BigNumber('300');
      const prevBlockCompAccruedBN = new BigNumber('100');
      const accruedToDistributedRatio = amountCompDistributedBN.div(
        prevBlockCompAccruedBN,
      ).times(100);

      const expectedFinding = Finding.fromObject({
        name: `${protocolName} Exceeds Ratio Threshold Distribution Event`,
        description: `Distributed ${accruedToDistributedRatio.toFixed(0)}% more COMP to ${validReceiverAddress} than expected`,
        alertId: `${developerAbbreviation}-${protocolAbbreviation}-EXCEEDS-RATIO-THRESHOLD-DISTRIBUTION-EVENT`,
        protocol: protocolName,
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          receiver: validReceiverAddress,
          compDistributed: amountCompDistributedBN.toString(),
          compAccrued: prevBlockCompAccruedBN.toString(),
        },
      });

      const finding = createExceedsRatioThresholdDistributionAlert(
        protocolName,
        protocolAbbreviation,
        developerAbbreviation,
        accruedToDistributedRatio,
        validReceiverAddress,
        amountCompDistributedBN.toString(),
        prevBlockCompAccruedBN.toString(),
      );

      expect(finding).toStrictEqual(expectedFinding);
    });

    it('returns a proper exceeds sane distribution finding', () => {
      const amountCompDistributedBN = new BigNumber('20000');

      const expectedFinding = Finding.fromObject({
        name: `${protocolName} Exceeds Sane Distribution Event`,
        description: `Distribution of ${amountCompDistributedBN.toString()} COMP to ${validReceiverAddress} exceeds ${maximumSaneDistributionAmount}`,
        alertId: `${developerAbbreviation}-${protocolAbbreviation}-EXCEEDS-SANE-DISTRIBUTION-EVENT`,
        protocol: protocolName,
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        metadata: {
          receiver: validReceiverAddress,
          compDistributed: amountCompDistributedBN.toString(),
        },
      });

      const finding = createExceedsSaneDistributionAlert(
        protocolName,
        protocolAbbreviation,
        developerAbbreviation,
        maximumSaneDistributionAmount,
        validReceiverAddress,
        amountCompDistributedBN.toString(),
      );

      expect(finding).toStrictEqual(expectedFinding);
    });
  });

  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;

    let ComptrollerAbi;
    let ComptrollerIface;
    let TransferAbi;
    let TransferIface;
    let compoundTokenDecimalsMultiplier;

    let mockCompoundTokenContract;
    let mockComptrollerContract;
    let mockTxEvent;

    const invalidAddress = `0x9${'0'.repeat(39)}`;

    beforeEach(async () => {
      initializeData = {};

      ComptrollerAbi = getAbi(config.contracts.Comptroller.abiFile);
      ComptrollerIface = new ethers.utils.Interface(ComptrollerAbi);

      TransferAbi = {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            name: 'from',
            type: 'address',
          },
          {
            indexed: true,
            name: 'to',
            type: 'address',
          },
          {
            indexed: false,
            name: 'value',
            type: 'uint256',
          },
        ],
        name: 'Transfer',
        type: 'event',
      };
      TransferIface = new ethers.utils.Interface([TransferAbi]);

      mockComptrollerContract = {
        compAccrued: jest.fn(),
      };

      mockComptrollerContract.compAccrued.mockReset();

      mockedGetContract.mockReturnValueOnce(mockComptrollerContract);

      mockCompoundTokenContract = {
        decimals: jest.fn().mockResolvedValue(18),
      };

      mockedGetContract.mockReturnValueOnce(mockCompoundTokenContract);

      // initialize the handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      compoundTokenDecimalsMultiplier = initializeData.compoundTokenDecimalsMultiplier;

      mockTxEvent = createTransactionEvent({
        logs: [],
        block: { number: 1 },
      });
    });

    it('returns empty findings if no distribution events were emitted in the transaction', async () => {
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if distribution events from the wrong address were emitted in the transaction', async () => {
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');
      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface);

      const distLog = {
        address: invalidAddress,
        topics: distEvent.mockTopics,
        data: distEvent.data,
      };

      mockTxEvent.logs.push(distLog);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if the transfer event is from the wrong address', async () => {
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');
      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface);

      const distLog = {
        address: validComptrollerAddress,
        topics: distEvent.mockTopics,
        data: distEvent.data,
      };

      mockTxEvent.logs.push(distLog);

      const distributionAmount = new BigNumber('300').times(compoundTokenDecimalsMultiplier);

      const override = {
        from: invalidAddress,
        to: validReceiverAddress,
        value: distributionAmount.toString(),
      };

      const transferEventAbi = TransferIface.getEvent('Transfer');
      const transferEvent = createMockEventLogs(transferEventAbi, TransferIface, override);

      const transferLog = {
        address: validCompoundTokenAddress,
        topics: transferEvent.mockTopics,
        data: transferEvent.data,
      };

      mockTxEvent.logs.push(transferLog);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if distribution was below the minimum amount', async () => {
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');
      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface);

      const distLog = {
        address: validComptrollerAddress,
        topics: distEvent.mockTopics,
        data: distEvent.data,
      };

      mockTxEvent.logs.push(distLog);

      const distributionAmount = new BigNumber('10').times(compoundTokenDecimalsMultiplier);

      const override = {
        from: validComptrollerAddress,
        to: validReceiverAddress,
        value: distributionAmount.toString(),
      };

      const transferEventAbi = TransferIface.getEvent('Transfer');
      const transferEvent = createMockEventLogs(transferEventAbi, TransferIface, override);

      const transferLog = {
        address: validCompoundTokenAddress,
        topics: transferEvent.mockTopics,
        data: transferEvent.data,
      };

      mockTxEvent.logs.push(transferLog);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if previous accrued amount was zero', async () => {
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');
      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface);

      const distLog = {
        address: validComptrollerAddress,
        topics: distEvent.mockTopics,
        data: distEvent.data,
      };

      mockTxEvent.logs.push(distLog);

      const distributionAmount = new BigNumber('100').times(compoundTokenDecimalsMultiplier);

      const override = {
        from: validComptrollerAddress,
        to: validReceiverAddress,
        value: distributionAmount.toString(),
      };

      const transferEventAbi = TransferIface.getEvent('Transfer');
      const transferEvent = createMockEventLogs(transferEventAbi, TransferIface, override);

      const transferLog = {
        address: validCompoundTokenAddress,
        topics: transferEvent.mockTopics,
        data: transferEvent.data,
      };

      mockTxEvent.logs.push(transferLog);

      const prevAmount = new BigNumber(0);

      mockComptrollerContract.compAccrued.mockResolvedValueOnce(prevAmount);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if distribution was within the threshold', async () => {
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');
      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface);

      const distLog = {
        address: validComptrollerAddress,
        topics: distEvent.mockTopics,
        data: distEvent.data,
      };

      mockTxEvent.logs.push(distLog);

      const distributionAmount = new BigNumber('100').times(compoundTokenDecimalsMultiplier);

      const override = {
        from: validComptrollerAddress,
        to: validReceiverAddress,
        value: distributionAmount.toString(),
      };

      const transferEventAbi = TransferIface.getEvent('Transfer');
      const transferEvent = createMockEventLogs(transferEventAbi, TransferIface, override);

      const transferLog = {
        address: validCompoundTokenAddress,
        topics: transferEvent.mockTopics,
        data: transferEvent.data,
      };

      mockTxEvent.logs.push(transferLog);

      const prevAmount = new BigNumber('1').times(compoundTokenDecimalsMultiplier);

      mockComptrollerContract.compAccrued.mockResolvedValueOnce(prevAmount);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns findings if the distribution exceeds the sane amount', async () => {
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');
      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface);

      const distLog = {
        address: validComptrollerAddress,
        topics: distEvent.mockTopics,
        data: distEvent.data,
      };

      mockTxEvent.logs.push(distLog);

      const distributionAmount = new BigNumber('2000').times(compoundTokenDecimalsMultiplier);

      const override = {
        from: validComptrollerAddress,
        to: validReceiverAddress,
        // We use .toFixed() here because createMockEventLogs uses ethers.BigNumber under the hood
        // and doesn't support converting numbers defined as string exponents which is what regular
        // BigNumber.js will output if you use .toString()
        value: distributionAmount.toFixed(),
      };

      const transferEventAbi = TransferIface.getEvent('Transfer');
      const transferEvent = createMockEventLogs(transferEventAbi, TransferIface, override);

      const transferLog = {
        address: validCompoundTokenAddress,
        topics: transferEvent.mockTopics,
        data: transferEvent.data,
      };

      mockTxEvent.logs.push(transferLog);

      const prevAmount = new BigNumber('2000').times(compoundTokenDecimalsMultiplier);

      mockComptrollerContract.compAccrued.mockResolvedValueOnce(prevAmount);

      const findings = await handleTransaction(mockTxEvent);

      const expectedFinding = createExceedsSaneDistributionAlert(
        initializeData.protocolName,
        initializeData.protocolAbbreviation,
        initializeData.developerAbbreviation,
        maximumSaneDistributionAmount,
        validReceiverAddress,
        distributionAmount.div(compoundTokenDecimalsMultiplier).toString(),
      );

      expect(findings).toStrictEqual([expectedFinding]);
    });

    it('returns findings if the ratio exceeds the threshold', async () => {
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');
      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface);

      const distLog = {
        address: validComptrollerAddress,
        topics: distEvent.mockTopics,
        data: distEvent.data,
      };

      mockTxEvent.logs.push(distLog);

      const distributionAmount = new BigNumber('300').times(compoundTokenDecimalsMultiplier);

      const override = {
        from: validComptrollerAddress,
        to: validReceiverAddress,
        value: distributionAmount.toString(),
      };

      const transferEventAbi = TransferIface.getEvent('Transfer');
      const transferEvent = createMockEventLogs(transferEventAbi, TransferIface, override);

      const transferLog = {
        address: validCompoundTokenAddress,
        topics: transferEvent.mockTopics,
        data: transferEvent.data,
      };

      mockTxEvent.logs.push(transferLog);

      const prevAmount = new BigNumber('100').times(compoundTokenDecimalsMultiplier);

      mockComptrollerContract.compAccrued.mockResolvedValueOnce(prevAmount);

      const findings = await handleTransaction(mockTxEvent);

      const expectedFinding = createExceedsRatioThresholdDistributionAlert(
        initializeData.protocolName,
        initializeData.protocolAbbreviation,
        initializeData.developerAbbreviation,
        distributionAmount.div(prevAmount).times(100),
        validReceiverAddress,
        distributionAmount.div(compoundTokenDecimalsMultiplier).toString(),
        prevAmount.div(compoundTokenDecimalsMultiplier).toString(),
      );

      expect(findings).toStrictEqual([expectedFinding]);
    });
  });
});
