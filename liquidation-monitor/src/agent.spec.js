const BigNumber = require('bignumber.js');

const minLiquidationInUSD = 500;

// Simulated prices of:
//   BTC = $30,000
//   ETH = $3,000
//   USDC = $1
// Bot prices are tracked in ETH denomination.
// Ref: https://docs.1inch.io/docs/spot-price-aggregator/examples
const mockBtcPrice = '100000000000000000000000000000'; // 1 BTC = 10 ETH
const mockEthPrice = '1000000000000000000'; // 1 ETH = 1 ETH
const mockUsdcPrice = '330000000000000000000000000'; // 1 USDC = 0.00033 ETH
const mockCDecimals = 8;
const mockBtcDecimals = 8;
const mockEthDecimals = 18;
const mockUsdcDecimals = 6;
const mockBorrower = '0x1111';

// https://compound.finance/docs/comptroller#get-assets-in
const mockGetAssetsIn = ['0x0cbtc', '0x0ceth'];

// Ref https://compound.finance/docs/comptroller#collateral-factor
const mockBtcCollateralFactor = '700000000000000000'; // 70%
const mockEthCollateralFactor = '850000000000000000'; // 85%
const mockUsdcCollateralFactor = '800000000000000000'; // 80%

// Ref: https://compound.finance/docs/ctokens#exchange-rate
const mockBtcCTokenRate = '20000000000000000'; // 1 cBTC = 0.02 BTC
const mockEthCTokenRate = '200000000000000000000000000'; // 1 cETH = 0.02 ETH
const mockUsdcCTokenRate = '200000000000000'; // 1 cUSDC = 0.02 USDC

// In this mock, ETH Collateral Factor is 0.85 and 1 BTC = 10 ETH.
// Starting data with a user that supplied 10 ETH and borrowed 0.85 BTC.
// Therefore, 10 ETH * 0.85 Collateral Factor = 8.5 ETH Collateral Value
// and .85 BTC = 8.5 ETH Borrowed Value.
// 8.5 ETH Collateral Value / 8.5 ETH Borrowed Value = 1.0 Health Factor
// Ref: https://compound.finance/docs/api#account-service
const mockCompoundData = {
  accounts: [
    {
      address: '0x1111',
      block_updated: null,
      health: {
        value: '1.0',
      },
      tokens: [
        {
          address: '0x0cbtc',
          borrow_balance_underlying: {
            value: '0.85',
          },
        },
        {
          address: '0x0ceth',
          supply_balance_underlying: {
            value: '10.0',
          },
        },
      ],
    },
  ],
  pagination_summary: {
    total_entries: 1,
  },
};
const mockCompoundResponse = {
  data: mockCompoundData,
};

jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue(mockCompoundResponse),
}));
const axios = require('axios');

const mockContract = {
  // Comptroller
  getAssetsIn: jest.fn(),
  markets: jest.fn(), // returns collateral factor
  getAccountLiquidity: jest.fn(),
  // OneInch
  getRateToEth: jest.fn(),
  // ERC20
  decimals: jest.fn(),
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
    Contract: jest.fn().mockReturnValue(mockContract),
  },
}));

const {
  ethers, Finding, FindingType, FindingSeverity,
} = require('forta-agent');
const config = require('../bot-config.json');

const {
  provideInitialize, provideHandleBlock, createAlert,
} = require('./agent');

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

describe('mock axios POST request', () => {
  it('should call axios.post and return a response', async () => {
    const response = await axios.post('https://...');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(response.data.pagination_summary.total_entries).toEqual(1);

    // reset call count for next test
    axios.post.mockClear();
    expect(axios.post).toHaveBeenCalledTimes(0);
  });
});

// Mock helper function
function setDefaultMocks() {
  // Set all default mocks

  // Compound API
  axios.post.mockResolvedValue(mockCompoundResponse);

  const {
    getAssetsIn,
    markets,
    getAccountLiquidity,
    getRateToEth,
    decimals,
    getAccountSnapshot,
    symbol,
    underlying,
    exchangeRateStored,
  } = mockContract;

  // Comptroller
  /* eslint-disable new-cap */
  getAssetsIn.mockResolvedValue(mockGetAssetsIn);
  markets.mockResolvedValue(true, new ethers.BigNumber.from(mockBtcCollateralFactor), true);
  getAccountLiquidity.mockResolvedValue(0, 0, new ethers.BigNumber.from(0));
  // OneInch
  getRateToEth.mockResolvedValue(new ethers.BigNumber.from(mockCDecimals));
  // ERC20
  decimals.mockResolvedValue(new ethers.BigNumber.from(mockBtcDecimals));
  getAccountSnapshot.mockResolvedValue(
    0, new ethers.BigNumber.from(0), new ethers.BigNumber.from(0), 0,
  );
  symbol.mockResolvedValue('TOKEN');
  underlying.mockResolvedValue('0x0');
  exchangeRateStored.mockResolvedValue(new ethers.BigNumber.from(mockBtcCTokenRate));

  // Clear Mock counters before calling initialize
  axios.post.mockClear();
  symbol.mockClear();
  underlying.mockClear();
  exchangeRateStored.mockClear();
  decimals.mockClear();
}

