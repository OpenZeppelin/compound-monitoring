const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
  getEthersProvider,
} = require('forta-agent');
const BigNumber = require('bignumber.js');

// To-do: Replace node-fetch with axios and remove TS
//const fetch = require('node-fetch-commonjs');
const config = require('../agent-config.json');
const { getAbi, ts, callAPI } = require('./utils');

// Stores information about each account
const initializeData = {};

ts('Starting bot');

// Initializes data required for handler
function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */

    // #region Assign configurable fields
    data.alertMinimumIntervalSeconds = config.alertMinimumIntervalSeconds;
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;
    data.alert = config.liquidationMonitor.alert;
    data.minimumShortfallInUSD =
      config.liquidationMonitor.triggerLevels.minimumShortfallInUSD;
    data.cTokenABI = getAbi('cErc20.json');
    data.provider = getEthersProvider();
    data.accounts = {}; // Health of all accounts, calcHealth, lastUpdated, [assets in addresses]?
    data.supply = {}; // qty of cTokens (not Tokens)
    data.borrow = {}; // qty of Tokens (not cTokens)
    data.tokens = {}; // each cToken's address, symbol, contract, ratio, price, lastUpdatePrice

    // Compound API filter and Comptroller contract
    const { maximumHealth, minimumBorrowInETH } =
      config.liquidationMonitor.triggerLevels;
    const { comptrollerAddress, maxTrackedAccounts } =
      config.liquidationMonitor;
    const comptrollerABI = getAbi(config.liquidationMonitor.comptrollerABI);
    data.comptrollerContract = new ethers.Contract(
      comptrollerAddress,
      comptrollerABI,
      data.provider,
    );
    /* eslint-enable no-param-reassign */
    // #endregion

    // #region Get initial accounts from Compound API
    const apiURL = 'https://api.compound.finance/api/v2/account';

    // Helper for Compound API
    function buildJsonRequest(maxHealth, minBorrow, pageNumber, pageSize) {
      const jsonRequest = {
        addresses: [], // returns all accounts if empty or not included
        block_number: 0, // returns latest if given 0
        max_health: { value: maxHealth },
        min_borrow_value_in_eth: { value: minBorrow },
        page_number: pageNumber,
        page_size: pageSize,
      };
      return jsonRequest;
    }

    // Find total number of results with the first request
    const initialRequest = buildJsonRequest(
      maximumHealth,
      minimumBorrowInETH,
      1,
      1,
    );
    const initialResults = await callAPI(apiURL, initialRequest);
    const totalEntries = initialResults.pagination_summary.total_entries;
    ts(String('Total Entries ' + totalEntries));
    ts(String('maxTrackedAccounts ' + maxTrackedAccounts));

    // Determine number of pages needed to query. Results vs config limit.
    const maxEntries = Math.min(maxTrackedAccounts, totalEntries);
    const maxPages = Math.ceil(maxEntries / 100);
    ts(String('maxPages ' + maxPages));

    // Query each page and add accounts. Starting at 1 and including maxPages
    let accounts = [];
    for (page = 1; page <= maxPages; page++) {
      const initialRequest = buildJsonRequest(
        maximumHealth,
        minimumBorrowInETH,
        page,
        2, // Testing, so only pulling 2 accounts per page. Later increase to 100.
      );
      const apiResults = await callAPI(apiURL, initialRequest);
      apiResults.accounts.forEach((account) => {
        accounts.push(account);
      });
      ts(String('Imported ' + page + '00 accounts'));
    }
    ts(String('Tracking ' + accounts.length + ' accounts'));
    // #endregion

    // Async function verifies or builds data.token[token]
    // used in the next 2 loops
    // To-do: Can this be moved to utils and still reference data.tokens?
    async function verifyToken(tokenAddress) {
      // To-do: move this region to a function, for cleaner DRY code.
      if (data.tokens[tokenAddress] === undefined) {
        data.tokens[tokenAddress] = {};
        data.tokens[tokenAddress].contract = new ethers.Contract(
          tokenAddress,
          data.cTokenABI,
          data.provider,
        );
        const cContract = data.tokens[tokenAddress].contract;
        data.tokens[tokenAddress].symbol = await cContract.symbol();
        const exchangeRate = await cContract.exchangeRateStored();
        data.tokens[tokenAddress].cTokenDecimals = await cContract.decimals();
        // Token to cToken is approximately 0.02 * 10**(10 + tokenDecimals)
        // So the trick to get token decimals is exchangeRate.lenth - 9
        data.tokens[tokenAddress].tokenDecimals = exchangeRate.toString().length - 9;
        data.tokens[tokenAddress].tokenDecimalsMult = BigNumber(10).pow(data.tokens[tokenAddress].tokenDecimals);
        data.tokens[tokenAddress].cTokenDecimalsMult = BigNumber(10).pow(data.tokens[tokenAddress].cTokenDecimals);
        data.tokens[tokenAddress].exchangeRate = BigNumber(exchangeRate.toString());
        // Adjusting the multiplier for easier use later.
        data.tokens[tokenAddress].exchangeRateMult = BigNumber(exchangeRate.toString()).
          dividedBy(data.tokens[tokenAddress].tokenDecimalsMult).
          dividedBy(data.tokens[tokenAddress].cTokenDecimalsMult).
          dividedBy(100); // Not sure where this 100 comes from I didn't see it in the docs

        ts(
          String(
            'Now tracking ' +
            data.tokens[tokenAddress].symbol +
            ' with ' +
            data.tokens[tokenAddress].tokenDecimals +
            ' decimals at address ' +
            tokenAddress,
          ),
        );
      }
      if (data.borrow[tokenAddress] === undefined) {
        data.borrow[tokenAddress] = {};
      }
      if (data.supply[tokenAddress] === undefined) {
        data.supply[tokenAddress] = {};
      }
    }

    // #region Parse Compound data into new objects
    // Process all tokens first
    ts('Processing tokens now')
    const tokenSet = new Set();
    accounts.forEach((account) => {
      account.tokens.forEach(async (token) => {
        tokenSet.add(token.address);
      });
    });
    await Promise.all(Array.from(tokenSet).map(async (token) => {
      await verifyToken(token);
    }));

    // Loop through found accounts
    ts('Updating user balances');
    accounts.forEach((account) => {
      // add to tracked accounts
      if (data.accounts[account.address] === undefined) {
        data.accounts[account.address] = {};
      }
      // Loop through tokens and update balances.
      account.tokens.forEach((token) => {
        // Process borrows as 'token'
        if (
          token.borrow_balance_underlying !== undefined &&
          token.borrow_balance_underlying.value != 0
        ) {
          data.borrow[token.address][account.address] = BigNumber(
            token.borrow_balance_underlying.value);

          ts(
            String(
              'User ' +
              [account.address] +
              ' borrowed ' +
              Math.round(token.borrow_balance_underlying.value) +
              ' ' +
              data.tokens[token.address].symbol,
            ),
          );
        }
        // Process supplies as 'cTokens' 
        if (
          token.supply_balance_underlying !== undefined &&
          token.supply_balance_underlying.value != 0
        ) {
          data.supply[token.address][account.address] = BigNumber(
            token.supply_balance_underlying.value,
          ).dividedBy(data.tokens[token.address].exchangeRateMult);

          ts(
            String(
              'User ' +
              [account.address] +
              ' supplied ' +
              Math.round(token.supply_balance_underlying.value) +
              ' ' +
              data.tokens[token.address].symbol +
              ' ( ' +
              Math.round(data.supply[token.address][account.address]) +
              ' cTokens ) '
            ),
          );
        }
      }); // end token loop
    }); // end account loop
    // #endregion
  };
}

