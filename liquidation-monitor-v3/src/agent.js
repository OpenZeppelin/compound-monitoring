/* eslint-disable no-param-reassign */
const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');
const abi = require('../abi/comet.json');
const config = require('../bot-config.json');

const { BigNumber, Contract } = ethers;
const { Interface } = ethers.utils;

// Check on chain for any account over this Liquidation Risk percentage.
// 0 means to check every account on every block

const initializeData = {};
const liquidationRiskScale = 100;
// This function will also filter previously alerted addresses.
function createAlert(
  developerAbbreviation,
  protocolName,
  protocolAbbreviation,
  type,
  severity,
  borrowerAddress,
  blockNumber,
  timestamp,
  dataObject,
) {
  // Check the alertTimer
  if (timestamp >= dataObject.nextAlertTime) {
    // Add 1 day to the nextAlertTime and remove the previous alerted accounts.
    const oneDay = 86400;
    dataObject.nextAlertTime += oneDay;
    dataObject.alertedAccounts = [];
  }
  // Skip if the account has already been alerted in the last 24 hours.
  if (dataObject.alertedAccounts.includes(borrowerAddress)) {
    return null;
  }

  // Add account to the alertedAccounts array
  dataObject.alertedAccounts.push(borrowerAddress);
  return Finding.fromObject({
    name: `${protocolName} Liquidation Threshold Alert`,
    description: `The address ${borrowerAddress} is liquidatable in block ${blockNumber}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
    protocol: protocolName,
    metadata: {
      borrowerAddress,
      blockNumber,
    },
  });
}

async function processEvent(data, event) {
  const { baseToken, cometContract, users } = data;
  // When asset doesn't exist in the `supply` and `Withdraw` events, assign it with the `baseToken`
  const {
    asset = baseToken, account, src, dst, from, to, amount,
  } = event.args;
  switch (event.name) {
    case 'Withdraw':
      // Initialize accounts and assets if they don't exist
      if (users[src] === undefined) { users[src] = {}; }

      // Anytime a user withdraws the baseToken, they are marked at a possibleBorrower.
      // From only the event, it is not possible to determine if the user is withdrawing previous
      // collateral or borrowing assets. Therefore, they will be scanned in a later section.
      if (users[src].possibleBorrower !== true) {
        console.debug(`Possible borrower ${src} found`);
        users[src].possibleBorrower = true;
      }
      break;
    case 'SupplyCollateral':
      // Initialize accounts and assets if they don't exist
      console.debug(`User ${dst} supplied ${amount} of ${asset}`);
      if (users[dst] === undefined) { users[dst] = {}; }
      if (users[dst][asset] === undefined) { users[dst][asset] = BigNumber.from(0); }
      users[dst][asset] = users[dst][asset].add(amount);
      break;
    case 'WithdrawCollateral':
      // Initialize accounts and assets if they don't exist
      console.debug(`User ${src} withdrew ${amount} of ${asset}`);
      if (users[src] === undefined) { users[src] = {}; }
      if (users[src][asset] === undefined) { users[src][asset] = BigNumber.from(0); }
      users[src][asset] = users[src][asset].sub(amount);
      break;
    case 'TransferCollateral':
      // Initialize accounts and assets if they don't exist
      console.debug(`User ${from} transferred out ${amount} of ${asset}`);
      console.debug(`User ${to} transferred in ${amount} of ${asset}`);
      if (users[from] === undefined) { users[from] = {}; }
      if (users[from][asset] === undefined) { users[from][asset] = BigNumber.from(0); }
      if (users[to] === undefined) { users[to] = {}; }
      if (users[to][asset] === undefined) { users[to][asset] = BigNumber.from(0); }
      users[from][asset] = users[from][asset].sub(amount);
      users[to][asset] = users[to][asset].add(amount);
      break;
    // Liquidation occurred, update user's asset balance.
    case 'AbsorbCollateral':
      console.debug(`User ${account} had asset ${asset} liquidated`);
      if (users[from] === undefined) { users[from] = {}; }
      if (users[from][asset] === undefined) {
        users[from][asset] = await cometContract.userCollateral(from, asset);
      }
      break;
    default:
  }
}

function filterUsers(filter, users) {
  const userList = Object.entries(users)
    // eslint-disable-next-line no-unused-vars
    .filter(([user, value]) => value[filter]).map(([user, value]) => user);
  return userList;
}

async function updateAssetInfo(data, blockNumber) {
  const { assets, cometContract } = data;
  // Generates an array of numbers from 0 to numAssets
  const indexes = [...Array(data.numAssets).keys()];
  await Promise.all(indexes.map(async (index) => {
    const info = await cometContract.getAssetInfo(index);
    const {
      asset,
      priceFeed,
      scale,
      liquidateCollateralFactor,
    } = info;
    assets[asset] = {
      price: BigNumber.from(0),
      priceFeed,
      scale,
      liquidateCollateralFactor,
    };
  }));
  console.debug(`Finished updateAssetInfo in block ${blockNumber}`);
}

async function updatePrices(data, blockNumber) {
  const { assets, cometContract } = data;
  await Promise.all(Object.entries(assets).map(async ([asset, value]) => {
    const price = await cometContract.getPrice(value.priceFeed);
    if (price.gt(0)) {
      assets[asset].price = price;
    } else {
      console.error(`Error in getting price for ${asset}`);
    }
  }));
  console.debug(`Finished updatePrices in block ${blockNumber}`);
}

// Multiply a `fromScale` quantity by a price, returning a common price quantity
// ref: https://github.com/compound-finance/comet/blob/ad6a4205a96be36417632afba2417f25b6d574ad/contracts/Comet.sol#L712
function mulPrice(qty, price, scale) {
  return qty.mul(price).div(scale);
}

// Multiply a number by a factor
// ref: https://github.com/compound-finance/comet/blob/ad6a4205a96be36417632afba2417f25b6d574ad/contracts/Comet.sol#L698
// ref: https://github.com/compound-finance/comet/blob/ad6a4205a96be36417632afba2417f25b6d574ad/contracts/CometCore.sol#L58
function mulFactor(qty, factor) {
  return qty.mul(factor).div(BigNumber.from(10).pow(18));
}

function provideInitialize(data) {
  return async function initialize() {
    // Initialize
    /* eslint-disable no-param-reassign */
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;
    data.cometAddress = config.liquidationMonitor.cometAddress;
    data.minimumLiquidationRisk = config.liquidationMonitor.triggerLevels.minimumLiquidationRisk;
    data.alert = config.liquidationMonitor.alert;

    data.assets = {};
    data.users = {};
    data.findings = [];
    data.provider = getEthersProvider();
    data.cometInterface = new Interface(abi);
    data.cometContract = new Contract(data.cometAddress, abi, getEthersProvider());
    const {
      cometAddress, cometContract, cometInterface, provider,
    } = data;

    data.baseToken = await cometContract.baseToken();
    data.baseScale = await cometContract.baseScale();
    data.baseTokenPriceFeed = await cometContract.baseTokenPriceFeed();

    // Add baseToken to asset object
    const { baseToken, baseScale, baseTokenPriceFeed } = data;
    data.assets[baseToken] = {
      scale: baseScale,
      priceFeed: baseTokenPriceFeed,
    };

    data.topics = [[
      cometInterface.getEventTopic('Withdraw'),
      cometInterface.getEventTopic('SupplyCollateral'),
      cometInterface.getEventTopic('TransferCollateral'),
      cometInterface.getEventTopic('WithdrawCollateral'),
      cometInterface.getEventTopic('AbsorbDebt'),
      cometInterface.getEventTopic('AbsorbCollateral'),
    ]];
    data.numAssets = await cometContract.numAssets();

    // Calculate the next report time.
    const latestBlockTimestamp = (await data.provider.getBlock('latest')).timestamp;
    //   Now minus seconds elapsed since midnight plus 1 day.
    data.nextAlertTime = latestBlockTimestamp - (latestBlockTimestamp % 86400) + 86400;
    data.alertedAccounts = []; // Accounts alerted in the last 24 hours.
    /* eslint-enable no-param-reassign */

    // Get list of all user interactions
    // NOTE: For Infura and Alchemy, eth_getLogs requests are limited to 10K logs in the response.
    // ref: https://docs.infura.io/infura/networks/ethereum/json-rpc-methods/eth_getlogs#limitations
    // ref: https://docs.alchemy.com/alchemy/apis/ethereum/eth-getlogs
    const { topics } = data;
    const rawLogs = await provider.getLogs({
      fromBlock: '0x0',
      toBlock: 'latest',
      address: cometAddress,
      topics,
    });

    // Workaround for skipping parsing for mocks
    let parsedEvents;
    if (rawLogs[0]?.args === undefined) {
      parsedEvents = rawLogs.map((log) => cometInterface.parseLog(log));
    } else {
      parsedEvents = rawLogs;
    }

    // Get initial state of all borrowers
    parsedEvents.forEach(async (event) => {
      await processEvent(data, event);
    });

    // Update Asset priceFeed, scale, borrowCollateralFactor and liquidateCollateralFactor
    await updateAssetInfo(data, 0);

    // Update Prices
    await updatePrices(data, 0);
  };
}

function provideHandleBlock(data) {
  return async function handleBlock(blockEvent) {
    // Process the block
    const { number: blockNumber, timestamp } = blockEvent.block;
    const {
      assets,
      baseScale,
      baseToken,
      cometAddress,
      cometContract,
      cometInterface,
      provider,
      topics,
      users,
      minimumLiquidationRisk,
    } = data;

    // Each await is initiated individually and references the most up to date info that it has
    // access to. Previous promises may not be resolved by the time subsequent calls are made.
    // Calculations may be off by up to 3 blocks (in testing). Example: user.balance information is
    // from block 100 and the pricing data is from block 102. To account for this, any account
    // within x% of liquidation will be checked on-chain with `isLiquidatable(address)` calls.

    // Scan for events in the latest block
    async function processLogs() {
      const rawLogs = await provider.getLogs({
        fromBlock: 'latest',
        toBlock: 'latest',
        address: cometAddress,
        topics,
      });
      const parsedEvents = rawLogs.map((log) => cometInterface.parseLog(log));

      // Update state of all borrowers
      parsedEvents.forEach(async (event) => {
        await processEvent(data, event);
      });
      console.debug(`Finished processingLogs in block ${blockNumber}`);
    }
    processLogs();

    // Update baseToken Balances for possible borrowers
    async function updateBalances() {
      const borrowers = filterUsers('possibleBorrower', users);
      await Promise.all(borrowers.map(async (user) => {
        users[user].borrowBalance = await cometContract.borrowBalanceOf(user);
        // console.debug(`User ${user} has ${users[user].borrowBalance} debt`);
        if (users[user].borrowBalance.eq(0)) {
          console.debug(`User ${user} is debt free, removing them from the list`);
          users[user].possibleBorrower = false;
        }
      }));
      console.debug(`Finished updateBalances in block ${blockNumber}`);
    }
    updateBalances();

    // Update the number of assets in Comet
    async function updateNumAssets() {
    // returns uint8 as a number, not BigNumber
      // eslint-disable-next-line no-param-reassign
      data.numAssets = await cometContract.numAssets();
      console.debug(`Finished updateNumAssets in block ${blockNumber}`);
    }
    updateNumAssets();

    // Update Asset priceFeed, scale, borrowCollateralFactor and liquidateCollateralFactor
    updateAssetInfo(data, blockNumber);

    // Update Prices
    updatePrices(data, blockNumber);

    // Check Liquidation Risk from stored data
    Object.entries(users).forEach(([user, userValue]) => {
      // Skip the non-borrowers
      if (userValue.borrowBalance !== undefined && userValue.borrowBalance.gt(0)) {
        console.debug(`Checking balances off-chain for user: ${user}`);
        // Calculate the user's principal debt in USD
        // eslint-disable-next-line no-param-reassign
        userValue.principal = mulPrice(
          userValue.borrowBalance,
          assets[baseToken].price,
          baseScale,
        );
        // Calculate the user's liquidity collateral in USD
        // eslint-disable-next-line no-param-reassign
        userValue.liquidity = BigNumber.from(0);

        // Loop through all tracked asset
        Object.entries(assets).forEach(([asset, assetValue]) => {
          if (userValue[asset]) {
          // ref: https://github.com/compound-finance/comet/blob/ad6a4205a96be36417632afba2417f25b6d574ad/contracts/Comet.sol#L542
            const newAmount = mulPrice(userValue[asset], assetValue.price, assetValue.scale);
            const adjustedAmount = mulFactor(newAmount, assetValue.liquidateCollateralFactor);
            // eslint-disable-next-line no-param-reassign
            userValue.liquidity = userValue.liquidity.add(adjustedAmount);
          }
        });
        console.debug(`User: ${user} Liquidity: ${userValue.liquidity} borrowed: ${userValue.principal}`);
        // Protect against division by zero
        if (userValue.liquidity.gt(0)) {
          const risk = userValue.principal.mul(liquidationRiskScale).div(userValue.liquidity);
          console.debug(`User: ${user} has a liquidation risk of ${risk}%`);
          // User is above risk tolerance, marking them for on-chain check
          if (risk.gt(minimumLiquidationRisk)) {
          // eslint-disable-next-line no-param-reassign
            userValue.atRisk = true;
          }
        }
      }
    });

    // Check if liquidatable, on chain
    async function checkLiquidatable() {
      const atRiskUsers = filterUsers('atRisk', users);

      await Promise.all(atRiskUsers.map(async (atRiskUser) => {
        console.debug(`Checking isLiquidatable on-chain for user: ${atRiskUser}`);
        users[atRiskUser].isLiquidatable = await cometContract.isLiquidatable(atRiskUser);
      }));
      console.debug(`Finished isLiquidatable in block ${blockNumber}`);
      const liquidatableUsers = filterUsers('isLiquidatable', users);
      // Create finding
      if (liquidatableUsers.length > 0) {
        liquidatableUsers.forEach((user) => {
          const newFinding = createAlert(
            data.developerAbbreviation,
            data.protocolName,
            data.protocolAbbreviation,
            data.alert.type,
            data.alert.severity,
            user,
            blockNumber,
            timestamp,
            data,
          );
          // Check against no finding (undefined) and against filtered findings (null)
          if (newFinding !== undefined && newFinding !== null) {
            data.findings.push(newFinding);
          }
        });
      }
    }
    checkLiquidatable();

    // Report if any findings were found in previous async calls
    let findings = [];
    if (data.findings.length > 0) {
      // Copy the array and remove the original
      findings = [...data.findings];
      // eslint-disable-next-line no-param-reassign
      data.findings = [];
    }
    return findings;
  };
}

module.exports = {
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
  provideInitialize,
  initialize: provideInitialize(initializeData),
};
