const BigNumber = require('bignumber.js');

// Configurable properties
// All prices are in ETH
const mockBtcPrice = 11;
const mockEthPrice = 1;
const mockUsdcPrice = 0.00033;
// Same decimals for all tokens
const mockDecimals = 18;

const {
  ethers, TransactionEvent, Finding, FindingType, FindingSeverity,
} = require('forta-agent');
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
    Contract: jest.fn(), // .mockReturnValue(mockERC20Contract),
  },
}));

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
  it('developerAbbreviation key required', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

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

  it('liquidationMonitor key required', () => {
    const { liquidationMonitor } = config;
    expect(typeof (liquidationMonitor)).toBe('object');
    expect(liquidationMonitor).not.toBe({});
  });

  it('comptrollerAddress key required', () => {
    const { liquidationMonitor: { comptrollerAddress } } = config;
    expect(typeof (comptrollerAddress)).toBe('string');
    expect(comptrollerAddress).not.toBe('');
  });

  it('comptrollerABI key required', () => {
    const { liquidationMonitor: { comptrollerABI } } = config;
    expect(typeof (comptrollerABI)).toBe('string');
    expect(comptrollerABI).not.toBe('');
  });

  it('oneInchAddress key required', () => {
    const { liquidationMonitor: { oneInchAddress } } = config;
    expect(typeof (oneInchAddress)).toBe('string');
    expect(oneInchAddress).not.toBe('');
  });

  it('comptrollerAddress key required', () => {
    const { liquidationMonitor: { comptrollerAddress } } = config;
    expect(typeof (comptrollerAddress)).toBe('string');
    expect(comptrollerAddress).not.toBe('');
  });

  it('triggerLevels key required', () => {
    const { liquidationMonitor: { triggerLevels } } = config;
    expect(typeof (triggerLevels)).toBe('object');
    expect(triggerLevels).not.toBe({});
  });

  it('maximumHealth key required', () => {
    const { liquidationMonitor: { triggerLevels: { maximumHealth } } } = config;
    expect(typeof (maximumHealth)).toBe('number');
    expect(maximumHealth).not.toBe('');
  });

  it('minimumBorrowInETH key required', () => {
    const { liquidationMonitor: { triggerLevels: { minimumBorrowInETH } } } = config;
    expect(typeof (minimumBorrowInETH)).toBe('number');
    expect(minimumBorrowInETH).not.toBe('');
  });

  it('minimumLiquidationInUSD key required', () => {
    const { liquidationMonitor: { triggerLevels: { minimumLiquidationInUSD } } } = config;
    expect(typeof (minimumLiquidationInUSD)).toBe('number');
    expect(minimumLiquidationInUSD).not.toBe('');
  });

  it('lowHealthThreshold key required', () => {
    const { liquidationMonitor: { triggerLevels: { lowHealthThreshold } } } = config;
    expect(typeof (lowHealthThreshold)).toBe('number');
    expect(lowHealthThreshold).not.toBe('');
  });

  it('alert key required', () => {
    const { liquidationMonitor: { alert } } = config;
    expect(typeof (alert)).toBe('object');
    expect(alert).not.toBe({});
  });

  it('alert type value must be valid', () => {
    const { liquidationMonitor: { alert: { type } } } = config;
    expect(typeof (type)).toBe('string');
    expect(type).not.toBe('');
    // check type, this will fail if the value of type is not valid
    expect(Object.prototype.hasOwnProperty.call(FindingType, type)).toBe(true);
  });

  it('alert severity value must be valid', () => {
    const { liquidationMonitor: { alert: { severity } } } = config;
    expect(typeof (severity)).toBe('string');
    expect(severity).not.toBe('');
    // check severity, this will fail if the value of severity is not valid
    expect(Object.prototype.hasOwnProperty.call(FindingSeverity, severity)).toBe(true);
  });
});

// agent tests
// describe('handleTransaction', () => {
//   const {
//     developerAbbreviation,
//     protocolName,
//     protocolAbbreviation,
//     cCOMPAddress,
//     borrowLevels,
//   } = config;
//   const iface = new ethers.utils.Interface(mockERC20Contract);
//   const mockBorrowerAddress = '0x1212121212121212121212121212121212121212';
//   let initializeData;
//   let handleTransaction;

//   beforeEach(async () => {
//     initializeData = {};
//     // initialize the handler
//     await (provideInitialize(initializeData))();
//     handleTransaction = provideHandleTransaction(initializeData);
//     mockERC20Contract.balanceOf.mockReset();
//   });

//   it('returns no findings if no borrow event was emitted and no interaction with the cCOMP token occurred', async () => {
//     const mockReceipt = {
//       logs: [],
//     };
//     // create the mock txEvent
//     const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

//     // run the agent
//     const findings = await handleTransaction(txEvent);
//     expect(findings).toStrictEqual([]);
//     expect(mockERC20Contract.balanceOf).toHaveBeenCalledTimes(0);
//   });

//   it('returns no findings if an event other than the borrow event is emitted from the cCOMP token contract', async () => {
//     // build mock receipt for mock txEvent, in this case the log event topics will not correspond to
//     // the Borrow event so we should not expect to see a finding
//     const mockTopics = [
//       ethers.utils.id('mockEvent(indexed address)'),
//       ethers.utils.defaultAbiCoder.encode(
//         ['address'], ['0x1111111111111111111111111111111111111111'],
//       ),
//     ];
//     const mockReceipt = {
//       logs: [{
//         address: cCOMPAddress,
//         topics: mockTopics,
//         data: '0x',
//       }],
//     };

//     // create the mock txEvent
//     const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

//     // run the agent
//     const findings = await handleTransaction(txEvent);
//     expect(findings).toStrictEqual([]);
//     expect(mockERC20Contract.balanceOf).toHaveBeenCalledTimes(0);
//   });
// });
