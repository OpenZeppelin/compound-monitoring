// Configurable properties
// All prices are in ETH
const mockBTCprice = 11;
const mockETHprice = 1;
const mockUSDCprice = 0.00033;
// Same decimals for all tokens
const mockDecimals = 18;

const BigNumber = require('bignumber.js');
const config = require('../agent-config.json');
const {
  getAbi, callCompoundAPI, buildJsonRequest,
} = require('./utils');

const { provideHandleTransaction, provideInitialize, provideHandleBlock } = require('./agent');

const decimals = new BigNumber(10).pow(mockDecimals);

const mockComptrollerContract = {
  getAssetsIn: jest.fn().mockResolvedValue(mockDecimals),
  markets: jest.fn(), //returns collateral factor
  getAccountLiquidity: jest.fn(),
  quorumVotes: jest.fn(),
};

const mockOneInchContract = {
  getRateToEth: jest.fn(),
};

const mockERC20Contract = {
  decimals: jest.fn().mockResolvedValue(mockDecimals),
  getAccountSnapshot: jest.fn(),
  symbol: jest.fn(),
  underlying: jest.fn(),
  exchangeRateStored: jest.fn(),
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
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
  ethers,
} = require('forta-agent');

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





describe('high tether transfer agent', () => {
  describe('handleTransaction', () => {
    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.filterLog = jest.fn();

    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
    });

    it('returns empty findings if there are no Tether transfers', async () => {
      mockTxEvent.filterLog.mockReturnValue([]);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
      expect(mockTxEvent.filterLog).toHaveBeenCalledTimes(1);
      expect(mockTxEvent.filterLog).toHaveBeenCalledWith(
        ERC20_TRANSFER_EVENT,
        TETHER_ADDRESS,
      );
    });

    it('returns a finding if there is a Tether transfer over 10,000', async () => {
      const mockTetherTransferEvent = {
        args: {
          from: '0xabc',
          to: '0xdef',
          value: ethers.BigNumber.from('20000000000'), // 20k with 6 decimals
        },
      };
      mockTxEvent.filterLog.mockReturnValue([mockTetherTransferEvent]);

      const findings = await handleTransaction(mockTxEvent);

      const normalizedValue = mockTetherTransferEvent.args.value.div(
        10 ** TETHER_DECIMALS,
      );
      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'High Tether Transfer',
          description: `High amount of USDT transferred: ${normalizedValue}`,
          alertId: 'FORTA-1',
          severity: FindingSeverity.Low,
          type: FindingType.Info,
          metadata: {
            to: mockTetherTransferEvent.args.to,
            from: mockTetherTransferEvent.args.from,
          },
        }),
      ]);
      expect(mockTxEvent.filterLog).toHaveBeenCalledTimes(1);
      expect(mockTxEvent.filterLog).toHaveBeenCalledWith(
        ERC20_TRANSFER_EVENT,
        TETHER_ADDRESS,
      );
    });
  });
});
