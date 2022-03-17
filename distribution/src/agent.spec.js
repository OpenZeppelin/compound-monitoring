const mockContract = {
  compAccrued: jest.fn()
};

// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersProvider: jest.fn(),
  ethers: {
    ...jest.requireActual('ethers'),
    providers: {
      JsonRpcBatchProvider: jest.fn(),
    },
    Contract: jest.fn().mockReturnValue(mockContract),
  },
}));

const {
  TransactionEvent, ethers,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize, createDistributionAlert } = require('./agent');

const { getAbi } = require('./utils');

const config = require('../agent-config.json');
const { default: BigNumber } = require('bignumber.js');

// utility function specific for this test module
// we are intentionally not using the Forta SDK function due to issues with
// jest mocking the module and interfering with default function values
function createTransactionEvent(txObject) {
  const txEvent = new TransactionEvent(
    null,
    null,
    txObject.transaction,
    null,
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

    // load the ABI from the specified file
    // the call to getAbi will fail if the file does not exist
    const abi = getAbi(abiFile);
  });
});

// tests
describe('monitor compound for distribution bugs', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let handleTransaction;
    let validComptrollerAddress;
    let validCompoundTokenAddress;

    let mockTxEvent = createTransactionEvent({
      transaction: {
        to: "0x123"
      },
      block: { number: 1 }
    });

    mockTxEvent.filterLog = jest.fn();

    const contractName = 'Comptroller';

    beforeEach(async () => {
      initializeData = {};

      // initialize the handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      validComptrollerAddress = config.contracts.Comptroller.address;
      validCompoundTokenAddress = config.contracts.CompoundToken.address;

      mockTxEvent.filterLog.mockReset();
    });

    it('returns empty findings if contract address does not match', async () => {
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if no distribution events were emitted in the transaction', async () => {
      mockTxEvent.transaction.to = validComptrollerAddress;
      mockTxEvent.filterLog.mockReturnValueOnce([]);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if distribution was withing the threshold', async () => {
      mockTxEvent.transaction.to = validComptrollerAddress;

      const borrowEvent = {
        args: {
          cToken: "0x8888",
          borrower: "0x7777",
          compDelta: 0,
          compBorrowerIndex: 0,
        }
      };

      mockTxEvent.filterLog.mockReturnValueOnce([borrowEvent]);

      let amount = new BigNumber("100");

      const transferEvent = {
        args: {
          from: "0x5555",
          to: "0x4444",
          value: amount.toString(),
        }
      }

      mockTxEvent.filterLog.mockReturnValueOnce([transferEvent]);

      mockContract.compAccrued.mockReturnValueOnce(100);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns findings if contract address matches and monitored event was emitted', async () => {
      mockTxEvent.transaction.to = validComptrollerAddress;

      const borrowEvent = {
        args: {
          cToken: "0x8888",
          borrower: "0x7777",
          compDelta: 0,
          compBorrowerIndex: 0,
        }
      };

      mockTxEvent.filterLog.mockReturnValueOnce([borrowEvent]);

      let distributionAmount = new BigNumber("300");
      let distributionReceiver = "0x5555";

      const transferEvent = {
        args: {
          from: distributionReceiver,
          to: "0x4444",
          value: distributionAmount.toString(),
        }
      }

      
      mockTxEvent.filterLog.mockReturnValueOnce([transferEvent]);

      let prevAmount = new BigNumber("100").toString();

      mockContract.compAccrued.mockReturnValueOnce(prevAmount);

      const findings = await handleTransaction(mockTxEvent);

      const expectedFinding = createDistributionAlert(
        initializeData.protocolName,
        initializeData.protocolAbbreviation,
        initializeData.developerAbbreviation,
        distributionAmount.div(prevAmount).times(100),
        distributionReceiver,
        distributionAmount.toString(),
        prevAmount.toString()
      );

      expect(findings).toStrictEqual([expectedFinding]);
    });

  });
});
