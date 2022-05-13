const BigNumber = require('bignumber.js');

const minimumLiquidationInUSD = 500;
const lowHealthThreshold = 1.10;

// Simulated prices of:
//   BTC = $30,000
//   ETH = $3,000
//   USDC = $1
// Bot prices are tracked in ETH denomination.
// Ref: https://docs.1inch.io/docs/spot-price-aggregator/examples
let mockBtcPrice = '100000000000000000000000000000'; // 1 BTC = 10 ETH
let mockEthPrice = '10000000000000000000000000000'; // 1 ETH = 1 ETH
let mockUsdcPrice = '3300000000000000000000000'; // 1 USDC = 0.00033 ETH
let mockCDecimals = 8;
let mockBtcDecimals = 8;
let mockEthDecimals = 8;
let mockUsdcDecimals = 8;
const mockBorrower = '0x1111';

// https://compound.finance/docs/comptroller#get-assets-in
const mockGetAssetsIn = ['0x0cbtc', '0x0ceth'];

// Ref https://compound.finance/docs/comptroller#collateral-factor
let mockBtcCollateralFactor = '700000000000000000'; // 70%
let mockEthCollateralFactor = '850000000000000000'; // 85%
let mockUsdcCollateralFactor = '800000000000000000'; // 80%

// Ref: https://compound.finance/docs/ctokens#exchange-rate
let mockBtcCTokenRate = '20000000000000000'; // 1 cBTC = 0.02 BTC
let mockEthCTokenRate = '20000000000000000'; // 1 cETH = 0.02 ETH
let mockUsdcCTokenRate = '20000000000000000'; // 1 cUSDC = 0.02 USDC

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

// Convert the string numbers to ethers.BigNumber
/* eslint-disable new-cap */
mockBtcPrice = new ethers.BigNumber.from(mockBtcPrice);
mockEthPrice = new ethers.BigNumber.from(mockEthPrice);
mockUsdcPrice = new ethers.BigNumber.from(mockUsdcPrice);
mockCDecimals = new ethers.BigNumber.from(mockCDecimals);
mockBtcDecimals = new ethers.BigNumber.from(mockBtcDecimals);
mockEthDecimals = new ethers.BigNumber.from(mockEthDecimals);
mockUsdcDecimals = new ethers.BigNumber.from(mockUsdcDecimals);
mockBtcCollateralFactor = new ethers.BigNumber.from(mockBtcCollateralFactor);
mockEthCollateralFactor = new ethers.BigNumber.from(mockEthCollateralFactor);
mockUsdcCollateralFactor = new ethers.BigNumber.from(mockUsdcCollateralFactor);
mockBtcCTokenRate = new ethers.BigNumber.from(mockBtcCTokenRate);
mockEthCTokenRate = new ethers.BigNumber.from(mockEthCTokenRate);
mockUsdcCTokenRate = new ethers.BigNumber.from(mockUsdcCTokenRate);
const mockEthersZero = new ethers.BigNumber.from(0);

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

// Mock helper functions
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
  markets.mockResolvedValue([true, mockBtcCollateralFactor, true]);
  getAccountLiquidity.mockResolvedValue([mockEthersZero, mockEthersZero, mockEthersZero]);
  // OneInch
  getRateToEth.mockResolvedValue(mockBtcPrice);
  // ERC20
  decimals.mockResolvedValue(mockBtcDecimals);
  getAccountSnapshot.mockResolvedValue(
    [mockEthersZero, mockEthersZero, mockEthersZero, mockEthersZero],
  );
  symbol.mockResolvedValue('TOKEN');
  underlying.mockResolvedValue('0x0');
  exchangeRateStored.mockResolvedValue(mockBtcCTokenRate);

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
  exchangeRateStored.mockResolvedValueOnce(setExchange);
  decimals.mockResolvedValueOnce(mockCDecimals)
    .mockResolvedValueOnce(setDecimals);
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

  it('should set BTC token data', async () => {
    // Check BTC stats
    const actualBtcDecimals = initializeData.tokens['0x0cbtc'].tokenDecimals.toString();
    const expectedBtcDecimals = mockBtcDecimals.toString();
    const actualBtcCDecimals = initializeData.tokens['0x0cbtc'].tokenDecimals.toString();
    const expectedBtcCDecimals = mockCDecimals.toString();
    expect(actualBtcDecimals).toBe(expectedBtcDecimals);
    expect(actualBtcCDecimals).toBe(expectedBtcCDecimals);
  });

  it('should set ETH token data', async () => {
    // Check ETH stats
    const actualEthDecimals = initializeData.tokens['0x0ceth'].tokenDecimals.toString();
    const expectedEthDecimals = mockEthDecimals.toString();
    const actualEthCDecimals = initializeData.tokens['0x0ceth'].tokenDecimals.toString();
    const expectedEthCDecimals = mockCDecimals.toString();
    expect(actualEthDecimals).toBe(expectedEthDecimals);
    expect(actualEthCDecimals).toBe(expectedEthCDecimals);
  });
});

