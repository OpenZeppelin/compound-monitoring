/* eslint-disable no-param-reassign */
const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');
const abi = require('../abi/comet.json');

const { BigNumber, Contract } = ethers;
const { Interface } = ethers.utils;

const cometAddress = '0xcC861650dc6f25cB5Ab4185d4657a70c923FDb27';

const initializeData = {};

function adjustBalance(data, event) {
  const { baseToken, users } = data;
  // When asset doesn't exist in the `supply` and `Withdraw` events, assign it with the `baseToken`
  const {
    asset = baseToken, src, dst, from, to, amount,
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
      users[src][asset] = users[src][asset].add(amount);
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
    default:
  }
}

function getBorrowersList(users) {
  const borrowers = Object.entries(users)
    // eslint-disable-next-line no-unused-vars
    .filter(([user, value]) => value.possibleBorrower).map(([user, value]) => user);
  return borrowers;
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
      borrowCollateralFactor,
      liquidateCollateralFactor,
      liquidationFactor,
    } = info;
    assets[asset] = {
      price: BigNumber.from(0),
      priceFeed,
      scale,
      borrowCollateralFactor,
      liquidateCollateralFactor,
      liquidationFactor,
    };
  }));
  console.debug(`Finished updateAssetInfo in block ${blockNumber}`);
}

async function updatePrices(data, blockNumber) {
  const { assets, cometContract } = data;
  await Promise.all(Object.entries(assets).map(async ([asset, value]) => {
    const price = await cometContract.getPrice(value.priceFeed);
    assets[asset].price = price;
    console.debug(`In block ${blockNumber} the price of ${asset} is ${price}`);
  }));
  console.debug(`Finished updatePrices in block ${blockNumber}`);
}

async function getLiquidatable(data, blockNumber) {
  const { users, cometContract } = data;
  const borrowers = getBorrowersList(users);

  await Promise.all(borrowers.map(async (borrower) => {
    const isLiquidatable = await cometContract.isLiquidatable(borrower);
    // console.debug(`User ${borrower} isLiquidatable ${isLiquidatable}`);
  }));
}

function provideInitialize(data) {
  return async function initialize() {
    // Initialize
    /* eslint-disable no-param-reassign */
    data.assets = {};
    data.users = {};
    data.provider = getEthersProvider();
    data.cometInterface = new Interface(abi);
    data.cometContract = new Contract(cometAddress, abi, getEthersProvider());

    const { cometContract, cometInterface, provider } = data;

    data.baseToken = await cometContract.baseToken();
    data.baseScale = await cometContract.baseScale();
    data.baseTokenPriceFeed = await cometContract.baseTokenPriceFeed();
    data.topics = [[
      cometInterface.getEventTopic('Withdraw'),
      cometInterface.getEventTopic('SupplyCollateral'),
      cometInterface.getEventTopic('TransferCollateral'),
      cometInterface.getEventTopic('WithdrawCollateral'),
      cometInterface.getEventTopic('AbsorbDebt'),
      cometInterface.getEventTopic('AbsorbCollateral'),
    ]];
    data.numAssets = await cometContract.numAssets();
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
    const parsedEvents = rawLogs.map((log) => cometInterface.parseLog(log));

    // Get initial state of all borrowers
    parsedEvents.forEach((event) => {
      adjustBalance(data, event);
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
    const { number: blockNumber } = blockEvent.block;
    const {
      assets, cometContract, cometInterface, provider, topics, users,
    } = data;

    // Each await is initiated individually and references the most up to date info that it has
    // access to. Previous promises may not be resolved by the time subsequent calls are made.
    // Calculations may be off by up to 3 blocks (in testing). Example: user.balance information is
    // from block 100 and the pricing data is from block 102. To account for this, any account
    // within x% of liquidation will be checked on-chain with `isBorrowCollateralized(address)` and
    // `isLiquidatable(address)` calls.

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
      parsedEvents.forEach((event) => {
        adjustBalance(data, event);
      });
      console.debug(`Finished processingLogs in block ${blockNumber}`);
    }
    processLogs();

    // Update baseToken Balances for possible borrowers
    async function updateBalances() {
      const borrowers = getBorrowersList(users);
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
    const pricePromise = updatePrices(data, blockNumber);

    findings = getLiquidatable(data, blockNumber);

    await Promise.all([findings]);
    console.debug(assets);
    console.debug(`End block ${blockNumber}`);
    return [];
  };
}

// function provideHandleTransaction(data) {
//   return async function handleTransaction(txEvent) {
//     // Process transaction
//     // Disabled for now. Should I watch every transaction or check the logs from the block?
//     return [];
//   };
// }

module.exports = {
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
  // provideHandleTransaction,
  // handleTransaction: provideHandleTransaction(initializeData),
  provideInitialize,
  initialize: provideInitialize(initializeData),
};