function setVerifyTokenMocks(setSymbol, setUnderlying, setExchange, setDecimals) {
  // Verify token MockOnce - BTC then ETH
  const {
    decimals,
    symbol,
    underlying,
    exchangeRateStored,
  } = mockContract;

  symbol.mockResolvedValueOnce(setSymbol);
  underlying.mockResolvedValueOnce(setUnderlying);
  exchangeRateStored.mockResolvedValue(new ethers.BigNumber.from(setExchange));
  decimals.mockResolvedValue(new ethers.BigNumber.from(mockCDecimals))
    .mockResolvedValue(new ethers.BigNumber.from(setDecimals));
}

// agent tests
describe('initializeData', () => {
  let initializeData = {};

  beforeEach(async () => {
    // Initialize
    initializeData = {};
    setDefaultMocks();
    setVerifyTokenMocks('cBTC', '0x0wbtc', mockBtcCTokenRate, mockBtcDecimals);
    setVerifyTokenMocks('cETH', '0x0weth', mockEthCTokenRate, mockEthDecimals);
    await (provideInitialize(initializeData))();
  });

  it('should use axios 2 times}', async () => {
    // Check counter from the initialize step.
    expect(axios.post).toBeCalledTimes(2);
  });

  it('should use contract calls}', async () => {
    // Check counters from the initialize step.
    expect(mockContract.symbol).toBeCalledTimes(2);
    expect(mockContract.underlying).toBeCalledTimes(2);
    expect(mockContract.exchangeRateStored).toBeCalledTimes(2);
    expect(mockContract.decimals).toBeCalledTimes(4);
  });

  it('should set user data', async () => {
    // In the compound API mock, the user supplied 0.85 BTC, and borrowed 10 ETH.
    //  to account for interest earned on supplied tokens, this is stored as cTokens.
    // "When a market is launched, the cToken exchange rate (how much ETH one cETH is worth) begins
    //  at 0.020000 — and increases at a rate equal to the compounding market interest rate"
    // Ref: https://compound.finance/docs/ctokens#introduction - Calculate Exchange Rate
    // In this example 10 ETH * (1 cWETH / 0.02 ETH) = 500 cETH.
    const actualSupply = initializeData.supply['0x0ceth']['0x1111'].toString();
    const expectedSupply = '500';
    const actualBorrow = initializeData.borrow['0x0cbtc']['0x1111'].toString();
    const expectedBorrow = '0.85';
    expect(actualSupply).toBe(expectedSupply);
    expect(actualBorrow).toBe(expectedBorrow);
  });
});

// Mock helper function
function setBlockMocks() {
  const {
    getAssetsIn,
    markets,
    getAccountLiquidity,
    getRateToEth,
    decimals,
    getAccountSnapshot,
    symbol,
    underlying,
    exchangeRateStored,
  } = mockContract;

  // Comptroller
  /* eslint-disable new-cap */
  getAssetsIn.mockResolvedValue(mockGetAssetsIn);
  markets.mockResolvedValue(true, new ethers.BigNumber.from(mockBtcCollateralFactor), true);
  getAccountLiquidity.mockResolvedValue(0, 0, new ethers.BigNumber.from(0));
  // OneInch
  getRateToEth.mockResolvedValue(new ethers.BigNumber.from(mockCDecimals));
  // ERC20
  decimals.mockResolvedValue(new ethers.BigNumber.from(mockBtcDecimals));
  getAccountSnapshot.mockResolvedValue(
    0, new ethers.BigNumber.from(0), new ethers.BigNumber.from(0), 0,
  );
  symbol.mockResolvedValue('TOKEN');
  underlying.mockResolvedValue('0x0');
  exchangeRateStored.mockResolvedValue(new ethers.BigNumber.from(mockBtcCTokenRate));

  // Verify token MockOnce - BTC then ETH
  symbol.mockResolvedValueOnce('cBTC').mockResolvedValueOnce('cETH');
  underlying.mockResolvedValueOnce('0x0wbtc').mockResolvedValueOnce('0x0weth');
  exchangeRateStored.mockResolvedValue(new ethers.BigNumber.from(mockBtcCTokenRate))
    .mockResolvedValue(new ethers.BigNumber.from(mockEthCTokenRate));
  decimals.mockResolvedValue(new ethers.BigNumber.from(mockCDecimals))
    .mockResolvedValue(new ethers.BigNumber.from(mockBtcDecimals))
    .mockResolvedValue(new ethers.BigNumber.from(mockCDecimals))
    .mockResolvedValue(new ethers.BigNumber.from(mockEthDecimals));

  // Clear Mock counters before calling initialize
  axios.post.mockClear();
  symbol.mockClear();
  underlying.mockClear();
  exchangeRateStored.mockClear();
  decimals.mockClear();
}

