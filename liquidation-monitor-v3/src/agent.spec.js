// Simulated prices of:
//   BTC = $30,000
//   COMP = $3,000
//   USDC = $1
// Bot prices are tracked in USD denomination.
// ref: https://github.com/compound-finance/comet/blob/ad6a4205a96be36417632afba2417f25b6d574ad/contracts/Comet.sol#L499
let mockBtcPrice = '3000000000000'; // 1 BTC = $30,000
let mockCompPrice = '6000000000'; // 1 COMP = $60
let mockUsdcPrice = '100000000'; // 1 USDC = $1

const mockUser1 = `0x${'1'.repeat(40)}`; // 0x11111...
const mockUser2 = `0x${'2'.repeat(40)}`;
let mockUser1Balance = '1000000000'; // $1,000
let mockUser2Balance = '1000000000'; // $1,000
let mockUser1BtcSupplied = '10000000'; // $1,000
let mockUser2BtcSupplied = '10000000'; // $1,000

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
const minimumLiquidationRisk = 90;

const mockProvider = {
  getBlock: jest.fn(),
  getLogs: jest.fn(),
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

// Don't parse, just return the original
const mockInterface = { parseLog: jest.fn((x) => x) };

// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersProvider: jest.fn().mockReturnValue(mockProvider),
  ethers: {
    ...jest.requireActual('ethers'),
    Contract: jest.fn().mockReturnValue(mockContract),
    // Interface: jest.fn().mockReturnValue(mockInterface),
  },
}));

const {
  ethers, Finding, FindingType, FindingSeverity, BlockEvent,
} = require('forta-agent');
const config = require('../bot-config.json');
const { provideInitialize, provideHandleBlock } = require('./agent');

// Convert the string numbers to ethers.BigNumber
mockBtcPrice = ethers.BigNumber.from(mockBtcPrice);
mockCompPrice = ethers.BigNumber.from(mockCompPrice);
mockUsdcPrice = ethers.BigNumber.from(mockUsdcPrice);
mockBtcScale = ethers.BigNumber.from(mockBtcScale);
mockCompScale = ethers.BigNumber.from(mockCompScale);
mockUsdcScale = ethers.BigNumber.from(mockUsdcScale);
mockBtcLiquidCollateralFactor = ethers.BigNumber.from(mockBtcLiquidCollateralFactor);
mockCompLiquidCollateralFactor = ethers.BigNumber.from(mockCompLiquidCollateralFactor);
mockUser1Balance = ethers.BigNumber.from(mockUser1Balance);
mockUser2Balance = ethers.BigNumber.from(mockUser2Balance);
mockUser1BtcSupplied = ethers.BigNumber.from(mockUser1BtcSupplied);
mockUser2BtcSupplied = ethers.BigNumber.from(mockUser2BtcSupplied);

const mockBtcInfo = {
  asset: mockBtcAddress,
  priceFeed: mockBtcFeedAddress,
  scale: mockBtcScale,
  liquidateCollateralFactor: mockBtcLiquidCollateralFactor,
};

