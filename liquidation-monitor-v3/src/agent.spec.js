// Simulated prices of:
//   BTC = $30,000
//   COMP = $3,000
//   USDC = $1
// Bot prices are tracked in USD denomination.
// ref: https://github.com/compound-finance/comet/blob/ad6a4205a96be36417632afba2417f25b6d574ad/contracts/Comet.sol#L499
let mockBtcPrice = '3000000000000'; // 1 BTC = $30,000
let mockCompPrice = '6000000000'; // 1 COMP = $60
let mockUsdcPrice = '100000000'; // 1 USDC = $1
const mockBorrower = `0x${'1'.repeat(40)}`; // 0x11111...
const newBorrower = `0x${'2'.repeat(40)}`;
const mockBorrowerBalance = '700000000000000000'; // 0x11111...
const newBorrowerBalance = '700000000000000000';
const mockBtcAddress = `0x${'4'.repeat(40)}`;
const mockCompAddress = `0x${'5'.repeat(40)}`;
const mockUsdcAddress = `0x${'6'.repeat(40)}`;

// ref: https://github.com/compound-finance/comet/blob/ad6a4205a96be36417632afba2417f25b6d574ad/contracts/Comet.sol#L306
const mockBtcFeedAddress = `0x${'7'.repeat(40)}`;
const mockCompFeedAddress = `0x${'8'.repeat(40)}`;
const mockUsdcFeedAddress = `0x${'9'.repeat(40)}`;
let mockBtcScale = '100000000';
let mockCompScale = '1000000000000000000';
let mockUsdcScale = '1000000';
let mockBtcLiquidCollateralFactor = '750000000000000000'; // 75%
let mockCompLiquidCollateralFactor = '700000000000000000'; // 70%

const mockNumAssets = 2;

const mockProvider = {
  getBlock: jest.fn(),
  getLogs: jest.fn(),
  // timestamp
};

const mockContract = {
  // Comet
  baseToken: jest.fn(),
  baseScale: jest.fn(),
  baseTokenPriceFeed: jest.fn(),
  borrowBalanceOf: jest.fn(),
  numAssets: jest.fn(),
  getAssetInfo: jest.fn(),
  getPrice: jest.fn(),
  isLiquidatable: jest.fn(),
  userCollateral: jest.fn(),
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
  ethers, Finding, FindingType, FindingSeverity, BlockEvent,
} = require('forta-agent');
const config = require('../bot-config.json');
const abi = require('../abi/comet.json');
const { provideInitialize, provideHandleBlock } = require('./agent');

const iface = new ethers.utils.Interface(abi);

// Convert the string numbers to ethers.BigNumber
mockBtcPrice = ethers.BigNumber.from(mockBtcPrice);
mockCompPrice = ethers.BigNumber.from(mockCompPrice);
mockUsdcPrice = ethers.BigNumber.from(mockUsdcPrice);
mockBtcScale = ethers.BigNumber.from(mockBtcScale);
mockCompScale = ethers.BigNumber.from(mockCompScale);
mockUsdcScale = ethers.BigNumber.from(mockUsdcScale);
mockBtcLiquidCollateralFactor = ethers.BigNumber.from(mockBtcLiquidCollateralFactor);
mockCompLiquidCollateralFactor = ethers.BigNumber.from(mockCompLiquidCollateralFactor);
const mockEthersZero = ethers.BigNumber.from(0);

const assetInfoStruct = [
  'uint8',
  'address',
  'address',
  'uint64',
  'uint64',
  'uint64',
  'uint64',
  'uint128',
];

const mockTestInfo = [
  1,
  '0xcd113733263bF5BCd01CE6c2618CB59DC1618139',
  '0x6135b13325bfC4B00278B4abC5e20bbce2D6580e',
  ethers.BigNumber.from(0),
  ethers.BigNumber.from(0),
  ethers.BigNumber.from(0),
  ethers.BigNumber.from(0),
  ethers.BigNumber.from(0),
];

