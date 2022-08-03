const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');

const { Interface } = ethers.utils;

const cometAddress = '0xcC861650dc6f25cB5Ab4185d4657a70c923FDb27';

const initializeData = {};

function provideInitialize(data) {
  return async function initialize() {
    // Initialize
    data.provider = getEthersProvider();

    const { provider } = data;

    // Ref: https://kovan.etherscan.io/address/0xcc861650dc6f25cb5ab4185d4657a70c923fdb27#code

    // Get list of borrowers
    // Logs to check for:
    const abi = [
      'event Supply(address indexed from, address indexed dst, uint amount)',
      'event Transfer(address indexed from, address indexed to, uint amount)',
      'event Withdraw(address indexed src, address indexed to, uint amount)',
      'event SupplyCollateral(address indexed from, address indexed dst, address indexed asset, uint amount)',
      'event TransferCollateral(address indexed from, address indexed to, address indexed asset, uint amount)',
      'event WithdrawCollateral(address indexed src, address indexed to, address indexed asset, uint amount)',
    ];
    const cometInterface = new Interface(abi);
    const filter = cometInterface.getEventTopic('Withdraw');
    console.debug(filter);
    const logs = await provider.getLogs({
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
    console.debug(logs.length);
    console.debug(cometInterface.parseLog(logs[1]));
    console.debug(cometInterface.parseLog(logs[1]).args.from);
    // Get initial state of all borrowers
  };
}

function provideHandleBlock(data) {
  return async function handleBlock(blockEvent) {
    // Process the block
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    // Process transaction
  };
}

module.exports = {
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  provideInitialize,
  initialize: provideInitialize(initializeData),
};
