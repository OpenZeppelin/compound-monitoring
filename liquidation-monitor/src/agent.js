const {
  // Finding,
  // FindingSeverity,
  // FindingType,
  ethers,
  getEthersProvider,
} = require('forta-agent');
const BigNumber = require('bignumber.js');

// To-do: Replace node-fetch with axios and remove TS
const config = require('../agent-config.json');
const { getAbi, ts, callAPI } = require('./utils');

// Stores information about each account
const initializeData = {};

ts('Starting bot');

// #region Global functions
async function verifyToken(data, tokenAddressImport) {
  // To-do: move this region to a function, for cleaner DRY code.
  /* eslint-disable no-param-reassign */
  const tokenAddress = tokenAddressImport.toLowerCase();
  if (data.tokens[tokenAddress] === undefined) {
    data.tokens[tokenAddress] = {};
    data.tokens[tokenAddress].contract = new ethers.Contract(
      tokenAddress,
      data.cTokenABI,
      data.provider,
    );
    const cContract = data.tokens[tokenAddress].contract;
    data.tokens[tokenAddress].symbol = await cContract.symbol();
    // cETH does not have an underlying contract, so we peg it to wETH instead
    if (tokenAddress === '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5') {
      data.tokens[tokenAddress].underlying = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    } else {
      data.tokens[tokenAddress].underlying = await cContract.underlying();
    }
    const exchangeRate = await cContract.exchangeRateStored();
    data.tokens[tokenAddress].cTokenDecimals = await cContract.decimals();
    // Token to cToken is approximately 0.02 * 10**(10 + tokenDecimals)
    // So the trick to get token decimals is exchangeRate.lenth - 9
    data.tokens[tokenAddress].tokenDecimals = exchangeRate.toString().length - 9;
    data.tokens[tokenAddress].tokenDecimalsMult = BigNumber(10)
      .pow(data.tokens[tokenAddress].tokenDecimals);
    data.tokens[tokenAddress].cTokenDecimalsMult = BigNumber(10)
      .pow(data.tokens[tokenAddress].cTokenDecimals);
    data.tokens[tokenAddress].exchangeRate = BigNumber(exchangeRate.toString());
    // Adjusting the multiplier for easier use later.
    data.tokens[tokenAddress].exchangeRateMult = BigNumber(exchangeRate.toString())
      .dividedBy(data.tokens[tokenAddress].tokenDecimalsMult)
      .dividedBy(data.tokens[tokenAddress].cTokenDecimalsMult)
      .dividedBy(100); // Not sure where this 100 comes from I didn't see it in the docs

    if (data.borrow[tokenAddress] === undefined) {
      data.borrow[tokenAddress] = {};
    }
    if (data.supply[tokenAddress] === undefined) {
      data.supply[tokenAddress] = {};
    }
    /* eslint-enable no-param-reassign */

    ts(
      String(
        `Now tracking ${data.tokens[tokenAddress].symbol
        } with ${data.tokens[tokenAddress].tokenDecimals
        } decimals at address ${tokenAddress}`,
      ),
    );
  }
}
// #endregion