// To-do: find highest values of each trigger for the initial filter
// const { maximumHealth, minimumBorrowInETH, minimumShortfallInUSD } =
//   triggerLevels;

let findingsCount = 0;

const handleBlock = async (blockEvent) => {
  const findings = [];

  // Compound API, find accounts near liquidation
  // To-do: Save accounts to reduce reliance on Compound calls.

  // Get list of possible loanable assets from compound

  // Get prices of all assets in ETH via UNISWAP ? Maybe rely on compound.

  // Loop through found accounts and check on-chain for liquidity in USD
  // accounts.forEach((account) => {

  /*
  const promises = accounts.map(async (account) => {
    const {
      address,
      health: { value: health },
      total_borrow_value_in_eth: { value: borrowValue },
      total_collateral_value_in_eth: { value: collateralValue },
    } = account;

    // function getAccountLiquidity(address account) view returns (uint, uint, uint)
    // returns(error, liquidity, shortfall) If shortfall is non-zero, account is underwater.
    const accLiquidity = await comptrollerContract.getAccountLiquidity(
      account.address,
    );
    const shortfallUSD = ethers.utils.formatEther(accLiquidity[2]);

    if (
      health <= maximumHealth &&
      borrowValue >= minimumBorrowInETH &&
      collateralValue >= minimumShortfallInUSD
    ) {
      console.log('---Account ', address);
      console.log('---Health: ', health);
      console.log('---Borrowed (in ETH): ', borrowValue);
      console.log('---Collateral (in ETH): ', collateralValue);
      console.log('---Liquidatable amount (in USD): ', shortfallUSD);

      // // Extra: Breakdown of which tokens are borrowed and how much
      // comptroller getMarketsIn(address) to see which tokens are being borrowed from.
      // go to those cTokens to call borrowBalanceStored() to check for amount borrowed.
      // To-do: How to look up collateral? Is this needed? Or go with the liquidity function and API?

      // // Add to findings
    }
  });
  await Promise.all(promises);
  */

  return findings;
};

module.exports = {
  // handleTransaction,
  handleBlock,
  provideInitialize,
  initialize: provideInitialize(initializeData),
  // provideHandleTransaction,
  // handleTransaction: provideHandleTransaction(initializeData),
  // createDistributionAlert,
};
