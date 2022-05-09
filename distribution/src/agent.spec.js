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
  createExceedsSaneDistributionAlert,
} = require('./agent');

const {
  createMockEventLogs,
} = require('./test-utils');

const { getAbi } = require('./utils');

const config = require('../bot-config.json');

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

describe('distribution bot tests', () => {
  let protocolName;
  let protocolAbbreviation;
  let developerAbbreviation;
  let contracts;
  let maliciousAddress;
  let validComptrollerAddress;
  let validCTokenAddress;
  let maximumSaneDistributionAmount;

  beforeAll(async () => {
    protocolName = config.protocolName;
    protocolAbbreviation = config.protocolAbbreviation;
    developerAbbreviation = config.developerAbbreviation;
    contracts = config.contracts;
    maximumSaneDistributionAmount = config.maximumSaneDistributionAmount;
    validComptrollerAddress = config.contracts.Comptroller.address.toLowerCase();

    maliciousAddress = `0x1${'0'.repeat(39)}`;
    validCTokenAddress = `0x5${'0'.repeat(39)}`;
  });

  // check the configuration file to verify the values
  describe('check bot configuration file', () => {
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
      const { Comptroller, CompoundToken } = contracts;
      expect(typeof (Comptroller)).toBe('object');
      expect(Comptroller).not.toBe({});

      expect(typeof (CompoundToken)).toBe('object');
      expect(CompoundToken).not.toBe({});

      const { abiFile: ComptrollerAbiFile, address: ComptrollerAddress } = Comptroller;
      const { address: CompoundTokenAddress } = CompoundToken;

      // check that the Comptroller address is a valid address
      expect(ethers.utils.isHexString(ComptrollerAddress, 20)).toBe(true);

      // check that the CompoundToken address is a valid address
      expect(ethers.utils.isHexString(CompoundTokenAddress, 20)).toBe(true);

      // load the ABI from the specified file
      // the call to getAbi will fail if the file does not exist
      const ComptrollerAbi = getAbi(ComptrollerAbiFile);
      expect(typeof ComptrollerAbi).toBe('object');
    });

    it('maximum sane distribution amount must be valid', () => {
      expect(typeof (maximumSaneDistributionAmount)).toBe('string');
      expect(maximumSaneDistributionAmount).not.toBe('');
    });
  });

  describe('test finding creation', () => {
    it('returns a proper exceeds sane distribution finding', () => {
      const amountCompDistributedBN = new BigNumber('20000');
      const compIndex = new BigNumber('1000000000');

      const expectedFinding = Finding.fromObject({
        name: `${protocolName} Exceeds Sane Distribution Event`,
        description: `Distribution of ${amountCompDistributedBN.toString()} COMP to ${maliciousAddress} exceeds ${maximumSaneDistributionAmount}`,
        alertId: `${developerAbbreviation}-${protocolAbbreviation}-EXCEEDS-SANE-DISTRIBUTION-EVENT`,
        protocol: protocolName,
        type: FindingType.Info,
        severity: FindingSeverity.Info,
        addresses: [
          validCTokenAddress,
          maliciousAddress,
        ],
        metadata: {
          compDelta: amountCompDistributedBN.toString(),
          compIndex: compIndex.toString(),
        },
      });

      const finding = createExceedsSaneDistributionAlert(
        protocolName,
        protocolAbbreviation,
        developerAbbreviation,
        maximumSaneDistributionAmount,
        validCTokenAddress,
        maliciousAddress,
        amountCompDistributedBN.toString(),
        compIndex.toString(),
      );

      expect(finding).toStrictEqual(expectedFinding);
    });
  });

  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;

    let ComptrollerAbi;
    let ComptrollerIface;
    let compoundTokenDecimalsMultiplier;

    let mockCompoundTokenContract;
    let mockComptrollerContract;
    let mockTxEvent;

    const invalidAddress = `0x9${'0'.repeat(39)}`;

    beforeEach(async () => {
      initializeData = {};

      ComptrollerAbi = getAbi(config.contracts.Comptroller.abiFile);
      ComptrollerIface = new ethers.utils.Interface(ComptrollerAbi);

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

    it('returns empty findings if distribution was within the threshold', async () => {
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');

      const distributionAmount = new BigNumber('100').times(compoundTokenDecimalsMultiplier);

      const override = {
        cToken: validCTokenAddress,
        supplier: maliciousAddress,
        compDelta: distributionAmount.toString(),
      };

      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface, override);

      const distLog = {
        address: validComptrollerAddress,
        topics: distEvent.mockTopics,
        data: distEvent.data,
      };

      mockTxEvent.logs.push(distLog);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns findings if the distribution exceeds the sane amount', async () => {
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');

      const distributionAmount = new BigNumber('2000').times(compoundTokenDecimalsMultiplier);
      const compIndex = new BigNumber(0);

      const override = {
        cToken: validCTokenAddress,
        supplier: maliciousAddress,
        // We use .toFixed() here because createMockEventLogs uses ethers.BigNumber under the hood
        // and doesn't support converting numbers defined as string exponents which is what regular
        // BigNumber.js will output if you use .toString()
        compDelta: distributionAmount.toFixed(),
        compSupplyIndex: compIndex.toFixed(),
      };

      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface, override);

      const distLog = {
        address: validComptrollerAddress,
        topics: distEvent.mockTopics,
        data: distEvent.data,
      };

      mockTxEvent.logs.push(distLog);

      const findings = await handleTransaction(mockTxEvent);

      const expectedFinding = createExceedsSaneDistributionAlert(
        initializeData.protocolName,
        initializeData.protocolAbbreviation,
        initializeData.developerAbbreviation,
        maximumSaneDistributionAmount,
        validCTokenAddress,
        maliciousAddress,
        distributionAmount.div(compoundTokenDecimalsMultiplier).toString(),
        compIndex.toString(),
      );

      expect(findings).toStrictEqual([expectedFinding]);
    });
  });
});