// Initializes data required for handler
function provideInitialize(data) {
  return async function initialize() {
    // #region Assign configurable fields
    /* eslint-disable no-param-reassign */
    data.alertMinimumIntervalSeconds = config.alertMinimumIntervalSeconds;
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;
    data.alert = config.liquidationMonitor.alert;
    data.minimumShortfallInUSD = config.liquidationMonitor.triggerLevels.minimumShortfallInUSD;
    data.cTokenABI = getAbi('cErc20.json');
    data.provider = getEthersProvider();
    data.accounts = {}; // Health of all accounts, calcHealth, lastUpdated, [assetsIn addresses]?
    data.supply = {}; // qty of cTokens (not Tokens)
    data.borrow = {}; // qty of Tokens (not cTokens)
    data.tokens = {}; // each cToken's address, symbol, contract, ratio, price, lastUpdatePrice
    data.newAccounts = []; // New account from transaction events
    // Test
    data.test = 0;

    // Compound API filter and Comptroller contract
    const { maximumHealth, minimumBorrowInETH } = config.liquidationMonitor.triggerLevels;
    const {
      comptrollerAddress, maxTrackedAccounts,
      oracleAddress, feedRegistryAddress, oneInchAddress
    } = config.liquidationMonitor;
    const comptrollerABI = getAbi(config.liquidationMonitor.comptrollerABI);
    const oracleABI = getAbi(config.liquidationMonitor.oracleABI);
    const feedRegistryABI = getAbi(config.liquidationMonitor.feedRegistryABI);
    const oneInchABI = getAbi(config.liquidationMonitor.oneInchABI);
    data.comptrollerContract = new ethers.Contract(
      comptrollerAddress,
      comptrollerABI,
      data.provider,
    );
    data.oneInchContract = new ethers.Contract(
      oneInchAddress,
      oneInchABI,
      data.provider,
    );
    // Unused but available for the future
    data.oracleContract = new ethers.Contract(
      oracleAddress,
      oracleABI,
      data.provider,
    );
    // Unused, did not work
    data.feedRegistryContract = new ethers.Contract(
      feedRegistryAddress,
      feedRegistryABI,
      data.provider,
    );
    // Chainlink calls don't work expected.
    // https://docs.chain.link/docs/feed-registry/
    // const ethDenom = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    // const cusdcDenom = '0x39aa39c021dfbae8fac545936693ac917d5e7563';
    // const test = await data.feedRegistryContract.latestRoundData(cusdcDenom, ethDenom);
    // Errors with:too many arguments: passed to contract
    // (count = 2, expectedCount = 0, code = UNEXPECTED_ARGUMENT, version = contracts / 5.6.0)

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
    ts(String(`Total Entries ${totalEntries}`));
    ts(String(`maxTrackedAccounts ${maxTrackedAccounts}`));

    // Determine number of pages needed to query. Results vs config limit.
    const maxEntries = Math.min(maxTrackedAccounts, totalEntries);
    const maxPages = Math.ceil(maxEntries / 100);
    ts(String(`maxPages ${maxPages}`));

    // Query each page and add accounts. Starting at 1 and including maxPages
    const accounts = [];
    const pages = [...Array(maxPages)].map((_, i) => 1 + i);
    await Promise.all(pages.map(async (page) => {
      // for (let page = 1; page <= maxPages; page++) {
      const currentRequest = buildJsonRequest(
        maximumHealth,
        minimumBorrowInETH,
        page,
        2, // Testing, so only pulling 2 accounts per page. Later increase to 100.
      );
      const apiResults = await callAPI(apiURL, currentRequest);
      apiResults.accounts.forEach((account) => {
        accounts.push(account);
      });
      ts(String(`Imported ${page}00 accounts`));
    }));
    ts(String(`Tracking ${accounts.length} accounts`));
    // #endregion

    // #region Parse Compound data into new objects

    // Get a unique list of token addresses
    ts('Processing tokens now');
    const tokenSet = new Set();
    accounts.forEach((account) => {
      account.tokens.forEach(async (token) => {
        tokenSet.add(token.address);
      });
    });
    // Async function verifies or builds data.token[token]
    // To-do: Can this be moved to utils and still reference data.tokens?

    // Initialize token objects
    await Promise.all(Array.from(tokenSet).map(async (token) => {
      await verifyToken(data, token);
    }));

    // Loop through found accounts
    ts('Updating user balances');
    accounts.forEach((account) => {
      // add to tracked accounts
      /* eslint-disable no-param-reassign */
      if (data.accounts[account.address] === undefined) {
        data.accounts[account.address] = {};
      }
      // Add found health
      data.accounts[account.address].health = BigNumber(account.health.value);
      // Loop through tokens and update balances.
      account.tokens.forEach((token) => {
        // Process borrows as 'token'
        /* eslint-disable eqeqeq */
        if (
          token.borrow_balance_underlying !== undefined
          && token.borrow_balance_underlying.value != 0
        ) {
          data.borrow[token.address][account.address] = BigNumber(
            token.borrow_balance_underlying.value,
          );

          ts(
            String(
              `User ${[account.address]
              } borrowed ${Math.round(token.borrow_balance_underlying.value)
              } ${data.tokens[token.address].symbol}`,
            ),
          );
        }
        // Process supplies as 'cTokens'
        if (
          token.supply_balance_underlying !== undefined
          && token.supply_balance_underlying.value != 0
        ) {
          data.supply[token.address][account.address] = BigNumber(
            token.supply_balance_underlying.value,
          ).dividedBy(data.tokens[token.address].exchangeRateMult);

          ts(
            `User ${[account.address]
            } supplied ${Math.round(token.supply_balance_underlying.value)
            } ${data.tokens[token.address].symbol
            } ( ${Math.round(data.supply[token.address][account.address])
            } cTokens ) `,
          );
        }
        /* eslint-enable eqeqeq */
      }); // end token loop
      /* eslint-enable no-param-reassign */
    }); // end account loop
    // #endregion
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    // Filter all new transactions and look for new accounts to track.
    const borrowString = 'event Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows)';
    const exitMarketString = 'event MarketExited(address cToken, address account)';

    const exitMarketEvents = txEvent.filterLog(exitMarketString);
    exitMarketEvents.forEach((exitEvent) => {
      ts(`${exitEvent.args.account} exited from ${exitEvent.args.account} `);
      data.newAccounts.push(exitEvent.args.account);
    });
    const borrowEvents = txEvent.filterLog(borrowString);
    borrowEvents.forEach((borrowEvent) => {
      ts(`${borrowEvent.args.borrower} borrowed ${borrowEvent.args.borrowAmount} `);
      data.newAccounts.push(borrowEvent.args.borrower);
    });

    // Return zero findings
    return [];
  };
}