const mockBtcInfo = [
  0,
  mockBtcAddress,
  mockBtcFeedAddress,
  mockBtcScale,
  ethers.BigNumber.from(0),
  mockBtcLiquidCollateralFactor,
  ethers.BigNumber.from(0),
  ethers.BigNumber.from(0),
];

const mockCompInfo = [
  1,
  mockCompAddress,
  mockCompFeedAddress,
  mockCompScale,
  ethers.BigNumber.from(0),
  mockCompLiquidCollateralFactor,
  ethers.BigNumber.from(0),
  ethers.BigNumber.from(0),
];

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

  it('cometAddress key required', () => {
    const { liquidationMonitor: { cometAddress } } = config;
    expect(typeof (cometAddress)).toBe('string');
    expect(cometAddress).not.toBe('');
  });

  it('triggerLevels key required', () => {
    const { liquidationMonitor: { triggerLevels } } = config;
    expect(typeof (triggerLevels)).toBe('object');
    expect(triggerLevels).not.toBe({});
  });

  it('minimumLiquidationRisk key required', () => {
    const { liquidationMonitor: { triggerLevels: { minimumLiquidationRisk } } } = config;
    expect(typeof (minimumLiquidationRisk)).toBe('number');
    expect(minimumLiquidationRisk).not.toBe('');
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

// Mock helper functions
function setDefaultMocks() {
  // Set all default mocks

  const {
    baseToken,
    baseScale,
    baseTokenPriceFeed,
    borrowBalanceOf,
    numAssets,
    getAssetInfo,
    getPrice,
    isLiquidatable,
    userCollateral,
  } = mockContract;

  const { getBlock, getLogs } = mockProvider;

  // Clear all values and implementations
  baseToken.mockReset();
  baseScale.mockReset();
  baseTokenPriceFeed.mockReset();
  borrowBalanceOf.mockReset();
  numAssets.mockReset();
  getAssetInfo.mockReset();
  getPrice.mockReset();
  isLiquidatable.mockReset();
  userCollateral.mockReset();

  getBlock.mockReset();
  getLogs.mockReset();

  // Set implementations
  baseToken.mockReturnValue(mockUsdcAddress);
  baseScale.mockReturnValue(mockUsdcScale);
  baseTokenPriceFeed.mockReturnValue(mockUsdcFeedAddress);
  // borrowBalanceOf.fn();
  numAssets.mockReturnValue(mockNumAssets);
  getAssetInfo.mockImplementation((id) => {
    let encoded;
    switch (id) {
      case 0:
        // struct = ethers.utils.AbiCoder.prototype.encode(assetInfoStruct, mockBtcInfo);
        encoded = iface.encodeFunctionResult('getAssetInfo', mockTestInfo);
        return encoded;
      case 1:
        // struct = ethers.utils.AbiCoder.prototype.encode(assetInfoStruct, mockCompInfo);
        encoded = iface.encodeFunctionResult('getAssetInfo', [mockCompInfo]);
        return encoded;
      default:
        return null;
    }
  });
  getPrice.mockImplementation((asset) => {
    switch (asset) {
      case mockBtcFeedAddress:
        return mockBtcPrice;
      case mockCompFeedAddress:
        return mockCompPrice;
      case mockUsdcFeedAddress:
        return mockUsdcPrice;
      default:
        return null;
    }
  });
  // isLiquidatable.fn();
  // userCollateral.fn();

  getBlock.mockReturnValue(1);
  getLogs.mockReturnValue([]);
}

// agent tests
describe('initializeData', () => {
  let initializeData;

  beforeEach(async () => {
    // Initialize
    initializeData = {};
    setDefaultMocks();
    await (provideInitialize(initializeData))();
  });

  it('should use contract calls', async () => {
    // Check counters from the initialize step.
    console.debug(mockContract.baseTokenPriceFeed.mock.calls);

    expect(mockContract.baseToken).toBeCalledTimes(1);
    expect(initializeData.baseToken).toBe(mockUsdcAddress);
    expect(mockContract.baseScale).toBeCalledTimes(1);
    expect(initializeData.baseScale).toBe(mockUsdcScale);
    expect(mockContract.baseTokenPriceFeed).toBeCalledTimes(1);
    expect(initializeData.baseTokenPriceFeed).toBe(86400);
    expect(mockContract.numAssets).toBeCalledTimes(1);
    expect(mockContract.numAssets).toBeCalledTimes(1);
    expect(mockContract.numAssets).toBeCalledTimes(1);
    expect(mockContract.numAssets).toBeCalledTimes(1);
    expect(mockContract.numAssets).toBeCalledTimes(1);
    expect(mockContract.numAssets).toBeCalledTimes(1);
    expect(mockContract.numAssets).toBeCalledTimes(1);

    expect(mockProvider.getBlock).toBeCalledTimes(1);
    expect(initializeData.nextAlertTime).toBe(86400);

    expect(mockProvider.getLogs).toBeCalledTimes(1);
    expect(mockProvider.baseToken).toBeCalledTimes(1);
  });
  /*

  it('should set user data', async () => {
    // In the compound API mock, the user supplied 0.85 BTC, and borrowed 10 Comp.
    //  to account for interest earned on supplied tokens, this is stored as cTokens.
    // "When a market is launched, the cToken exchange rate (how much Comp one cComp is worth) begins
    //  at 0.020000 — and increases at a rate equal to the compounding market interest rate"
    // Ref: https://compound.finance/docs/ctokens#introduction - Calculate Exchange Rate
    // In this example 10 Comp * (1 cWComp / 0.02 Comp) = 500 cComp.
    const actualSupply = initializeData.supply['0x0cComp']['0x1111'].toString();
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

  it('should set Comp token data', async () => {
    // Check Comp stats
    const actualCompDecimals = initializeData.tokens['0x0cComp'].tokenDecimals.toString();
    const expectedCompDecimals = mockCompDecimals.toString();
    const actualCompCDecimals = initializeData.tokens['0x0cComp'].cTokenDecimals.toString();
    const expectedCompCDecimals = mockCDecimals.toString();
    expect(actualCompDecimals).toBe(expectedCompDecimals);
    expect(actualCompCDecimals).toBe(expectedCompCDecimals);
  });
});

// Mock helper function
function setPriceMocks(setPrice, setCollateralFactor, setCTokenRate) {
  const {
    markets,
    getRateToComp,
    exchangeRateStored,
    getAccountLiquidity,
  } = mockContract;

  // Set the once mocks
  getRateToComp.mockResolvedValueOnce(setPrice);
  markets.mockResolvedValueOnce([true, setCollateralFactor, true]);
  exchangeRateStored.mockResolvedValueOnce(setCTokenRate);

  // Clear the counters
  getRateToComp.mockClear();
  markets.mockClear();
  exchangeRateStored.mockClear();
  getAccountLiquidity.mockClear();
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
    setVerifyTokenMocks('cComp', '0x0wComp', mockCompCTokenRate, mockCompDecimals);
    await (provideInitialize(initializeData))();

    // Replace the imported thresholds with the test ones.
    initializeData.minimumLiquidationInUSD = setMinimumLiquidationInUSD;
    initializeData.lowHealthThreshold = setLowHealthThreshold;

    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockCompPrice, mockCompCollateralFactor, mockCompCTokenRate);

    // Initialize block time is 1 second since epoch. Then the next block is set for 15 seconds
    blockEvent = mockBlock(15);
    await handleBlock(blockEvent);
  });

  it('should use contract calls', async () => {
    // Check counters from the block / price update step.
    expect(mockContract.getRateToComp).toBeCalledTimes(2);
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
*/
});
