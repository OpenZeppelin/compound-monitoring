/* eslint-disable no-param-reassign */
const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');
const abi = require('../abi/comet.json');

const { Contract } = ethers;
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
      if (users[dst][asset] === undefined) { users[dst][asset] = ethers.BigNumber.from(0); }
      users[dst][asset] = users[dst][asset].add(amount);
      break;
    case 'WithdrawCollateral':
      // Initialize accounts and assets if they don't exist
      console.debug(`User ${src} withdrew ${amount} of ${asset}`);
      if (users[src] === undefined) { users[src] = {}; }
      if (users[src][asset] === undefined) { users[src][asset] = ethers.BigNumber.from(0); }
      users[src][asset] = users[src][asset].add(amount);
      break;
    case 'TransferCollateral':
      // Initialize accounts and assets if they don't exist
      console.debug(`User ${from} transferred out ${amount} of ${asset}`);
      console.debug(`User ${to} transferred in ${amount} of ${asset}`);
      if (users[from] === undefined) { users[from] = {}; }
      if (users[from][asset] === undefined) { users[from][asset] = ethers.BigNumber.from(0); }
      if (users[to] === undefined) { users[to] = {}; }
      if (users[to][asset] === undefined) { users[to][asset] = ethers.BigNumber.from(0); }
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

function provideInitialize(data) {
  return async function initialize() {
    // Initialize
    /* eslint-disable no-param-reassign */
    data.assets = {};
    data.users = {};
    data.provider = getEthersProvider();
    data.cometInterface = new Interface(abi);
    data.cometContract = new Contract(cometAddress, abi, getEthersProvider());

    const {
      assets, cometContract, cometInterface, provider, users,
    } = data;

    data.baseToken = await cometContract.baseToken();
    data.baseScale = await cometContract.baseScale();
    data.baseTokenPriceFeed = await cometContract.baseTokenPriceFeed();
    data.topics = [[
      // cometInterface.getEventTopic('Supply'), // Don't need to track this
      // cometInterface.getEventTopic('Transfer'), // Don't need to track this
      cometInterface.getEventTopic('Withdraw'),
      cometInterface.getEventTopic('SupplyCollateral'),
      cometInterface.getEventTopic('TransferCollateral'),
      cometInterface.getEventTopic('WithdrawCollateral'),
    ]];
    data.numAssets = await cometContract.numAssets();

    const { topics } = data;
    /* eslint-enable no-param-reassign */

    // Ref: https://kovan.etherscan.io/address/0xcc861650dc6f25cb5ab4185d4657a70c923fdb27#code

    // Get list of all user interactions
    // NOTE: For Infura and Alchemy, eth_getLogs requests are limited to 10K logs in the response.
    // ref: https://docs.infura.io/infura/networks/ethereum/json-rpc-methods/eth_getlogs#limitations
    // ref: https://docs.alchemy.com/alchemy/apis/ethereum/eth-getlogs
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
    const logsPromise = processLogs();

    // Update baseToken Balances for possible borrowers
    async function updateBalances() {
      const borrowers = getBorrowersList(users);
      borrowers.map(async (user) => {
        users[user].borrowBalance = await cometContract.borrowBalanceOf(user);
        // console.debug(`User ${user} has ${users[user].borrowBalance} debt`);
        if (users[user].borrowBalance.eq(0)) {
          console.debug(`User ${user} is debt free, removing them from the list`);
          users[user].possibleBorrower = false;
        }
      });
      console.debug(`Finished updateBalances in block ${blockNumber}`);
    }
    const balancesPromis = updateBalances();

    // Update all asset info and prices
    async function updateNumAssets() {
    // returns uint8 as a number, not BigNumber
      data.numAssets = await cometContract.numAssets();
      console.debug(`Finished updateNumAssets in block ${blockNumber}`);
    }
    const numAssetsPromise = updateNumAssets();

    //
    async function updateAssetInfo() {
    // Generates an array of numbers from 0 to numAssets
      const indexes = [...Array(data.numAssets).keys()];
      indexes.map(async (index) => {
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
          priceFeed,
          scale,
          borrowCollateralFactor,
          liquidateCollateralFactor,
          liquidationFactor,
        };
      });
      console.debug(`Finished updateAssetInfo in block ${blockNumber}`);
    }
    updateAssetInfo();

    // price: await cometContract.getPrice(priceFeed),

    // await Promise.all(, );
    // console.debug(assets);
    console.debug('ready');
    return [];
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    // Process transaction
    // Disabled for now. Should I watch every transaction or check the logs from the block?
    return [];
  };
}

module.exports = {
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
  // provideHandleTransaction,
  // handleTransaction: provideHandleTransaction(initializeData),
  provideInitialize,
  initialize: provideInitialize(initializeData),
};
