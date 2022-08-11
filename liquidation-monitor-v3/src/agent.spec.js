// Simulated prices of:
//   BTC = $30,000
//   COMP = $3,000
//   USDC = $1
// Bot prices are tracked in USD denomination.
// ref: https://github.com/compound-finance/comet/blob/ad6a4205a96be36417632afba2417f25b6d574ad/contracts/Comet.sol#L499
// ref: https://kovan.etherscan.io/address/0xcc861650dc6f25cb5ab4185d4657a70c923fdb27#readProxyContract
let mockBtcPrice = '3000000000000'; // 1 BTC = $30,000
let mockCompPrice = '6000000000'; // 1 COMP = $60
let mockUsdcPrice = '100000000'; // 1 USDC = $1

const mockUser1 = `0x${'1'.repeat(40)}`; // 0x11111...
const mockUser2 = `0x${'2'.repeat(40)}`; // 0x22222...
let mockUser1Balance = '1000000000'; // $1,000
let mockUser2Balance = '1000000000'; // $1,000
let mockUser1BtcSupplied = '5000000'; // $1,500
let mockUser2BtcSupplied = '5000000'; // $1,500

const mockBtcAddress = `0x${'4'.repeat(40)}`;
const mockCompAddress = `0x${'5'.repeat(40)}`;
const mockUsdcAddress = `0x${'6'.repeat(40)}`;

// ref: https://github.com/compound-finance/comet/blob/ad6a4205a96be36417632afba2417f25b6d574ad/contracts/Comet.sol#L306
const mockBtcFeedAddress = `0x${'7'.repeat(40)}`;
const mockCompFeedAddress = `0x${'8'.repeat(40)}`;
const mockUsdcFeedAddress = `0x${'9'.repeat(40)}`;
// ref: https://kovan.etherscan.io/address/0xcc861650dc6f25cb5ab4185d4657a70c923fdb27#readProxyContract
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
    const { liquidationMonitor: { triggerLevels: { minimumLiquidationRisk: risk } } } = config;
    expect(typeof (risk)).toBe('number');
    expect(risk).not.toBe('');
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

  // Set implementations and default values
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
  isLiquidatable.mockReturnValue(false);
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
    expect(mockProvider.getBlock).toBeCalledTimes(1); // Called to set alarmTime
    expect(initializeData.nextAlertTime).toBe(86400);

    // Check asset calls
    expect(mockContract.numAssets).toBeCalledTimes(1);
    expect(mockContract.getAssetInfo).toBeCalledTimes(2); // for BTC and COMP
    expect(mockContract.getPrice).toBeCalledTimes(3); // for BTC, COMP, and USDC

    // Check user calls
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
    // Liquidity checks happen in the blockEvent
    expect(user1.borrowBalance).toBe(undefined);
    expect(user1.principal).toBe(undefined);
    expect(user1.liquidity).toBe(undefined);
    expect(user1.atRisk).toBe(undefined);
  });
});