// Mock helper function
function setPriceMocks(setPrice, setCollateralFactor, setCTokenRate) {
  const {
    markets,
    getRateToEth,
    exchangeRateStored,
    getAccountLiquidity,
  } = mockContract;

  // Set the once mocks
  getRateToEth.mockResolvedValueOnce(setPrice);
  markets.mockResolvedValueOnce([true, setCollateralFactor, true]);
  exchangeRateStored.mockResolvedValueOnce(setCTokenRate);

  // Clear the counters
  getRateToEth.mockClear();
  markets.mockClear();
  exchangeRateStored.mockClear();
  getAccountLiquidity.mockClear();
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

    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    await (provideHandleBlock(initializeData))();
  });

  it('should use contract calls', async () => {
    // Check counters from the block / price update step.
    expect(mockContract.getRateToEth).toBeCalledTimes(2);
    expect(mockContract.markets).toBeCalledTimes(2);
    expect(mockContract.exchangeRateStored).toBeCalledTimes(2);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
  });

  it('should adjust token price and user balances when price increase', async () => {
    // BTC halves in value
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 200;
    const scale = 100;
    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    const expectedBtcPrice = '20'; // In ETH value
    const expectedUserBalance = '17';
    const expectedUserHealth = '0.5';
    // User borrowed BTC, so health is inversely affected by its price.

    multiplier = new ethers.BigNumber.from(multiplier);
    const newBtcPrice = mockBtcPrice.mul(multiplier).div(scale);

    // Mock and process new block
    setPriceMocks(newBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    await (provideHandleBlock(initializeData))();

    const { borrowBalance, health } = initializeData.accounts['0x1111'];
    const actualBtcPrice = initializeData.tokens['0x0cbtc'].price.toString();
    const actualUserBalance = borrowBalance.toString();
    const actualUserHealth = health.toString();

    expect(actualBtcPrice).toBe(expectedBtcPrice);
    expect(actualUserBalance).toBe(expectedUserBalance);
    expect(actualUserHealth).toBe(expectedUserHealth);
  });

  it('should adjust token price and user balances when price decreases', async () => {
    // BTC halves in value
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 50;
    const scale = 100;
    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    const expectedBtcPrice = '5'; // In ETH value
    const expectedUserBalance = '4.25';
    const expectedUserHealth = '2';
    // User borrowed BTC, so health is inversely affected by its price.

    multiplier = new ethers.BigNumber.from(multiplier);
    const newBtcPrice = mockBtcPrice.mul(multiplier).div(scale);

    // Mock and process new block
    setPriceMocks(newBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    await (provideHandleBlock(initializeData))();

    const { borrowBalance, health } = initializeData.accounts['0x1111'];
    const actualBtcPrice = initializeData.tokens['0x0cbtc'].price.toString();
    const actualUserBalance = borrowBalance.toString();
    const actualUserHealth = health.toString();

    expect(actualBtcPrice).toBe(expectedBtcPrice);
    expect(actualUserBalance).toBe(expectedUserBalance);
    expect(actualUserHealth).toBe(expectedUserHealth);
  });

  it('returns no findings if borrowed asset increases and remains below minimumLiquidation threshold', async () => {
    // BTC halves in value
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 50;
    const scale = 100;
    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    const expectedBtcPrice = '5'; // In ETH value
    // User borrowed BTC, so health is inversely affected by its price.
    const expectedUserHealth = '2';
    const expectedBorrowBalance = '4.25';
    const expectedSupplyBalance = '8.5'; // Supply is unchanged

    multiplier = new ethers.BigNumber.from(multiplier);
    const newBtcPrice = mockBtcPrice.mul(multiplier).div(scale);

    // Liquidity calculations using JS BigNumber
    let liquidity = new BigNumber(expectedBorrowBalance).minus(expectedSupplyBalance);
    if (liquidity.isNegative()) { liquidity = new BigNumber(0); }
    // Scale to 1e18 for mocking and convert to ethers.Bignumber
    liquidity = liquidity.times(scale).dp(0).toString(); // Scale out and remove decimals
    const e18Multiplier = new ethers.BigNumber.from(10).pow(18);
    liquidity = new ethers.BigNumber.from(liquidity).mul(e18Multiplier).div(scale);

    // Mock and process new block
    setPriceMocks(newBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity(
      [mockEthersZero, mockEthersZero, liquidity, mockEthersZero],
    );

    await (provideHandleBlock(initializeData))();

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualBtcPrice = initializeData.tokens['0x0cbtc'].price.toString();
    const actualBorrowBalance = borrowBalance.toString();
    const actualSupplyBalance = supplyBalance.toString();
    const actualUserHealth = health.toString();

    expect(actualBtcPrice).toBe(expectedBtcPrice);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
    expect(actualUserHealth).toBe(expectedUserHealth);
  });

  /*
  // Process the first block to establish prices and health
  // Set block mocks
  // If zero health accounts, getAssets in
  mockContract.getAssetsIn.mockResolvedValueOnce('');
  // VerifyToken if new token
  // setVerifyTokenMocks('cBTC', '0x0wbtc', mockBtcCTokenRate, mockBtcDecimals);
  // Get account snapshots for new accounts / tokens
  mockContract.getAccountSnapshot.mockResolvedValueOnce('');

  // Low health Mock
  mockContract.getAccountLiquidity.mockResolvedValueOnce('');
  */

  it('returns no findings if borrowed asset increases and remains below minimumLiquidation threshold', async () => {
    // Borrowed BTC increases 1% in value
    //  Using all JS BigNumbers in this section.
    const multiplier = new BigNumber(1.91);
    const newBTCPrice = new BigNumber(mockBtcPrice.toString()).times(multiplier);

    const { supplyBalance, borrowBalance } = initializeData.accounts['0x1111'];
    const newSupplyBalance = supplyBalance.times(multiplier);

    // Calculate shortfall amount
    let shortfall = new BigNumber(0);
    // let liquidationAmount = new ethers.BigNumber.from(0);
    if (borrowBalance.gt(newSupplyBalance)) {
      shortfall = borrowBalance.minus(newSupplyBalance);

      // Convert to USDC
      // Price in USDC to ETH, to convert ETH to USDC, the EthAmount needs to be divided by 
      //  the price. Also needs to be scaled my the 1inch multiplier.
      const oneInchMult = new BigNumber(10).pow(36 - mockUsdcDecimals).toString();
      shortfall = shortfall.dividedBy(mockUsdcPrice).times(oneInchMult);
    }

    // Mock shortfall amount
    mockContract.getAccountLiquidity(
      mockEthersZero, mockEthersZero, shortfall.shiftedBy(18), mockEthersZero,
    );

    // Mo
    let newBtcPrice = '110000000000000000000000000000'; // 1 BTC = 10 ETH
    newBtcPrice = new ethers.BigNumber.from(newBtcPrice);

    setPriceMocks(newBTCPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    // TS
    const { contract, ...other } = initializeData.tokens['0x0cbtc'];
    const findings = await (provideHandleBlock(initializeData))();
    const { contract: contract1, ...other1 } = initializeData.tokens['0x0cbtc'];

    expect(findings).toStrictEqual([]);
    expect(mockContract.exchangeRateStored).toBeCalledTimes(2);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
  });

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

});