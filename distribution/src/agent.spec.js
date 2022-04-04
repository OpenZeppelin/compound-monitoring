const mockContract = {
  compAccrued: jest.fn(),
  decimals: jest.fn().mockResolvedValue(18),
};

// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersProvider: jest.fn(),
  ethers: {
    ...jest.requireActual('ethers'),
    Contract: jest.fn().mockReturnValue(mockContract),
  },
}));

const BigNumber = require('bignumber.js');
const {
  TransactionEvent, ethers,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize, createDistributionAlert } = require('./agent');
const { createMockEventLogs } = require('./test-utils');
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
    txObject.receipt,
    [],
    txObject.addresses,
    txObject.block,
  );
  return txEvent;
}

// check the configuration file to verify the values
describe('check agent configuration file', () => {
  describe('procotolName key required', () => {
    const { protocolName } = config;
    expect(typeof (protocolName)).toBe('string');
    expect(protocolName).not.toBe('');
  });

  describe('protocolAbbreviation key required', () => {
    const { protocolAbbreviation } = config;
    expect(typeof (protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  describe('developerAbbreviation key required', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  describe('contracts key required', () => {
    const { contracts } = config;
    expect(typeof (contracts)).toBe('object');
    expect(contracts).not.toBe({});
  });

  describe('contracts key values must be valid', () => {
    const { contracts } = config;

    const { Comptroller, CompoundToken } = contracts;
    expect(typeof (Comptroller)).toBe('object');
    expect(Comptroller).not.toBe({});

    expect(typeof (CompoundToken)).toBe('object');
    expect(CompoundToken).not.toBe({});

    const { abiFile, address: ComptrollerAddress } = Comptroller;
    const { address: CompoundTokenAddress } = CompoundToken;

    // check that the address is a valid address
    expect(ethers.utils.isHexString(ComptrollerAddress, 20)).toBe(true);
    // check that the address is a valid address
    expect(ethers.utils.isHexString(CompoundTokenAddress, 20)).toBe(true);

    // call getAbi to check for the existence of the ABI file specified in the config file, the call
    // to getAbi will fail if the file does not exist
    getAbi(abiFile);
  });
});

// tests
describe('monitor compound for distribution bugs', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;
    let validComptrollerAddress;
    let ComptrollerAbi;
    let ComptrollerIface;

    let mockTxEvent;

    beforeEach(async () => {
      initializeData = {};

      ComptrollerAbi = getAbi(config.contracts.Comptroller.abiFile);
      ComptrollerIface = new ethers.utils.Interface(ComptrollerAbi);

      // initialize the handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      validComptrollerAddress = config.contracts.Comptroller.address;

      mockTxEvent = createTransactionEvent({
        transaction: {
          to: '0x123',
        },
        receipt: {
          logs: [],
        },
        block: { number: 1 },
      });
    });

    it('returns empty findings if no distribution events were emitted in the transaction', async () => {
      mockTxEvent.transaction.to = validComptrollerAddress;

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if distribution events from the wrong address were emitted in the transaction', async () => {
      mockTxEvent.transaction.to = validComptrollerAddress;

      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');
      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface);

      const distLog = {
        address: `0x1${'0'.repeat(39)}`,
        topics: distEvent.mockTopics,
        args: distEvent.mockArgs,
        data: distEvent.data,
        signature: distEventAbi.format(ethers.utils.FormatTypes.minimal).substring(6),
      };

      mockTxEvent.receipt.logs.push(distLog);

      const prevAmount = new BigNumber('100').toString();

      mockContract.compAccrued.mockReturnValueOnce(prevAmount);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if distribution was within the threshold', async () => {
      mockTxEvent.transaction.to = validComptrollerAddress;

      // set the threshold
      initializeData.compDistributionThreshold = 100;

      // create a compDelta amount just under the threshold
      const multiplier = ethers.BigNumber.from(10).pow(18);
      const override = { compDelta: ethers.BigNumber.from(99).mul(multiplier) };
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');
      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface, override);

      const distLog = {
        address: validComptrollerAddress,
        topics: distEvent.mockTopics,
        args: distEvent.mockArgs,
        data: distEvent.data,
        signature: distEventAbi.format(ethers.utils.FormatTypes.minimal).substring(6),
      };

      mockTxEvent.receipt.logs.push(distLog);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns findings if contract address matches and monitored event was emitted', async () => {
      mockTxEvent.transaction.to = validComptrollerAddress;

      // set the threshold
      initializeData.compDistributionThreshold = 100;

      // create a compDelta amount just over the threshold
      const multiplier = ethers.BigNumber.from(10).pow(18);
      const distributionAmount = ethers.BigNumber.from(101).mul(multiplier);
      const distributionReceiver = `0x4${'0'.repeat(39)}`;
      const override = {
        compDelta: distributionAmount,
        supplier: distributionReceiver,
      };
      const distEventAbi = ComptrollerIface.getEvent('DistributedSupplierComp');
      const distEvent = createMockEventLogs(distEventAbi, ComptrollerIface, override);

      const distLog = {
        address: validComptrollerAddress,
        topics: distEvent.mockTopics,
        args: distEvent.mockArgs,
        data: distEvent.data,
        signature: distEventAbi.format(ethers.utils.FormatTypes.minimal).substring(6),
      };

      mockTxEvent.receipt.logs.push(distLog);

      const findings = await handleTransaction(mockTxEvent);

      const multiplierBN = new BigNumber(multiplier.toString());
      const distributionAmountBN = new BigNumber(distributionAmount.toString()).div(multiplierBN);

      const expectedFinding = createDistributionAlert(
        initializeData.protocolName,
        initializeData.protocolAbbreviation,
        initializeData.developerAbbreviation,
        distributionAmountBN,
        distributionReceiver,
        initializeData.compDistributionThreshold,
      );

      expect(findings).toStrictEqual([expectedFinding]);
    });
  });
});