describe('handleBlock', () => {
  let initializeData = {};

  beforeEach(async () => {
    // Initialize
    initializeData = {};
    setDefaultMocks();
    setVerifyTokenMocks('cBTC', '0x0wbtc', mockBtcCTokenRate, mockBtcDecimals);
    setVerifyTokenMocks('cETH', '0x0weth', mockEthCTokenRate, mockEthDecimals);
    await (provideInitialize(initializeData))();

    // Process the first block to establish prices and health
    // Set block mocks
    
    await (provideHandleBlock(initializeData))();
  });
  it('should use axios 2 times}', async () => {
    // Check counter from the initialize step.
    expect(axios.post).toBeCalledTimes(2);
  });
});


// it('returns no findings if borrowed asset increases and remains below minimumLiquidation threshold', async () => {
//   // Borrowed BTC increases 1% in value
//   data.tokens['0xBTC'] = { price: mockBtcPrice * 1.01 };
//   const findings = handleMockBlockEvent();
//   expect(findings).toStrictEqual([]);
// });

// it('returns findings if borrowed asset increases and account exceeds the minimumLiquidation threshold', async () => {
//   // Borrowed BTC increases 2% in value
//   data.tokens['0xBTC'] = { price: mockBtcPrice * 1.02 };
//   const borrowerAddress = mockBorrower;
//   const liquidationAmount = '713.01';
//   const shortfallAmount = '727.27';
//   const healthFactor = '0.98';

//   const expectedFinding = Finding.fromObject({
//     name: `${data.protocolName} Liquidation Threshold Alert`,
//     description: `The address ${mockBorrower} has dropped below the liquidation threshold. `
//       + `The account may be liquidated for: $${liquidationAmount} USD`,
//     alertId: `${data.developerAbbreviation}-${data.protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
//     type: FindingType[data.alert.type],
//     severity: FindingSeverity[data.alert.severity],
//     protocol: data.protocolName,
//     metadata: {
//       borrowerAddress,
//       liquidationAmount,
//       shortfallAmount,
//       healthFactor,
//     },
//   });

//   // Process Block
//   const findings = handleMockBlockEvent();
//   expect(findings).toStrictEqual([expectedFinding]);
// });

// it('returns no findings if borrowed asset decreases and remains below minimumLiquidation threshold', async () => {
//   // Borrowed BTC decreases 1% in value
//   data.tokens['0xBTC'] = { price: mockBtcPrice * 0.99 };
//   const findings = handleMockBlockEvent();
//   expect(findings).toStrictEqual([]);
// });

// it('returns no findings if supplied asset decreases and remains below minimumLiquidation threshold', async () => {
//   // Supplied ETH decreases 1% in value
//   data.tokens['0xETH'] = { price: mockEthPrice * 0.99 };
//   const findings = handleMockBlockEvent();
//   expect(findings).toStrictEqual([]);
// });

// it('returns findings if supplied asset decreases and account exceeds the minimumLiquidation threshold', async () => {
//   // Supplied ETH decreases 2% in value
//   data.tokens['0xETH'] = { price: mockEthPrice * 0.98 };
//   const borrowerAddress = mockBorrower;
//   const liquidationAmount = '712.73';
//   const shortfallAmount = '727.27';
//   const healthFactor = '0.98';

//   const expectedFinding = Finding.fromObject({
//     name: `${data.protocolName} Liquidation Threshold Alert`,
//     description: `The address ${mockBorrower} has dropped below the liquidation threshold. `
//       + `The account may be liquidated for: $${liquidationAmount} USD`,
//     alertId: `${data.developerAbbreviation}-${data.protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
//     type: FindingType[data.alert.type],
//     severity: FindingSeverity[data.alert.severity],
//     protocol: data.protocolName,
//     metadata: {
//       borrowerAddress,
//       liquidationAmount,
//       shortfallAmount,
//       healthFactor,
//     },
//   });

//   const findings = handleMockBlockEvent();
//   expect(findings).toStrictEqual([expectedFinding]);
// });

// it('returns no findings if supplied asset decreases and remains below minimumLiquidation threshold', async () => {
//   // Supplied ETH decreases 1% in value
//   data.tokens['0xBTC'] = { price: mockEthPrice * 1.01 };
//   const findings = handleMockBlockEvent();
//   expect(findings).toStrictEqual([]);
// });
