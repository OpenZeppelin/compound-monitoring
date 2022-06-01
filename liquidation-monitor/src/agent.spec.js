const BigNumber = require('bignumber.js');

const setMinimumLiquidationInUSD = 300;
const setLowHealthThreshold = 1.10;

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
const newBorrower = '0x2222222222222222222222222222222222222222';

// https://compound.finance/docs/comptroller#get-assets-in
const mockGetAssetsIn = ['0x0cbtc', '0x0ceth'];

// Ref https://compound.finance/docs/comptroller#collateral-factor
let mockBtcCollateralFactor = '700000000000000000'; // 70%
let mockEthCollateralFactor = '850000000000000000'; // 85%

// Ref: https://compound.finance/docs/ctokens#exchange-rate
let mockBtcCTokenRate = '20000000000000000'; // 1 cBTC = 0.02 BTC
let mockEthCTokenRate = '20000000000000000'; // 1 cETH = 0.02 ETH

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

const mockProvider = {
  getBlock: jest.fn(),
};

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
  getEthersProvider: jest.fn().mockReturnValue(mockProvider),
  ethers: {
    ...jest.requireActual('ethers'),
    Contract: jest.fn().mockReturnValue(mockContract),
  },
}));

const {
  ethers, Finding, FindingType, FindingSeverity, TransactionEvent, BlockEvent,
} = require('forta-agent');
const config = require('../bot-config.json');

const {
  provideInitialize, provideHandleBlock, provideHandleTransaction,
} = require('./agent');

// Convert the string numbers to ethers.BigNumber
mockBtcPrice = ethers.BigNumber.from(mockBtcPrice);
mockEthPrice = ethers.BigNumber.from(mockEthPrice);
mockUsdcPrice = ethers.BigNumber.from(mockUsdcPrice);
mockCDecimals = ethers.BigNumber.from(mockCDecimals);
mockBtcDecimals = ethers.BigNumber.from(mockBtcDecimals);
mockEthDecimals = ethers.BigNumber.from(mockEthDecimals);
mockUsdcDecimals = ethers.BigNumber.from(mockUsdcDecimals);
mockBtcCollateralFactor = ethers.BigNumber.from(mockBtcCollateralFactor);
mockEthCollateralFactor = ethers.BigNumber.from(mockEthCollateralFactor);
mockBtcCTokenRate = ethers.BigNumber.from(mockBtcCTokenRate);
mockEthCTokenRate = ethers.BigNumber.from(mockEthCTokenRate);
const mockEthersZero = ethers.BigNumber.from(0);

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

  // Used in getBlock.timestamp for the initial alert timer
  mockProvider.getBlock.mockResolvedValue({ timestamp: 1 });

  // Clear Mock counters before calling initialize
  axios.post.mockClear();
  symbol.mockClear();
  underlying.mockClear();
  exchangeRateStored.mockClear();
  decimals.mockClear();
  getAssetsIn.mockClear();
  mockProvider.getBlock.mockClear();
}