// Mock helper function
function setPriceMocks(btcChange, compChange, usdcChange) {
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

function mockBlock(number, timestamp) {
  // create the mock blockEvent
  const block = { number, timestamp };
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
    // User1 Supplied $1500 of BTC
    // User1 borrowed $1000 USDC
    logs.push(createUserEvent(mockUser1, 'SupplyCollateral', mockBtcAddress, mockUser1BtcSupplied));
    logs.push(createUserEvent(mockUser1, 'Withdraw', mockUsdcAddress, mockUser1Balance));
    getLogs.mockReturnValue(logs);

    await (provideInitialize(initializeData))();

    // Start block specific code
    handleBlock = provideHandleBlock(initializeData);

    // Replace the imported threshold with the test one.
    initializeData.minimumLiquidationRisk = minimumLiquidationRisk;

    // Reset the counters
    setDefaultMocks();

    // Start block 1 with a block timestamp of 15 seconds
    blockEvent = mockBlock(1, 15);
    await handleBlock(blockEvent);
  });

  it('should use contract calls', async () => {
    // Provider calls (only called on initialization)
    expect(mockProvider.getBlock).toBeCalledTimes(0);

    // Check asset calls
    expect(mockContract.getAssetInfo).toBeCalledTimes(2); // for BTC and COMP
    expect(mockContract.getPrice).toBeCalledTimes(3); // for BTC, COMP and USDC

    // BaseToken calls (only called on initialization), so they should be zero
    expect(mockContract.baseToken).toBeCalledTimes(0);
    expect(mockContract.baseScale).toBeCalledTimes(0);
    expect(mockContract.baseTokenPriceFeed).toBeCalledTimes(0);
  });

  it('should adjust token price and user balances when prices increase', async () => {
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

    // Start block 2 with a block timestamp of 30 seconds
    blockEvent = mockBlock(2, 30);
    await handleBlock(blockEvent);

    expect(assets[mockBtcAddress].price).toBe(newBtcPrice);
    expect(assets[mockCompAddress].price).toBe(newCompPrice);
    expect(assets[mockUsdcAddress].price).toBe(newUsdcPrice);
  });

  it('should adjust token price and user balances when prices decreases', async () => {
    const { assets } = initializeData;
    const changePriceBy = 90;

    // Decrease prices by 10%
    const {
      newBtcPrice,
      newCompPrice,
      newUsdcPrice,
    } = setPriceMocks(changePriceBy, changePriceBy, changePriceBy);

    expect(newBtcPrice.lt(mockBtcPrice)).toBe(true);
    expect(newCompPrice.lt(mockCompPrice)).toBe(true);
    expect(newUsdcPrice.lt(mockUsdcPrice)).toBe(true);

    // Start block 2 with a block timestamp of 30 seconds
    blockEvent = mockBlock(2, 30);
    await handleBlock(blockEvent);

    expect(assets[mockBtcAddress].price).toBe(newBtcPrice);
    expect(assets[mockCompAddress].price).toBe(newCompPrice);
    expect(assets[mockUsdcAddress].price).toBe(newUsdcPrice);
  });

  it('returns no findings if collateral asset increases and health remains below the liquidation threshold', async () => {
    // User Supplied $1500 of BTC
    // User borrowed $1000 USDC (principal)
    // BTC increased by 10%
    // New BTC value is $1650, of which, only 75% can be used for collateral.
    // Principal is $1000. Collateral is $1238. Liquidation risk is 80%.
    const { users } = initializeData;
    const user1 = users[mockUser1];
    const changePriceBy = 110;
    const samePrice = 100;
    setPriceMocks(changePriceBy, samePrice, samePrice);

    // Start block 2 with a block timestamp of 30 seconds
    // Prices are set in this block
    blockEvent = mockBlock(2, 30);
    await handleBlock(blockEvent);

    // Start block 3 with a block timestamp of 45 seconds
    // Users are updated based on block 2 data. If a user is atRisk, then isLiquidatable is called.
    // if isLiquidatable is true, then a finding is stored.
    blockEvent = mockBlock(3, 45);
    await handleBlock(blockEvent);
    expect(mockContract.isLiquidatable).toBeCalledTimes(0);

    // Need at least a 1ms wait between blocks to allow async functions to finish
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 100)); // Sleep for 100 milliseconds

    // Start block 4 with a block timestamp of 60 seconds
    // The block handler returns the stored findings (if any) from block 3.
    blockEvent = mockBlock(4, 60);
    const findings = await handleBlock(blockEvent);

    // Not liquidatable, and below the minimumRisk
    const expectedRisk = 80;
    // Calculate risk, scaled to 100
    const calculatedRisk = user1.principal.mul(100).div(user1.liquidity).toNumber();

    expect(user1[mockBtcAddress]).toStrictEqual(mockUser1BtcSupplied);
    expect(user1.possibleBorrower).toBe(true);
    expect(user1.borrowBalance).toBe(mockUser1Balance);
    expect(calculatedRisk).toBe(expectedRisk);
    // calculatedRisk is below minimumLiquidationRisk, therefore atRisk should be false
    expect(user1.atRisk).toBe(false);
    expect(findings).toStrictEqual([]);
  });

  it('returns no findings if collateral asset decreases and health remains below the liquidation threshold', async () => {
    // User Supplied $1500 of BTC
    // User borrowed $1000 USDC (principal)
    // BTC decreased by 10%
    // New BTC value is $1350, of which, only 75% can be used for collateral.
    // Principal is $1000. Collateral is $1012. Liquidation risk is 98%.
    const { users } = initializeData;
    const user1 = users[mockUser1];
    const changePriceBy = 90;
    const samePrice = 100;
    setPriceMocks(changePriceBy, samePrice, samePrice);

    // Start block 2 with a block timestamp of 30 seconds
    // Prices are set in this block
    blockEvent = mockBlock(2, 30);
    await handleBlock(blockEvent);

    // Start block 3 with a block timestamp of 45 seconds
    // Users are updated based on block 2 data. If a user is atRisk, then isLiquidatable is called.
    // if isLiquidatable is true, then a finding is stored.
    blockEvent = mockBlock(3, 45);
    await handleBlock(blockEvent);
    expect(mockContract.isLiquidatable).toBeCalledTimes(1);

    // Need at least a 1ms wait between blocks to allow async functions to finish
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 100)); // Sleep for 100 milliseconds

    // Start block 4 with a block timestamp of 60 seconds
    // The block handler returns the stored findings (if any) from block 3.
    blockEvent = mockBlock(4, 60);
    const findings = await handleBlock(blockEvent);

    // Not liquidatable, but above the risk
    const expectedRisk = 98;
    // Calculate risk, scaled to 100
    const calculatedRisk = user1.principal.mul(100).div(user1.liquidity).toNumber();

    expect(user1[mockBtcAddress]).toStrictEqual(mockUser1BtcSupplied);
    expect(user1.possibleBorrower).toBe(true);
    expect(user1.borrowBalance).toBe(mockUser1Balance);
    expect(calculatedRisk).toBe(expectedRisk);
    // calculatedRisk is above minimumLiquidationRisk, therefore atRisk should be true
    expect(user1.atRisk).toBe(true);
    expect(findings).toStrictEqual([]);
  });

  it('returns findings if collateral asset decreases and account exceeds the liquidation threshold', async () => {
    // User Supplied $1500 of BTC
    // User borrowed $1000 USDC (principal)
    // BTC decreased by 20%
    // New BTC value is $1200, of which, only 75% can be used for collateral.
    // Principal is $1000. Collateral is $900. Liquidation risk is 111%.
    const { users } = initializeData;
    const user1 = users[mockUser1];
    const changePriceBy = 80;
    const samePrice = 100;
    setPriceMocks(changePriceBy, samePrice, samePrice);

    // Start block 2 with a block timestamp of 30 seconds
    // Prices are set in this block
    blockEvent = mockBlock(2, 30);
    await handleBlock(blockEvent);

    // Start block 3 with a block timestamp of 45 seconds
    // Users are updated based on block 2 data. If a user is atRisk, then isLiquidatable is called.
    // if isLiquidatable is true, then a finding is stored.
    blockEvent = mockBlock(3, 45);
    mockContract.isLiquidatable.mockReturnValueOnce(true);
    await handleBlock(blockEvent);
    expect(mockContract.isLiquidatable).toBeCalledTimes(1);

    // Need at least a 1ms wait between blocks to allow async functions to finish
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 100)); // Sleep for 100 milliseconds

    // Start block 4 with a block timestamp of 60 seconds
    // The block handler returns the stored findings (if any) from block 3.
    blockEvent = mockBlock(4, 60);
    const findings = await handleBlock(blockEvent);

    // Liquidatable
    const expectedRisk = 111;
    const expectedBlock = 3;
    // Calculate risk, scaled to 100
    const calculatedRisk = user1.principal.mul(100).div(user1.liquidity).toNumber();

    expect(user1[mockBtcAddress]).toStrictEqual(mockUser1BtcSupplied);
    expect(user1.possibleBorrower).toBe(true);
    expect(user1.borrowBalance).toBe(mockUser1Balance);
    expect(calculatedRisk).toBe(expectedRisk);
    // calculatedRisk is above minimumLiquidationRisk, therefore atRisk should be true
    expect(user1.atRisk).toBe(true);

    const { protocolName, developerAbbreviation, protocolAbbreviation } = initializeData;
    const { type, severity } = initializeData.alert;

    const expectedFinding = Finding.fromObject({
      name: `${protocolName} Liquidation Threshold Alert`,
      description: `The address ${mockUser1} is liquidatable in block ${expectedBlock}`,
      alertId: `${developerAbbreviation}-${protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
      type: FindingType[type],
      severity: FindingSeverity[severity],
      protocol: protocolName,
      metadata: {
        borrowerAddress: mockUser1,
        blockNumber: expectedBlock,
      },
    });

    expect(findings).toStrictEqual([expectedFinding]);
  });

  it('returns no findings if the same account is alerted on in the following blocks within 24 hours', async () => {
    // Same setup as above test
    // User Supplied $1500 of BTC
    // User borrowed $1000 USDC (principal)
    // BTC decreased by 20%
    // New BTC value is $1200, of which, only 75% can be used for collateral.
    // Principal is $1000. Collateral is $900. Liquidation risk is 111%.
    const changePriceBy = 80;
    const samePrice = 100;
    setPriceMocks(changePriceBy, samePrice, samePrice);

    // Start block 2 with a block timestamp of 30 seconds
    // Prices are set in this block
    blockEvent = mockBlock(2, 30);
    await handleBlock(blockEvent);

    // Start block 3 with a block timestamp of 45 seconds
    // Users are updated based on block 2 data. If a user is atRisk, then isLiquidatable is called.
    // if isLiquidatable is true, then a finding is stored.
    blockEvent = mockBlock(3, 45);
    mockContract.isLiquidatable.mockReturnValueOnce(true);
    await handleBlock(blockEvent);
    expect(mockContract.isLiquidatable).toBeCalledTimes(1);

    // Need at least a 1ms wait between blocks to allow async functions to finish
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 100)); // Sleep for 100 milliseconds

    // Start block 4 with a block timestamp of 60 seconds
    // The block handler returns the stored findings (if any) from block 3.
    blockEvent = mockBlock(4, 60);
    mockContract.isLiquidatable.mockReturnValueOnce(true);
    let findings = await handleBlock(blockEvent);

    // Verify that there is a finding in block 4
    expect(findings).not.toBe([]);

    // Start block 5 with a block timestamp of 75 seconds
    // The block handler returns the stored findings (if any) from block 3.
    blockEvent = mockBlock(5, 75);
    mockContract.isLiquidatable.mockReturnValueOnce(true);
    findings = await handleBlock(blockEvent);

    // Verify that there is not a finding in block 5
    expect(findings).toStrictEqual([]);
  });

  it('returns findings if the same account is alerted on in the following blocks after 24 hours', async () => {
    // Same setup as above test
    // User Supplied $1500 of BTC
    // User borrowed $1000 USDC (principal)
    // BTC decreased by 20%
    // New BTC value is $1200, of which, only 75% can be used for collateral.
    // Principal is $1000. Collateral is $900. Liquidation risk is 111%.
    const changePriceBy = 80;
    const samePrice = 100;
    setPriceMocks(changePriceBy, samePrice, samePrice);

    // Start block 2 with a block timestamp of 30 seconds
    // Prices are set in this block
    blockEvent = mockBlock(2, 30);
    await handleBlock(blockEvent);

    // Start block 3 with a block timestamp of 45 seconds
    // Users are updated based on block 2 data. If a user is atRisk, then isLiquidatable is called.
    // if isLiquidatable is true, then a finding is stored.
    blockEvent = mockBlock(3, 45);
    mockContract.isLiquidatable.mockReturnValueOnce(true);
    await handleBlock(blockEvent);
    expect(mockContract.isLiquidatable).toBeCalledTimes(1);

    // Need at least a 1ms wait between blocks to allow async functions to finish
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 100)); // Sleep for 100 milliseconds

    // Start block 4 with a block timestamp of 60 seconds
    // The block handler returns the stored findings (if any) from block 3.
    blockEvent = mockBlock(4, 60);
    mockContract.isLiquidatable.mockReturnValueOnce(true);
    let findings = await handleBlock(blockEvent);

    // Verify that there is a finding in block 4
    expect(findings).not.toBe([]);

    // Start block 5 with a block timestamp of 75 seconds
    // The block handler returns the stored findings (if any) from block 3.
    blockEvent = mockBlock(5, 75);
    mockContract.isLiquidatable.mockReturnValueOnce(true);
    findings = await handleBlock(blockEvent);

    // Verify that there is not a finding in block 5
    expect(findings).toStrictEqual([]);

    // Start block 100 with a block timestamp of 86401 seconds (1 day + 1 second)
    // Users are updated based on previous block data (price and balances).
    // If a user is atRisk, then isLiquidatable is called.
    // if isLiquidatable is true, then a finding is stored.
    blockEvent = mockBlock(100, 86401);
    mockContract.isLiquidatable.mockReturnValueOnce(true);
    findings = await handleBlock(blockEvent);
    expect(findings).toStrictEqual([]);

    // Need at least a 1ms wait between blocks to allow async functions to finish
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 100)); // Sleep for 100 milliseconds

    // Start block 101 with a block timestamp of 86415 seconds
    // The block handler returns the stored findings (if any) from block 101.
    blockEvent = mockBlock(101, 86415);
    mockContract.isLiquidatable.mockReturnValueOnce(true);
    findings = await handleBlock(blockEvent);

    // Expected finding
    const expectedBlock = 100; // Finding is generated in block 100 and reported in block 101

    const { protocolName, developerAbbreviation, protocolAbbreviation } = initializeData;
    const { type, severity } = initializeData.alert;

    const expectedFinding = Finding.fromObject({
      name: `${protocolName} Liquidation Threshold Alert`,
      description: `The address ${mockUser1} is liquidatable in block ${expectedBlock}`,
      alertId: `${developerAbbreviation}-${protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
      type: FindingType[type],
      severity: FindingSeverity[severity],
      protocol: protocolName,
      metadata: {
        borrowerAddress: mockUser1,
        blockNumber: expectedBlock,
      },
    });
    expect(findings).toStrictEqual([expectedFinding]);
  });

  it('should process new users', async () => {
    // User2 Supplied $1500 of BTC
    // User2 borrowed $1000 USDC (principal)

    const { users } = initializeData;
    const { getLogs } = mockProvider;

    // User 1 should exist from the initialization step
    expect(users[mockUser1]).toBeDefined();
    // User 2 should not exist yet
    expect(users[mockUser2]).toBeUndefined();

    const logs = [];
    logs.push(createUserEvent(mockUser2, 'SupplyCollateral', mockBtcAddress, mockUser2BtcSupplied));
    logs.push(createUserEvent(mockUser2, 'Withdraw', mockUsdcAddress, mockUser2Balance));
    getLogs.mockReturnValue(logs);

    // Start block 2 with a block timestamp of 30 seconds
    blockEvent = mockBlock(2, 30);
    await handleBlock(blockEvent);

    // After the block is processed, both users should exist
    expect(users[mockUser1]).toBeDefined();
    expect(users[mockUser2]).toBeDefined();
    // User2 should be marked as a borrower
    expect(users[mockUser2].possibleBorrower).toBe(true);
  });
});
