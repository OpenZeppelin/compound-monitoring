const { ethers } = require('ethers');

// eslint-disable-next-line import/no-unresolved
require('dotenv').config();

// Grab --tx
const txArgument = process.env.npm_config_tx;

// mock the axios package
const acceptedPost = {
  status: 204,
  statusText: 'No Content',
};

const jsonRpcUrl = process.env.JSON_RPC_URL;
// mock the defender-relay-client package to use ethers.provider
function mockDefenderRelay() {
  const provider = new ethers.providers.JsonRpcBatchProvider(jsonRpcUrl);
  return provider;
}

jest.mock('defender-relay-client/lib/ethers', () => ({
  DefenderRelayProvider: jest.fn().mockImplementation(mockDefenderRelay),
}));

jest.mock('axios', () => jest.fn().mockResolvedValue(acceptedPost));
// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');

jest.mock('axios-retry', () => jest.fn());

// eslint-disable-next-line import/no-useless-path-segments
const { getSentinelRequest } = require('../../scripts/sentinelEmulator');
const { handler } = require('../market_activity/autotask-1/index');

jest.setTimeout(50000);

describe('check autoTask', () => {
  beforeEach(async () => {
    axios.mockClear();
  });

  it('Runs autoTask against a list of replayed events and posts to discord', async () => {
    let promiseList = [];

    // mainnet transactions
    const testTransactions = {
      '0x0edd197981fc83caf4fdcc1a40e4ad621e17e8d66d46d1161af232be3d8124ee': [
        '[TX](<https://etherscan.io/tx/0x0edd197981fc83caf4fdcc1a40e4ad621e17e8d66d46d1161af232be3d8124ee>) 🐳📉 **$1,601 of WETH** WithdrawCollateral by 0xB0b0',
        '[TX](<https://etherscan.io/tx/0x0edd197981fc83caf4fdcc1a40e4ad621e17e8d66d46d1161af232be3d8124ee>) 📥 **$500 of USDC** Repay by 0xB0b0',
      ],
      '0xa588e64c0e052bcc29e085ef089ddd16b909e9723c2bda17068e4de94de0b197': [
        '[TX](<https://etherscan.io/tx/0xa588e64c0e052bcc29e085ef089ddd16b909e9723c2bda17068e4de94de0b197>) 🐳🐳📉 **$2,068,571 of WBTC** WithdrawCollateral by 0x5A80',
        '[TX](<https://etherscan.io/tx/0xa588e64c0e052bcc29e085ef089ddd16b909e9723c2bda17068e4de94de0b197>) 🐳🐳📥 **$1,100,069 of USDC** Repay by 0x5A80',
      ],
      '0x47fd735c8527d97e9e28e14ca3afef0de7a63ee119051ccdbbba6134d6c8ec50': [
        '[TX](<https://etherscan.io/tx/0x47fd735c8527d97e9e28e14ca3afef0de7a63ee119051ccdbbba6134d6c8ec50>) 📈 **$147 of WETH** SupplyCollateral by 0x6a07',
      ],
      '0xb53a228736603c5f02655661f4f6f11d63e62d8a130888411767a8867cd8e4fe': [
        '[TX](<https://etherscan.io/tx/0xb53a228736603c5f02655661f4f6f11d63e62d8a130888411767a8867cd8e4fe>) 🐳📈 **$3,837 of WETH** SupplyCollateral by 0xe970',
      ],
      '0x8ad1f441def8bce4e3ef1672eb682f2ca617d6a303954efeaa85e9939d9105b1': [
        '[TX](<https://etherscan.io/tx/0x8ad1f441def8bce4e3ef1672eb682f2ca617d6a303954efeaa85e9939d9105b1>) 🐳📈 **$1,923 of WETH** SupplyCollateral by 0xbBAC',
        '[TX](<https://etherscan.io/tx/0x8ad1f441def8bce4e3ef1672eb682f2ca617d6a303954efeaa85e9939d9105b1>) 📤 **$999 of USDC** Borrow by 0xbBAC',
      ],
      '0xf9ba75c7ef1502946dfd7c83973dd5d628e2177d93bbe70881c7756a51458a4f': [
        '[TX](<https://etherscan.io/tx/0xf9ba75c7ef1502946dfd7c83973dd5d628e2177d93bbe70881c7756a51458a4f>) 🐳📈 **$72,678 of WBTC** SupplyCollateral by 0xfb78',
        '[TX](<https://etherscan.io/tx/0xf9ba75c7ef1502946dfd7c83973dd5d628e2177d93bbe70881c7756a51458a4f>) 🐳🐳📈 **$166,314 of UNI** SupplyCollateral by 0xfb78',
        '[TX](<https://etherscan.io/tx/0xf9ba75c7ef1502946dfd7c83973dd5d628e2177d93bbe70881c7756a51458a4f>) 🐳📈 **$14,753 of COMP** SupplyCollateral by 0xfb78',
        '[TX](<https://etherscan.io/tx/0xf9ba75c7ef1502946dfd7c83973dd5d628e2177d93bbe70881c7756a51458a4f>) 🐳📤 **$95,995 of USDC** Borrow by 0xfb78',
      ],
      '0x89b886039fa49feea36ac65d6b9171c3e195887709206ae93482a2306003bc0c': [
        '[TX](<https://etherscan.io/tx/0x89b886039fa49feea36ac65d6b9171c3e195887709206ae93482a2306003bc0c>) 📥 **$400 of USDC** Supply by 0x9Bb4',
      ],
      '0x33c9535be35fa65a0b80ce4f9f8b44c8eb64a99060e53c1410ab0c037652c74e': [
        '[TX](<https://etherscan.io/tx/0x33c9535be35fa65a0b80ce4f9f8b44c8eb64a99060e53c1410ab0c037652c74e>) 🐳📤 **$94,463 of USDC** Borrow by 0x5dc5',
      ],
      // Dropping event(Supply) in
      // TX 0x7e47d93e1553be18d9219c698f047e5ca3ecaaca04e702014ce5bd9e9817272a, value too low
      '0x7e47d93e1553be18d9219c698f047e5ca3ecaaca04e702014ce5bd9e9817272a': [
      ],
      '0x601ac0039538a372c28f935b5e94d73af39507da4bc3d48829d843666009b26c': [
        '[TX](<https://etherscan.io/tx/0x601ac0039538a372c28f935b5e94d73af39507da4bc3d48829d843666009b26c>) 📤 **$99 of USDC** Borrow by 0x286c',
        '[TX](<https://etherscan.io/tx/0x601ac0039538a372c28f935b5e94d73af39507da4bc3d48829d843666009b26c>) 📈 **$207 of WETH** SupplyCollateral by 0x286c',
      ],
      '0x0af00f9f5b1d43f3d1d4c0dd4cfbc91123723cb466153a431a3ad229b5089dcc': [
        '[TX](<https://etherscan.io/tx/0x0af00f9f5b1d43f3d1d4c0dd4cfbc91123723cb466153a431a3ad229b5089dcc>) 🐳📥 **$1,006 of USDC** Supply by 0x6b4c',
      ],
      '0x1ba5895e8eb1ce7e2478f42ca0157ef6d238ebb2d3627edc284bb5cd983cc760': [
        '[TX](<https://etherscan.io/tx/0x1ba5895e8eb1ce7e2478f42ca0157ef6d238ebb2d3627edc284bb5cd983cc760>) 🐳📉 **$14,329 of COMP** WithdrawCollateral by 0xeaf6',
      ],
      '0xa7f894811980b389afa8c203fc5f810bb485e367331aeff66b4f0ab72334b2ee': [
        '[TX](<https://etherscan.io/tx/0xa7f894811980b389afa8c203fc5f810bb485e367331aeff66b4f0ab72334b2ee>) 🐳📈 **$47,612 of WETH** SupplyCollateral by 0x33D3',
        '[TX](<https://etherscan.io/tx/0xa7f894811980b389afa8c203fc5f810bb485e367331aeff66b4f0ab72334b2ee>) 🐳📤 **$10,000 of USDC** Borrow by 0x33D3',
      ],
      '0x9ef17181d14ba5309e375678f473baa8cc8b54b52a81f8b38ca66e766a007f4a': [
        '[TX](<https://etherscan.io/tx/0x9ef17181d14ba5309e375678f473baa8cc8b54b52a81f8b38ca66e766a007f4a>) 🐳 ♻ **$6,080 of WBTC** AbsorbCollateral by 0xAec1',
        '[TX](<https://etherscan.io/tx/0x9ef17181d14ba5309e375678f473baa8cc8b54b52a81f8b38ca66e766a007f4a>) 🐳 ♻ **$60,400 of WETH** AbsorbCollateral by 0xAec1',
        '[TX](<https://etherscan.io/tx/0x9ef17181d14ba5309e375678f473baa8cc8b54b52a81f8b38ca66e766a007f4a>) 🐳 ♻ **$63,156 of USDC** AbsorbDebt by 0x4970',
      ],
      '0xeed2efa30decaf09f7c67e1991783d910f9f97c524be5b6a2a11cd79911918ae': [
        '[TX](<https://etherscan.io/tx/0xeed2efa30decaf09f7c67e1991783d910f9f97c524be5b6a2a11cd79911918ae>) 📥 **5 WETH** Supply by 0xaEB2',
      ],
      '0xef8ceabadba3275490990be8a447368ac2a499d51121464bb7776836238a5e44': [
        '[TX](<https://etherscan.io/tx/0xef8ceabadba3275490990be8a447368ac2a499d51121464bb7776836238a5e44>) 🐳📥 **1,489 WETH** Supply by 0xcfc5',
      ],
      '0x4c600770b464e6634692ad3c5892bbd717e56817ffeae0b9de1ec58305b04949': [
        '[TX](<https://etherscan.io/tx/0x4c600770b464e6634692ad3c5892bbd717e56817ffeae0b9de1ec58305b04949>) 📈 **100 WETH worth of cbETH** SupplyCollateral by 0xcF63',
        '[TX](<https://etherscan.io/tx/0x4c600770b464e6634692ad3c5892bbd717e56817ffeae0b9de1ec58305b04949>) 📤 **80 WETH** Borrow by 0xcF63',
      ],
      '0x5ab39d54e2a629d26df297b883499e9eb3e7bde040fe0806411849e817040867': [
        '[TX](<https://etherscan.io/tx/0x5ab39d54e2a629d26df297b883499e9eb3e7bde040fe0806411849e817040867>) 📥 **25 WETH** Supply by 0x52d8',
      ],
    };

    let txList = Object.keys(testTransactions);

    // Get Defender AutoTaskEvents for each transaction
    if (txArgument !== undefined) {
      txList = [txArgument];
    }

    txList.forEach(async (transactionHash) => {
      promiseList.push(getSentinelRequest('USDC MarketActivity Monitor', transactionHash));
    });

    let responses = await Promise.all(promiseList);

    // Pass each AutoTaskEvent to the Market Activity Monitor AutoTask
    promiseList = [];
    responses.forEach(async (autoTaskEvent) => {
      // run the autoTask on the events
      // eslint-disable-next-line no-param-reassign
      autoTaskEvent.secrets = { market_activity_USDC_mainnet_webhookURL: 'http://localhost/index.html' };
      promiseList.push(handler(autoTaskEvent));
    });
    responses = await Promise.allSettled(promiseList);

    const discordMessageDict = {};
    // Display each Discord post
    for (let i = 0; i < axios.mock.calls.length; ++i) {
      for (let j = 0; j < axios.mock.calls[i].length; ++j) {
        // create a dictionary of messages for each transaction
        const message = axios.mock.calls[i][j].data.content;
        const txHash = message.match('https://etherscan.io/tx/(0x[0-9a-zA-Z]*)>')[1];
        if (discordMessageDict[txHash] === undefined) {
          discordMessageDict[txHash] = [];
        }
        discordMessageDict[txHash].push(message);
      }
    }

    // Transaction hash passed in via argument, don't check output
    if (txArgument !== undefined) {
      console.log(`Discord Messages:\n${discordMessageDict[txArgument].join('\n')}`);
      return;
    }

    const txMessageError = [];
    Object.keys(testTransactions).forEach((testTx) => {
      const expectedList = testTransactions[testTx];
      if (discordMessageDict[testTx] === undefined) {
        discordMessageDict[testTx] = [];
      }
      const returnedList = discordMessageDict[testTx];
      expectedList.sort();
      const expectedMessagesStr = expectedList.join(' ');
      returnedList.sort();
      const returnedMessagesStr = returnedList.join(' ');
      if (expectedMessagesStr !== returnedMessagesStr) {
        txMessageError.push(testTx);
      }
    });

    if (txMessageError.length !== 0) {
      txMessageError.forEach((tx) => {
        console.error(`TX: ${tx}\n \
         Expected: ${testTransactions[tx].join('\n\t')}\n\n \
         Received: ${discordMessageDict[tx].join('\n\t')}`);
      });
      throw new Error(`${txMessageError.length} invalid messages found`);
    }
  });
});