function provideHandleBlock(data) {
  return async function handleBlock(blockEvent) {
    const findings = [];
    const { comptrollerContract, oneInchContract } = data;

    // To-do: add listener to find new and updated accounts


    // #region Update Balances on zero health accounts
    const filteredAccounts = [];
    Object.keys(data.accounts).forEach((currentAccount) => {
      // Uncomment this line when done testing
      // if (data.accounts[currentAccount].health != null
      // && data.accounts[currentAccount].health === 0) {
      if (data.accounts[currentAccount].health == null
        || data.accounts[currentAccount].health === 0) {
        filteredAccounts.push(currentAccount);
        // Zero account balances
        /* eslint-disable no-param-reassign */
        Object.keys(data.supply).forEach((currentToken) => {
          data.supply[currentToken][currentAccount] = null;
        });
        Object.keys(data.borrow).forEach((currentToken) => {
          data.borrow[currentToken][currentAccount] = null;
          /* eslint-enable no-param-reassign */
        });
      }
    });

    // Grab the assets in first, and make sure they are initialized
    ts('Getting assetsIn list for new accounts');
    const tokenSet = new Set();
    await Promise.all(filteredAccounts.map(async (currentAccount) => {
      let assetsIn = await comptrollerContract.getAssetsIn(currentAccount);
      assetsIn = assetsIn.map((asset) => asset.toLowerCase());
      assetsIn.forEach((asset) => { tokenSet.add(asset); });
      /* eslint-disable no-param-reassign */
      data.accounts[currentAccount].assetsIn = assetsIn;
      /* eslint-enable no-param-reassign */
    }));

    // // Initialize token objects
    ts('Checking for new tokens');
    await Promise.all(Array.from(tokenSet).map(async (token) => {
      await verifyToken(data, token);
    }));

    // Grab token balances from on-chain
    ts('Updating balances');
    await Promise.all(filteredAccounts.map(async (currentAccount) => {
      await Promise.all(data.accounts[currentAccount].assetsIn.map(async (currentToken) => {
        const snapshot = await data.tokens[currentToken].contract
          .getAccountSnapshot(currentAccount);

        /* eslint-disable no-param-reassign */
        if (snapshot && snapshot[1].toString() !== '0') {
          data.supply[currentToken][currentAccount] = BigNumber(snapshot[1].toString())
            .dividedBy(data.tokens[currentToken].cTokenDecimalsMult);
          const tokenQty = data.supply[currentToken][currentAccount]
            .multipliedBy(data.tokens[currentToken].exchangeRateMult);
          ts(
            `User ${currentAccount
            } supplied ${Math.round(tokenQty)
            } ${data.tokens[currentToken].symbol
            } ( ${Math.round(data.supply[currentToken][currentAccount])
            } cTokens ) `,
          );
        }
        if (snapshot && snapshot[2].toString() !== '0') {
          data.borrow[currentToken][currentAccount] = BigNumber(snapshot[2].toString())
            .dividedBy(data.tokens[currentToken].tokenDecimalsMult);
          ts(
            `User ${currentAccount
            } borrowed ${Math.round(data.borrow[currentToken][currentAccount])
            } ${data.tokens[currentToken].symbol}`,
          );
        }
        /* eslint-enable no-param-reassign */
        return null;
      }));
    }));
    // #endregion

    // #region Update all token prices via 1inch for now.
    ts('Updating token prices and collateral factors');
    // To-Do: Switch the primary feed back to ChainLink
    await Promise.all(Object.keys(data.tokens).map(async (currentToken) => {
      const price = await oneInchContract.getRateToEth(data.tokens[currentToken].underlying, 0);
      // Adjust for native decimals
      const oneInchMult = BigNumber(10).pow(36 - data.tokens[currentToken].tokenDecimals);
      data.tokens[currentToken].price = BigNumber(price.toString())
        .dividedBy(oneInchMult);
      // Update the Collateral Factor
      const market = await comptrollerContract.markets(currentToken);
      data.tokens[currentToken].collateralMult = BigNumber(market[1].toString())
        .dividedBy(BigNumber(10).pow(18));
      ts(
        `Updated price of ${data.tokens[currentToken].symbol
        } is ${data.tokens[currentToken].price.toString()
        } ETH with a collateral factor of ${data.tokens[currentToken].collateralMult}`,
      );
    }));
    // #endregion

    // #region Calculate health on all accounts
    ts('Health recalculation');
    Object.keys(data.accounts).forEach((account) => {
      let borrowBalance = BigNumber(0);
      let supplyBalance = BigNumber(0);
      Object.keys(data.tokens).forEach((token) => {
        if (data.supply[token][account]) {
          // Supply balances are stored in cTokens and need to be multiplied by the
          //   exchange rate and reduced by the collateral factor
          supplyBalance = supplyBalance.plus(data.supply[token][account]
            .multipliedBy(data.tokens[token].exchangeRateMult)
            .multipliedBy(data.tokens[token].price)
            .multipliedBy(data.tokens[token].collateralMult));
        }
        if (data.borrow[token][account]) {
          // Only need to multiply by the price.
          borrowBalance = borrowBalance.plus(data.borrow[token][account]
            .multipliedBy(data.tokens[token].price));
        }
      });
      ts(
        `Account ${account} supplies ETH ${supplyBalance.toFixed(3)} and borrows ${borrowBalance.toFixed(3)} ETH`,
      );
      // Remove non-borrowers
      if (borrowBalance.eq(0)) {
        delete data.accounts[account];
      } else {
        const prevHealth = data.accounts[account].health;
        data.accounts[account].supplyBalance = supplyBalance;
        data.accounts[account].borrowBalance = borrowBalance;
        data.accounts[account].health = supplyBalance.dividedBy(borrowBalance);
        ts(
          `Account ${account} updated health from ${prevHealth.toFixed(3)} to ${data.accounts[account].health.toFixed(3)}`,
        );
      }
    });
    // #endregion

    ts(data.newAccounts);

    // Accounts with low health can be checked on chain for a final health score.
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

        // // Add to findings
      }
    });
    await Promise.all(promises);
    */

    return findings;
  };
}

// exports
module.exports = {
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  provideInitialize,
  initialize: provideInitialize(initializeData),
};
