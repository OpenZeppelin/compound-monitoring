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
    case 'Supply':
      // Initialize accounts and assets if they don't exist
      console.debug(`User ${dst} supplied ${amount} of ${asset}`);
      if (users[dst] === undefined) { users[dst] = {}; }
      if (users[dst][asset] === undefined) { users[dst][asset] = ethers.BigNumber.from(0); }
      users[dst][asset] = users[dst][asset].add(amount);
      break;
    case 'SupplyCollateral':
      // Initialize accounts and assets if they don't exist
      console.debug(`User ${dst} supplied ${amount} of ${asset}`);
      if (users[dst] === undefined) { users[dst] = {}; }
      if (users[dst][asset] === undefined) { users[dst][asset] = ethers.BigNumber.from(0); }
      users[dst][asset] = users[dst][asset].add(amount);
      break;
    case 'Withdraw':
      // Initialize accounts and assets if they don't exist
      console.debug(`User ${src} withdrew ${amount} of ${asset}`);
      if (users[src] === undefined) { users[src] = {}; }
      if (users[src][asset] === undefined) { users[src][asset] = ethers.BigNumber.from(0); }
      users[src][asset] = users[src][asset].add(amount);
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
    const { baseToken } = data;
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
      topics: [[
        cometInterface.getEventTopic('Supply'),
        // cometInterface.getEventTopic('Transfer'), // Don't need to track this
        cometInterface.getEventTopic('Withdraw'),
        cometInterface.getEventTopic('SupplyCollateral'),
        cometInterface.getEventTopic('TransferCollateral'),
        cometInterface.getEventTopic('WithdrawCollateral'),
      ]],
    });
    const parsedEvents = rawLogs.map((log) => cometInterface.parseLog(log));

    // Get initial state of all borrowers
    console.debug(parsedEvents[0]);
    console.debug(data.users);
    parsedEvents.forEach((event) => {
      adjustBalance(data, event);
    });
    console.debug(data.users);
  };
}

function provideHandleBlock(data) {
  return async function handleBlock(blockEvent) {
    // Process the block
    return [];
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    // Process transaction
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