const mockCompInfo = {
  asset: mockCompAddress,
  priceFeed: mockCompFeedAddress,
  scale: mockCompScale,
  liquidateCollateralFactor: mockCompLiquidCollateralFactor,
};

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
  borrowBalanceOf.mockImplementation((user) => {
    switch (user) {
      case mockUser1:
        return mockUser1Balance;
      case mockUser2:
        return mockUser2Balance;
      default:
        return null;
    }
  });
  numAssets.mockReturnValue(mockNumAssets);
  getAssetInfo.mockImplementation((id) => {
    switch (id) {
      case 0:
        return mockBtcInfo;
      case 1:
        return mockCompInfo;
      default:
        return null;
    }
  });
  getPrice.mockImplementation((feed) => {
    switch (feed) {
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
  // eslint-disable-next-line no-unused-vars
  userCollateral.mockImplementation((user, asset) => {
    switch (user) {
      case mockUser1:
        return mockUser1Balance;
      case mockUser2:
        return mockUser2Balance;
      default:
        return null;
    }
  });

  getBlock.mockReturnValue({
    block: 1,
    timestamp: 1,
  });
  getLogs.mockReturnValue([]);
}

function createUserEvent(user, action, asset, amount) {
  return {
    name: action,
    args: {
      asset,
      account: user,
      src: user,
      dst: user,
      from: user,
      to: user,
      amount,
    },
  };
}

// agent tests
describe('initializeData', () => {
  let initializeData;

  beforeEach(async () => {
    // Initialize
    initializeData = {};
    setDefaultMocks();
    const logs = [];

    const { getLogs } = mockProvider;

    logs.push(createUserEvent(mockUser1, 'SupplyCollateral', mockBtcAddress, mockUser1BtcSupplied));
    logs.push(createUserEvent(mockUser1, 'Withdraw', mockUsdcAddress, mockUser1Balance));
    getLogs.mockReturnValue(logs);

    await (provideInitialize(initializeData))();
  });

  it('should use contract calls', async () => {
    // Check counters from the initialize step.

    // Provider calls
    expect(mockProvider.getBlock).toBeCalledTimes(1);
    expect(initializeData.nextAlertTime).toBe(86400);

    // Check asset calls
    expect(mockContract.numAssets).toBeCalledTimes(1);
    expect(mockContract.getAssetInfo).toBeCalledTimes(2);
    expect(mockContract.getPrice).toBeCalledTimes(3);

    // Check user calls ( 1 user, 2 events )
    expect(mockProvider.getLogs).toBeCalledTimes(1);

    // No liquidation checks should happen yet
    expect(mockContract.isLiquidatable).toBeCalledTimes(0);
    expect(mockContract.userCollateral).toBeCalledTimes(0);
  });

  it('should set base token USDC data', async () => {
    const { assets } = initializeData;
    const usdcToken = assets[mockUsdcAddress];

    // BaseToken calls
    expect(mockContract.baseToken).toBeCalledTimes(1);
    expect(initializeData.baseToken).toBe(mockUsdcAddress);

    expect(mockContract.baseScale).toBeCalledTimes(1);
    expect(initializeData.baseScale).toBe(mockUsdcScale);

    expect(mockContract.baseTokenPriceFeed).toBeCalledTimes(1);
    expect(initializeData.baseTokenPriceFeed).toBe(mockUsdcFeedAddress);

    expect(usdcToken.scale).toBe(mockUsdcScale);
    expect(usdcToken.priceFeed).toBe(mockUsdcFeedAddress);
    expect(usdcToken.price).toBe(mockUsdcPrice);
  });

  it('should set BTC token data', async () => {
    // Check Comp stats
    const { assets } = initializeData;
    const btcToken = assets[mockBtcAddress];
    expect(btcToken.scale).toBe(mockBtcScale);
    expect(btcToken.priceFeed).toBe(mockBtcFeedAddress);
    expect(btcToken.price).toBe(mockBtcPrice);
  });

  it('should set COMP token data', async () => {
    // Check Comp stats
    const { assets } = initializeData;
    const compToken = assets[mockCompAddress];
    expect(compToken.scale).toBe(mockCompScale);
    expect(compToken.priceFeed).toBe(mockCompFeedAddress);
    expect(compToken.price).toBe(mockCompPrice);
  });

  it('should set user data', async () => {
    // Check Comp stats
    const { users } = initializeData;
    const user1 = users[mockUser1];

    expect(user1[mockBtcAddress]).toStrictEqual(mockUser1BtcSupplied);
    expect(user1.possibleBorrower).toBe(true);
  });
});

// Mock helper function
function setPriceMocks(btcChange, compChange, usdcChange) {
  // Takes parameters in while
  const { getPrice } = mockContract;
  const changeScale = 100;

  const newBtcPrice = mockBtcPrice.mul(btcChange).div(changeScale);
  const newCompPrice = mockCompPrice.mul(compChange).div(changeScale);
  const newUsdcPrice = mockUsdcPrice.mul(usdcChange).div(changeScale);

  getPrice.mockReset();

  getPrice.mockImplementation((feed) => {
    switch (feed) {
      case mockBtcFeedAddress:
        return newBtcPrice;
      case mockCompFeedAddress:
        return newCompPrice;
      case mockUsdcFeedAddress:
        return newUsdcPrice;
      default:
        return null;
    }
  });
  return {
    newBtcPrice,
    newCompPrice,
    newUsdcPrice,
  };
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
    setDefaultMocks();
    const logs = [];

    const { getLogs } = mockProvider;

    // Mock past events
    logs.push(createUserEvent(mockUser1, 'SupplyCollateral', mockBtcAddress, mockUser1BtcSupplied));
    logs.push(createUserEvent(mockUser1, 'Withdraw', mockUsdcAddress, mockUser1Balance));
    getLogs.mockReturnValue(logs);

    await (provideInitialize(initializeData))();

    // Start block specific code
    handleBlock = provideHandleBlock(initializeData);

    // Replace the imported thresholds with the test ones.
    initializeData.minimumLiquidationRisk = minimumLiquidationRisk;

    // Initialize block time is 1 second since epoch. Then the next block is set for 15 seconds
    blockEvent = mockBlock(15);

    // Reset the counters
    setDefaultMocks();

    await handleBlock(blockEvent);
  });

  it('should use contract calls', async () => {
    // Provider calls (only called on initialization)
    expect(mockProvider.getBlock).toBeCalledTimes(0);

    // Check asset calls
    expect(mockContract.getAssetInfo).toBeCalledTimes(2);
    expect(mockContract.getPrice).toBeCalledTimes(3);

    // BaseToken calls (only called on initialization)
    expect(mockContract.baseToken).toBeCalledTimes(0);
    expect(mockContract.baseScale).toBeCalledTimes(0);
    expect(mockContract.baseTokenPriceFeed).toBeCalledTimes(0);
  });

  it('should adjust token price and user balances when price increase', async () => {
    const { assets } = initializeData;
    const changePriceBy = 110;

    // Increase prices by 10%
    const {
      newBtcPrice,
      newCompPrice,
      newUsdcPrice,
    } = setPriceMocks(changePriceBy, changePriceBy, changePriceBy);

    expect(newBtcPrice.gt(mockBtcPrice)).toBe(true);
    expect(newCompPrice.gt(mockCompPrice)).toBe(true);
    expect(newUsdcPrice.gt(mockUsdcPrice)).toBe(true);

    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    await handleBlock(blockEvent);

    expect(assets[mockBtcAddress].price).toBe(newBtcPrice);
    expect(assets[mockCompAddress].price).toBe(newCompPrice);
    expect(assets[mockUsdcAddress].price).toBe(newUsdcPrice);
  });

  it('should adjust token price and user balances when price decreases', async () => {
    const { assets } = initializeData;
    const changePriceBy = 90;

    // Increase prices by 10%
    const {
      newBtcPrice,
      newCompPrice,
      newUsdcPrice,
    } = setPriceMocks(changePriceBy, changePriceBy, changePriceBy);

    expect(newBtcPrice.lt(mockBtcPrice)).toBe(true);
    expect(newCompPrice.lt(mockCompPrice)).toBe(true);
    expect(newUsdcPrice.lt(mockUsdcPrice)).toBe(true);

    // Start the block with a block timestamp of 30 seconds
    blockEvent = mockBlock(30);
    await handleBlock(blockEvent);

    expect(assets[mockBtcAddress].price).toBe(newBtcPrice);
    expect(assets[mockCompAddress].price).toBe(newCompPrice);
    expect(assets[mockUsdcAddress].price).toBe(newUsdcPrice);
  });

  it('asset prices should go up when price feed goes up', async () => {

  });

  it('asset prices should go down when price feed goes down', async () => {

  });

  /*

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