function setVerifyTokenMocks(setSymbol, setUnderlying, setExchange, setDecimals) {
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
  let initializeData;

  beforeEach(async () => {
    // Initialize
    initializeData = {};
    setDefaultMocks();
    setVerifyTokenMocks('cBTC', '0x0wbtc', mockBtcCTokenRate, mockBtcDecimals);
    setVerifyTokenMocks('cETH', '0x0weth', mockEthCTokenRate, mockEthDecimals);
    await (provideInitialize(initializeData))();
  });

  it('should use axios 2 times', async () => {
    // Check counter from the initialize step.
    expect(axios.post).toBeCalledTimes(2);
  });

  it('should use contract calls', async () => {
    // Check counters from the initialize step.
    //   Should setup the initial alert time
    expect(mockProvider.getBlock).toBeCalledTimes(1);
    expect(initializeData.nextAlertTime).toBe(86400);
    // Should check BTC and ETH symbol, underlying, rates, and decimals
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
    const actualBtcCDecimals = initializeData.tokens['0x0cbtc'].cTokenDecimals.toString();
    const expectedBtcCDecimals = mockCDecimals.toString();
    expect(actualBtcDecimals).toBe(expectedBtcDecimals);
    expect(actualBtcCDecimals).toBe(expectedBtcCDecimals);
  });

  it('should set ETH token data', async () => {
    // Check ETH stats
    const actualEthDecimals = initializeData.tokens['0x0ceth'].tokenDecimals.toString();
    const expectedEthDecimals = mockEthDecimals.toString();
    const actualEthCDecimals = initializeData.tokens['0x0ceth'].cTokenDecimals.toString();
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

function getShortFallUSD(borrowEth, supplyEth) {
  const scale = 1000;

  // Liquidity calculations using JS BigNumber
  let shortfall = new BigNumber(borrowEth).minus(supplyEth);
  if (shortfall.isNegative()) { shortfall = new BigNumber(0); }

  // Scale to 1e18 for mocking and convert to ethers.Bignumber
  shortfall = shortfall.times(scale).dp(0).toString(); // Scale out and remove decimals
  const e18Multiplier = ethers.BigNumber.from(10).pow(18);
  shortfall = ethers.BigNumber.from(shortfall).mul(e18Multiplier).div(scale);

  // Convert to USD price by dividing by the 1inch exchange rate for USDC.
  //  Also needs to be scaled by the 1inch multiplier.
  const oneInchMult = ethers.BigNumber.from(10).pow(36 - mockUsdcDecimals);
  shortfall = shortfall.mul(oneInchMult).div(mockUsdcPrice);
  return shortfall;
}

function mockBlock(mockTimestamp) {
  // create the mock blockEvent
  const block = { timestamp: mockTimestamp };
  const mockBlockEvent = new BlockEvent(null, null, block);
  return mockBlockEvent;
}

describe('handleBlock', () => {
  let initializeData;
  let handleBlock;
  let blockEvent;

  beforeEach(async () => {
    // Initialize
    initializeData = {};
    handleBlock = provideHandleBlock(initializeData);

    setDefaultMocks();
    setVerifyTokenMocks('cBTC', '0x0wbtc', mockBtcCTokenRate, mockBtcDecimals);
    setVerifyTokenMocks('cETH', '0x0weth', mockEthCTokenRate, mockEthDecimals);
    await (provideInitialize(initializeData))();

    // Replace the imported thresholds with the test ones.
    initializeData.minimumLiquidationInUSD = setMinimumLiquidationInUSD;
    initializeData.lowHealthThreshold = setLowHealthThreshold;

    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);

    // Initialize block time is 1 second since epoch. Then the next block is set for 15 seconds
    blockEvent = mockBlock(15);
    await handleBlock(blockEvent);
  });

  it('should use contract calls', async () => {
    // Check counters from the block / price update step.
    expect(mockContract.getRateToEth).toBeCalledTimes(2);
    expect(mockContract.markets).toBeCalledTimes(2);
    expect(mockContract.exchangeRateStored).toBeCalledTimes(2);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
  });

  it('should adjust token price and user balances when price increase', async () => {
    // BTC doubles in value
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 200;
    const scale = 100;

    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    // All expected are rounded to 2 decimal points
    const expectedBtcPrice = '20'; // In ETH value
    // User borrowed BTC, so health is inversely affected by its price.
    const expectedUserHealth = '0.5';
    const expectedBorrowBalance = '17';
    const expectedSupplyBalance = '8.5'; // Supply is unchanged

    multiplier = ethers.BigNumber.from(multiplier);
    const newBtcPrice = mockBtcPrice.mul(multiplier).div(scale);

    // Mock and process new block
    setPriceMocks(newBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    await handleBlock(blockEvent);

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualBtcPrice = initializeData.tokens['0x0cbtc'].price.dp(2).toString();
    const actualBorrowBalance = borrowBalance.dp(2).toString();
    const actualSupplyBalance = supplyBalance.dp(2).toString();
    const actualUserHealth = health.dp(2).toString();

    expect(actualBtcPrice).toBe(expectedBtcPrice);
    expect(actualUserHealth).toBe(expectedUserHealth);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
  });

  it('should adjust token price and user balances when price decreases', async () => {
    // BTC halves in value
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 50;
    const scale = 100;

    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    // All expected are rounded to 2 decimal points
    const expectedBtcPrice = '5'; // In ETH value
    // User borrowed BTC, so health is inversely affected by its price.
    const expectedUserHealth = '2';
    const expectedBorrowBalance = '4.25';
    const expectedSupplyBalance = '8.5'; // Supply is unchanged

    multiplier = ethers.BigNumber.from(multiplier);
    const newBtcPrice = mockBtcPrice.mul(multiplier).div(scale);

    // Mock and process new block
    setPriceMocks(newBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    await handleBlock(blockEvent);

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualBtcPrice = initializeData.tokens['0x0cbtc'].price.dp(2).toString();
    const actualBorrowBalance = borrowBalance.dp(2).toString();
    const actualSupplyBalance = supplyBalance.dp(2).toString();
    const actualUserHealth = health.dp(2).toString();

    expect(actualBtcPrice).toBe(expectedBtcPrice);
    expect(actualUserHealth).toBe(expectedUserHealth);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
  });

  it('returns no findings if borrowed asset decreases and remains below minimumLiquidation threshold', async () => {
    // Borrowed BTC decreases 1% in value
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 99;
    const scale = 100;

    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    // All expected are rounded to 2 decimal points
    const expectedBtcPrice = '9.9'; // In ETH value
    // User borrowed BTC, so health is inversely affected by its price.
    const expectedUserHealth = '1.01';
    const expectedBorrowBalance = '8.42';
    const expectedSupplyBalance = '8.5'; // Supply is unchanged

    multiplier = ethers.BigNumber.from(multiplier);
    const newBtcPrice = mockBtcPrice.mul(multiplier).div(scale);

    const shortfallUSD = getShortFallUSD(expectedBorrowBalance, expectedSupplyBalance);

    // Mock and process new block
    setPriceMocks(newBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    mockContract.getAccountLiquidity.mockClear();
    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    const findings = await handleBlock(blockEvent);

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualBtcPrice = initializeData.tokens['0x0cbtc'].price.dp(2).toString();
    const actualBorrowBalance = borrowBalance.dp(2).toString();
    const actualSupplyBalance = supplyBalance.dp(2).toString();
    const actualUserHealth = health.dp(2).toString();

    expect(actualBtcPrice).toBe(expectedBtcPrice);
    expect(actualUserHealth).toBe(expectedUserHealth);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
    expect(findings).toStrictEqual([]);
  });

  it('returns no findings if borrowed asset increases and health remains below minimumLiquidation threshold', async () => {
    // BTC increases by 1%
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 101;
    const scale = 100;

    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    // All expected are rounded to 2 decimal points
    const expectedBtcPrice = '10.1'; // In ETH value
    // User borrowed BTC, so health is inversely affected by its price.
    const expectedUserHealth = '0.99';
    const expectedBorrowBalance = '8.59';
    const expectedSupplyBalance = '8.5'; // Supply is unchanged

    multiplier = ethers.BigNumber.from(multiplier);
    const newBtcPrice = mockBtcPrice.mul(multiplier).div(scale);

    const shortfallUSD = getShortFallUSD(expectedBorrowBalance, expectedSupplyBalance);

    // Mock and process new block
    setPriceMocks(newBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    mockContract.getAccountLiquidity.mockClear();
    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    const findings = await handleBlock(blockEvent);

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualBtcPrice = initializeData.tokens['0x0cbtc'].price.dp(2).toString();
    const actualBorrowBalance = borrowBalance.dp(2).toString();
    const actualSupplyBalance = supplyBalance.dp(2).toString();
    const actualUserHealth = health.dp(2).toString();

    expect(actualBtcPrice).toBe(expectedBtcPrice);
    expect(actualUserHealth).toBe(expectedUserHealth);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
    expect(findings).toStrictEqual([]);
  });

  it('returns findings if borrowed asset increases and account exceeds the minimumLiquidation threshold', async () => {
    // BTC increases by 2%
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 102;
    const scale = 100;

    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    // All expected are rounded to 2 decimal points
    const expectedBtcPrice = '10.2'; // In ETH value
    // User borrowed BTC, so health is inversely affected by its price.
    const expectedUserHealth = '0.98';
    const expectedBorrowBalance = '8.67';
    const expectedSupplyBalance = '8.5'; // Supply is unchanged
    const expectedLiquidationAmount = '515.15';

    multiplier = ethers.BigNumber.from(multiplier);
    const newBtcPrice = mockBtcPrice.mul(multiplier).div(scale);

    const shortfallUSD = getShortFallUSD(expectedBorrowBalance, expectedSupplyBalance);

    // Mock and process new block
    setPriceMocks(newBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    mockContract.getAccountLiquidity.mockClear();
    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    const findings = await handleBlock(blockEvent);

    // Expected finding
    const borrowerAddress = mockBorrower;
    const liquidationAmount = expectedLiquidationAmount;
    const shortfallAmount = expectedLiquidationAmount;
    const healthFactor = expectedUserHealth;
    const expectedFinding = Finding.fromObject({
      name: `${initializeData.protocolName} Liquidation Threshold Alert`,
      description: `The address ${mockBorrower} has dropped below the liquidation threshold. `
        + `The account may be liquidated for: $${liquidationAmount} USD`,
      alertId: `${initializeData.developerAbbreviation}-${initializeData.protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
      type: FindingType[initializeData.alert.type],
      severity: FindingSeverity[initializeData.alert.severity],
      protocol: initializeData.protocolName,
      metadata: {
        borrowerAddress,
        liquidationAmount,
        shortfallAmount,
        healthFactor,
      },
    });

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualBtcPrice = initializeData.tokens['0x0cbtc'].price.dp(2).toString();
    const actualBorrowBalance = borrowBalance.dp(2).toString();
    const actualSupplyBalance = supplyBalance.dp(2).toString();
    const actualUserHealth = health.dp(2).toString();

    expect(actualBtcPrice).toBe(expectedBtcPrice);
    expect(actualUserHealth).toBe(expectedUserHealth);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
    expect(findings).toStrictEqual([expectedFinding]);
  });

  it('returns no findings if supplied asset increases and remains below minimumLiquidation threshold', async () => {
    // Supplied ETH increases 1% in value

    // This is an odd test since all token values are stored in ETH. But it is still a valid test.
    //   Imagine if wETH de-pegged a little and was trading against the actual ETH value. That is
    //   what this test is illustrating.

    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 101;
    const scale = 100;

    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    // All expected are rounded to 2 decimal points
    const expectedEthPrice = '1.01'; // In ETH value
    // User supplied ETH, so health is inversely affected by its price.
    const expectedUserHealth = '1.01';
    const expectedBorrowBalance = '8.5'; // Borrow is unchanged
    const expectedSupplyBalance = '8.59';

    multiplier = ethers.BigNumber.from(multiplier);
    const newEthPrice = mockEthPrice.mul(multiplier).div(scale);

    const shortfallUSD = getShortFallUSD(expectedBorrowBalance, expectedSupplyBalance);

    // Mock and process new block
    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(newEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    mockContract.getAccountLiquidity.mockClear();
    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    const findings = await handleBlock(blockEvent);

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualEthPrice = initializeData.tokens['0x0ceth'].price.dp(2).toString();
    const actualBorrowBalance = borrowBalance.dp(2).toString();
    const actualSupplyBalance = supplyBalance.dp(2).toString();
    const actualUserHealth = health.dp(2).toString();

    expect(actualEthPrice).toBe(expectedEthPrice);
    expect(actualUserHealth).toBe(expectedUserHealth);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
    expect(findings).toStrictEqual([]);
  });

  it('returns no findings if supplied asset decreases and remains below minimumLiquidation threshold', async () => {
    // Supplied ETH decreases 1% in value
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 99;
    const scale = 100;

    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    // All expected are rounded to 2 decimal points
    const expectedEthPrice = '0.99'; // In ETH value
    // User supplied ETH, so health is inversely affected by its price.
    const expectedUserHealth = '0.99';
    const expectedBorrowBalance = '8.5'; // Borrow is unchanged
    const expectedSupplyBalance = '8.42';

    multiplier = ethers.BigNumber.from(multiplier);
    const newEthPrice = mockEthPrice.mul(multiplier).div(scale);

    const shortfallUSD = getShortFallUSD(expectedBorrowBalance, expectedSupplyBalance);

    // Mock and process new block
    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(newEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    mockContract.getAccountLiquidity.mockClear();
    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    const findings = await handleBlock(blockEvent);

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualEthPrice = initializeData.tokens['0x0ceth'].price.dp(2).toString();
    const actualBorrowBalance = borrowBalance.dp(2).toString();
    const actualSupplyBalance = supplyBalance.dp(2).toString();
    const actualUserHealth = health.dp(2).toString();

    expect(actualEthPrice).toBe(expectedEthPrice);
    expect(actualUserHealth).toBe(expectedUserHealth);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
    expect(findings).toStrictEqual([]);
  });

  it('returns findings if supplied asset decreases and account exceeds the minimumLiquidation threshold', async () => {
    // Supplied ETH decreases 2% in value
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 98;
    const scale = 100;

    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    // All expected are rounded to 2 decimal points
    const expectedEthPrice = '0.98'; // In ETH value
    // User supplied ETH, so health is inversely affected by its price.
    const expectedUserHealth = '0.98';
    const expectedBorrowBalance = '8.5'; // Borrow is unchanged
    const expectedSupplyBalance = '8.33';
    const expectedLiquidationAmount = '515.15';

    multiplier = ethers.BigNumber.from(multiplier);
    const newEthPrice = mockEthPrice.mul(multiplier).div(scale);

    const shortfallUSD = getShortFallUSD(expectedBorrowBalance, expectedSupplyBalance);

    // Mock and process new block
    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(newEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    mockContract.getAccountLiquidity.mockClear();
    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    const findings = await handleBlock(blockEvent);

    // Expected finding
    const borrowerAddress = mockBorrower;
    const liquidationAmount = expectedLiquidationAmount;
    const shortfallAmount = expectedLiquidationAmount;
    const healthFactor = expectedUserHealth;
    const expectedFinding = Finding.fromObject({
      name: `${initializeData.protocolName} Liquidation Threshold Alert`,
      description: `The address ${mockBorrower} has dropped below the liquidation threshold. `
        + `The account may be liquidated for: $${liquidationAmount} USD`,
      alertId: `${initializeData.developerAbbreviation}-${initializeData.protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
      type: FindingType[initializeData.alert.type],
      severity: FindingSeverity[initializeData.alert.severity],
      protocol: initializeData.protocolName,
      metadata: {
        borrowerAddress,
        liquidationAmount,
        shortfallAmount,
        healthFactor,
      },
    });

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualEthPrice = initializeData.tokens['0x0ceth'].price.dp(2).toString();
    const actualBorrowBalance = borrowBalance.dp(2).toString();
    const actualSupplyBalance = supplyBalance.dp(2).toString();
    const actualUserHealth = health.dp(2).toString();

    expect(actualEthPrice).toBe(expectedEthPrice);
    expect(actualUserHealth).toBe(expectedUserHealth);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
    expect(findings).toStrictEqual([expectedFinding]);
  });

  it('returns no findings if the same account is alerted on in the following blocks within 24 hours', async () => {
    // Supplied ETH decreases 2% in value
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 98;
    const scale = 100;

    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    // All expected are rounded to 2 decimal points
    const expectedEthPrice = '0.98'; // In ETH value
    // User supplied ETH, so health is inversely affected by its price.
    const expectedUserHealth = '0.98';
    const expectedBorrowBalance = '8.5'; // Borrow is unchanged
    const expectedSupplyBalance = '8.33';
    const expectedLiquidationAmount = '515.15';

    multiplier = ethers.BigNumber.from(multiplier);
    const newEthPrice = mockEthPrice.mul(multiplier).div(scale);

    const shortfallUSD = getShortFallUSD(expectedBorrowBalance, expectedSupplyBalance);

    // Mock and process 2 new blocks
    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(newEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    mockContract.getAccountLiquidity.mockClear();
    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    // This block should alert
    let findings = await handleBlock(blockEvent);

    // Expected finding
    const borrowerAddress = mockBorrower;
    const liquidationAmount = expectedLiquidationAmount;
    const shortfallAmount = expectedLiquidationAmount;
    const healthFactor = expectedUserHealth;
    const expectedFinding = Finding.fromObject({
      name: `${initializeData.protocolName} Liquidation Threshold Alert`,
      description: `The address ${mockBorrower} has dropped below the liquidation threshold. `
        + `The account may be liquidated for: $${liquidationAmount} USD`,
      alertId: `${initializeData.developerAbbreviation}-${initializeData.protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
      type: FindingType[initializeData.alert.type],
      severity: FindingSeverity[initializeData.alert.severity],
      protocol: initializeData.protocolName,
      metadata: {
        borrowerAddress,
        liquidationAmount,
        shortfallAmount,
        healthFactor,
      },
    });

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualEthPrice = initializeData.tokens['0x0ceth'].price.dp(2).toString();
    const actualBorrowBalance = borrowBalance.dp(2).toString();
    const actualSupplyBalance = supplyBalance.dp(2).toString();
    const actualUserHealth = health.dp(2).toString();

    expect(actualEthPrice).toBe(expectedEthPrice);
    expect(actualUserHealth).toBe(expectedUserHealth);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
    expect(findings).toStrictEqual([expectedFinding]);

    // After that is all verified, process a new block without changing anything.
    // Start the block with a block timestamp of 45 seconds
    // Price and liquidity checks still happen every block, so mock them.
    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(newEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    blockEvent = mockBlock(45);
    findings = await handleBlock(blockEvent);
    // New finding should be empty because it was the same alert within 24 hours.
    expect(findings).toStrictEqual([]);
  });

  it('returns findings if the same account is alerted on in the following blocks after 24 hours', async () => {
    // Supplied ETH decreases 2% in value
    // Scaled to integer, because ethers.BigNumbers doesn't accept floats
    let multiplier = 98;
    const scale = 100;

    // Starting values are BtcPrice = 10, UserBalance = 8.5 and health = 1
    // All expected are rounded to 2 decimal points
    const expectedEthPrice = '0.98'; // In ETH value
    // User supplied ETH, so health is inversely affected by its price.
    const expectedUserHealth = '0.98';
    const expectedBorrowBalance = '8.5'; // Borrow is unchanged
    const expectedSupplyBalance = '8.33';
    const expectedLiquidationAmount = '515.15';

    multiplier = ethers.BigNumber.from(multiplier);
    const newEthPrice = mockEthPrice.mul(multiplier).div(scale);

    const shortfallUSD = getShortFallUSD(expectedBorrowBalance, expectedSupplyBalance);

    // Mock and process 2 new blocks
    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(newEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    mockContract.getAccountLiquidity.mockClear();
    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    // This block should alert
    let findings = await handleBlock(blockEvent);

    // Expected finding
    const borrowerAddress = mockBorrower;
    const liquidationAmount = expectedLiquidationAmount;
    const shortfallAmount = expectedLiquidationAmount;
    const healthFactor = expectedUserHealth;
    const expectedFinding = Finding.fromObject({
      name: `${initializeData.protocolName} Liquidation Threshold Alert`,
      description: `The address ${mockBorrower} has dropped below the liquidation threshold. `
        + `The account may be liquidated for: $${liquidationAmount} USD`,
      alertId: `${initializeData.developerAbbreviation}-${initializeData.protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
      type: FindingType[initializeData.alert.type],
      severity: FindingSeverity[initializeData.alert.severity],
      protocol: initializeData.protocolName,
      metadata: {
        borrowerAddress,
        liquidationAmount,
        shortfallAmount,
        healthFactor,
      },
    });

    const { borrowBalance, supplyBalance, health } = initializeData.accounts['0x1111'];
    const actualEthPrice = initializeData.tokens['0x0ceth'].price.dp(2).toString();
    const actualBorrowBalance = borrowBalance.dp(2).toString();
    const actualSupplyBalance = supplyBalance.dp(2).toString();
    const actualUserHealth = health.dp(2).toString();

    expect(actualEthPrice).toBe(expectedEthPrice);
    expect(actualUserHealth).toBe(expectedUserHealth);
    expect(actualBorrowBalance).toBe(expectedBorrowBalance);
    expect(actualSupplyBalance).toBe(expectedSupplyBalance);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
    expect(findings).toStrictEqual([expectedFinding]);

    // After that is all verified, process a new block without changing anythings.
    // Start the block with a block timestamp of 45 seconds
    // Price and liquidity checks still happen every block, so mock them.
    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(newEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    blockEvent = mockBlock(45);
    findings = await handleBlock(blockEvent);
    // New finding should be empty because it was the same alert within 24 hours.
    expect(findings).toStrictEqual([]);

    // Next let 24 hours pass and process a new block
    // Start the block with a block timestamp of 1 day + 45 seconds
    // Price and liquidity checks still happen every block, so mock them.
    const oneDay = 86400;
    blockEvent = mockBlock(oneDay + 45);
    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(newEthPrice, mockEthCollateralFactor, mockEthCTokenRate);
    mockContract.getAccountLiquidity.mockResolvedValueOnce(
      [mockEthersZero, mockEthersZero, shortfallUSD],
    );
    findings = await handleBlock(blockEvent);

    // New finding should return after the 24 hours.
    expect(findings).toStrictEqual([expectedFinding]);
  });
});

function mockTransaction(mockAddress, mockTopic, mockData) {
  const mockLogs = [{
    address: mockAddress,
    topics: mockTopic,
    data: mockData,
  }];

  // build the mock receipt for mock txEvent, in this case the log event topics will correspond to
  // create the mock txEvent
  const mockTxEvent = new TransactionEvent(null, null, null, [], {}, null, mockLogs, null);

  return mockTxEvent;
}

describe('handleTransaction', () => {
  let initializeData;
  let blockEvent;
  let handleBlock = provideHandleBlock(initializeData);
  let handleTransaction;
  let cErcIface;
  let comptrollerIface;

  beforeEach(async () => {
    // Initialize
    initializeData = {};
    handleTransaction = provideHandleTransaction(initializeData);
    handleBlock = provideHandleBlock(initializeData);

    setDefaultMocks();
    setVerifyTokenMocks('cBTC', '0x0wbtc', mockBtcCTokenRate, mockBtcDecimals);
    setVerifyTokenMocks('cETH', '0x0weth', mockEthCTokenRate, mockEthDecimals);
    await (provideInitialize(initializeData))();

    // Replace the imported thresholds with the test ones.
    initializeData.minimumLiquidationInUSD = setMinimumLiquidationInUSD;
    initializeData.lowHealthThreshold = setLowHealthThreshold;
    cErcIface = new ethers.utils.Interface(initializeData.cTokenABI);
    comptrollerIface = new ethers.utils.Interface(initializeData.comptrollerABI);

    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);

    // Initialize block time is 1 second since epoch. Then the next block is set for 15 seconds
    blockEvent = mockBlock(15);
    await handleBlock(blockEvent);
    // Same beforeEach as handleBlock
  });

  it('should not add any address to the newAccount list if no events are emitted', async () => {
    const txEvent = mockTransaction(ethers.constants.AddressZero, null, null);
    expect(initializeData.newAccounts).toStrictEqual([]);
    await handleTransaction(txEvent);
    expect(initializeData.newAccounts).toStrictEqual([]);
  });

  it('should add address to the newAccount list on any Borrow event', async () => {
    const mockBorrowTopics = cErcIface.encodeFilterTopics('Borrow', []);
    const mockBorrowData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256'],
      [newBorrower, 1, 1, 1],
    );

    // Event originating from ZeroAddress address
    const txEvent = mockTransaction(ethers.constants.AddressZero, mockBorrowTopics, mockBorrowData);
    expect(initializeData.newAccounts).toStrictEqual([]);
    await handleTransaction(txEvent);
    expect(initializeData.newAccounts).toStrictEqual([newBorrower]);
  });

  it('should add address to the newAccount list on comptroller MarketExited event', async () => {
    const mockExitTopics = comptrollerIface.encodeFilterTopics('MarketExited', []);
    const mockExitData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'address'],
      [ethers.constants.AddressZero, newBorrower],
    );

    const { comptrollerAddress } = initializeData;
    // Event originating from comptroller address
    const txEvent = mockTransaction(comptrollerAddress, mockExitTopics, mockExitData);
    expect(initializeData.newAccounts).toStrictEqual([]);
    await handleTransaction(txEvent);
    expect(initializeData.newAccounts).toStrictEqual([newBorrower]);
  });

  it('should not add address to the newAccount list on non-comptroller MarketExited event', async () => {
    const mockExitTopics = comptrollerIface.encodeFilterTopics('MarketExited', []);
    const mockExitData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'address'],
      [ethers.constants.AddressZero, newBorrower],
    );

    // Event originating from non-comptroller address
    const txEvent = mockTransaction(ethers.constants.AddressZero, mockExitTopics, mockExitData);
    expect(initializeData.newAccounts).toStrictEqual([]);
    await handleTransaction(txEvent);
    expect(initializeData.newAccounts).toStrictEqual([]);
  });
});

function mockSnapshot(setBorrow, setSupply, setDecimals) {
  const decimalsMultiplier = ethers.BigNumber.from(10).pow(setDecimals);
  // 1 cToken = 0.02 token , so 1 token = 50 cTokens
  const tokenToCTokenMultiplier = ethers.BigNumber.from(50);
  setBorrow = ethers.BigNumber.from(setBorrow).mul(decimalsMultiplier);
  const setCSupply = ethers.BigNumber.from(setSupply).mul(decimalsMultiplier)
    .mul(tokenToCTokenMultiplier);

  mockContract.getAccountSnapshot.mockResolvedValueOnce(
    [mockEthersZero, setCSupply, setBorrow, mockEthersZero],
  );
  // Ref: https://github.com/compound-finance/compound-protocol/blob/3affca87636eecd901eb43f81a4813186393905d/contracts/CToken.sol#L220
}

describe('process newBorrower', () => {
  let initializeData;
  let handleBlock;
  let blockEvent;

  beforeEach(async () => {
    // Initialize
    initializeData = {};
    handleBlock = provideHandleBlock(initializeData);

    setDefaultMocks();
    setVerifyTokenMocks('cBTC', '0x0wbtc', mockBtcCTokenRate, mockBtcDecimals);
    setVerifyTokenMocks('cETH', '0x0weth', mockEthCTokenRate, mockEthDecimals);
    await (provideInitialize(initializeData))();

    // Replace the imported thresholds with the test ones.
    initializeData.minimumLiquidationInUSD = setMinimumLiquidationInUSD;
    initializeData.lowHealthThreshold = setLowHealthThreshold;

    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);

    // Initialize block time is 1 second since epoch. Then the next block is set for 15 seconds
    blockEvent = mockBlock(15);
    await handleBlock(blockEvent);
    // Same beforeEach as handleBlock

    // handleTransaction already verified the newBorrower addition process. The result
    //  is that the address is added to this array. Directly adding the account
    //  simplifies the setup for this set of tests.
    initializeData.newAccounts = [newBorrower];
  });

  it('should use contract calls ', async () => {
    // Verify new account is waiting to be added
    expect(initializeData.newAccounts).toStrictEqual([newBorrower]);

    // Mocks for price updates
    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);

    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    await handleBlock(blockEvent);

    // Should check which tokens this account has.
    expect(mockContract.getAssetsIn).toBeCalledTimes(1);
    // Default mock was set to BTC and ETH, so it should get 2 snapshots.
    expect(mockContract.getAccountSnapshot).toBeCalledTimes(2);

    // Check counters from the block / price update step.
    expect(mockContract.getRateToEth).toBeCalledTimes(2);
    expect(mockContract.markets).toBeCalledTimes(2);
    expect(mockContract.exchangeRateStored).toBeCalledTimes(2);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);

    // After processing newAccount, clear the array.
    expect(initializeData.newAccounts).toStrictEqual([]);
  });

  it('should process new users', async () => {
    // Verify new account is waiting to be added
    expect(initializeData.newAccounts).toStrictEqual([newBorrower]);

    const setBTCBorrow = 0;
    const setBTCSupply = 2;
    const setETHBorrow = 10;
    const setETHSupply = 0;
    const setAssetsIn = ['0x0cbtc', '0x0ceth'];

    // Mock account info lookup
    mockContract.getAssetsIn(setAssetsIn);
    mockContract.getAssetsIn.mockClear();
    mockSnapshot(setBTCBorrow, setBTCSupply, mockBtcDecimals);
    mockSnapshot(setETHBorrow, setETHSupply, mockBtcDecimals);

    // Mocks for price updates
    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);

    // Start the block
    mockContract.getAssetsIn.mockClear();
    mockContract.getAccountSnapshot.mockClear();
    mockContract.getAccountSnapshot.mockClear();

    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    await handleBlock(blockEvent);

    // Should check which tokens this account has.
    expect(mockContract.getAssetsIn).toBeCalledTimes(1);
    // Default mock was set to BTC and ETH, so it should get 2 snapshots.
    expect(mockContract.getAccountSnapshot).toBeCalledTimes(2);

    // Check counters from the block / price update step.
    expect(mockContract.getRateToEth).toBeCalledTimes(2);
    expect(mockContract.markets).toBeCalledTimes(2);
    expect(mockContract.exchangeRateStored).toBeCalledTimes(2);

    // After processing newAccount, clear the array.
    expect(initializeData.newAccounts).toStrictEqual([]);
  });
});
