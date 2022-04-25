const {
  Finding,
  FindingSeverity,
  FindingType,
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
function createAlert(
  developerAbbreviation,
  protocolName,
  protocolAbbreviation,
  type,
  severity,
  borrowerAddress,
  liquidationAmount,
  shortfallAmount,
) {
  return Finding.fromObject({
    name: `${protocolName} Compound Liquidation Threshold Alert`,
    description: `The address ${borrowerAddress} has dropped below the liquidation threshold. `
      + `The account may be liquidated for: $${liquidationAmount} USD`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
    protocol: protocolName,
    metadata: {
      borrowerAddress,
      liquidationAmount,
      shortfallAmount,
    },
  });
}

async function verifyToken(data, tokenAddressImport) {
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
    // cETH does not have an underlying contract, so peg it to wETH instead
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
      `Now tracking ${data.tokens[tokenAddress].symbol
      } with ${data.tokens[tokenAddress].tokenDecimals
      } decimals at address ${tokenAddress}`,
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
    data.minimumLiquidationInUSD = config.liquidationMonitor.triggerLevels.minimumLiquidationInUSD;
    data.cTokenABI = getAbi('cErc20.json');
    data.provider = getEthersProvider();
    data.accounts = {}; // Health of all accounts, calcHealth, lastUpdated, [assetsIn addresses]?
    data.supply = {}; // qty of cTokens (not Tokens)
    data.borrow = {}; // qty of Tokens (not cTokens)
    data.tokens = {}; // each cToken's address, symbol, contract, ratio, price, lastUpdatePrice
    data.newAccounts = []; // New account from transaction events
    data.totalNewAccounts = 0;

    // Compound API filter and Comptroller contract
    const { maximumHealth, minimumBorrowInETH } = config.liquidationMonitor.triggerLevels;
    const {
      comptrollerAddress, maxTrackedAccounts,
      oracleAddress, feedRegistryAddress, oneInchAddress,
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
    // ChainLink calls don't work expected.
    // https://docs.chain.link/docs/feed-registry/
    // const ethDenom = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    // const cUSDDenom = '0x39aa39c021dfbae8fac545936693ac917d5e7563';
    // const test = await data.feedRegistryContract.latestRoundData(cUSDDenom, ethDenom);
    // Errors with:too many arguments: passed to contract
    // (count = 2, expectedCount = 0, code = UNEXPECTED_ARGUMENT, version = contracts / 5.6.0)

    /* eslint-enable no-param-reassign */
    // #endregion

    // #region Get initial accounts from Compound API
    // To-do: Can be bootstrapped with ~30 eth_getLogs calls,  500k blocks per call, using filter:
    // Borrow (address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows)
    // topic0: 0x13ed6866d4e1ee6da46f845c46d7e54120883d75c5ea9a2dacc1c4ca8984ab80

    // Simple bootstrap with Compound for now
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
    ts(`Total Entries ${totalEntries}`);
    ts(`maxTrackedAccounts ${maxTrackedAccounts}`);

    // Determine number of pages needed to query. Results vs config limit.
    const maxEntries = Math.min(maxTrackedAccounts, totalEntries);
    const maxPages = Math.ceil(maxEntries / 100);

    // Query each page and add accounts. Starting at 1 and including maxPages
    const accounts = [];
    const pages = [...Array(maxPages)].map((_, i) => 1 + i);
    await Promise.all(pages.map(async (page) => {
      const currentRequest = buildJsonRequest(
        maximumHealth,
        minimumBorrowInETH,
        page,
        100, // 100 results per page was optimal
      );
      const apiResults = await callAPI(apiURL, currentRequest);
      apiResults.accounts.forEach((account) => {
        accounts.push(account);
      });
      ts(`Imported batch ${page}00 accounts`);
    }));
    ts(`Tracking ${accounts.length} accounts`);
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

    // Initialize token objects first
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
            `User ${[account.address]
            } borrowed ${Math.round(token.borrow_balance_underlying.value)
            } ${data.tokens[token.address].symbol}`,
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
    // #region Filter logs and look for new account activity.
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
    // #endregion

    // Return zero findings
    return [];
  };
}

function provideHandleBlock(data) {
  return async function handleBlock(blockEvent) {
    ts(`Starting block ${blockEvent.blockNumber}`);
    const findings = [];
    const { comptrollerContract, oneInchContract } = data;

    // #region Add new Accounts
    ts(
      `Currently tracking ${Object.keys(data.accounts).length
      } accounts and adding ${data.newAccounts.length
      } account(s) this block. ${data.totalNewAccounts
      } total accounts added since start.`,
    );
    data.newAccounts.forEach((newAccount) => {
      const account = newAccount.toLowerCase();
      // Initialize account. New accounts will get updated in the block section
      /* eslint-disable no-param-reassign */
      data.accounts[account] = {};
      /* eslint-enable no-param-reassign */
    });
    /* eslint-disable no-param-reassign */
    data.totalNewAccounts += data.newAccounts.length;
    data.newAccounts = [];
    /* eslint-enable no-param-reassign */
    // #endregion

    // #region Update Balances on zero health accounts
    const filteredAccounts = [];
    Object.keys(data.accounts).forEach((currentAccount) => {
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
      /* eslint-disable no-param-reassign */
      data.tokens[currentToken].price = BigNumber(price.toString())
        .dividedBy(oneInchMult);
      // Update the Collateral Factor
      const market = await comptrollerContract.markets(currentToken);
      data.tokens[currentToken].collateralMult = BigNumber(market[1].toString())
        .dividedBy(BigNumber(10).pow(18));
      /* eslint-enable no-param-reassign */
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

      // Remove non-borrowers
      if (borrowBalance.eq(0)) {
        /* eslint-disable no-param-reassign */
        delete data.accounts[account];
      } else {
        data.accounts[account].supplyBalance = supplyBalance;
        data.accounts[account].borrowBalance = borrowBalance;
        data.accounts[account].health = supplyBalance.dividedBy(borrowBalance);
        /* eslint-enable no-param-reassign */
      }
    });
    // #endregion

    // #region Check for low health accounts currently health <1.03
    const lowHealthAccounts = [];
    Object.keys(data.accounts).forEach((currentAccount) => {
      if (data.accounts[currentAccount].health.isLessThan(1.03)) {
        lowHealthAccounts.push(currentAccount);
      }
    });
    ts(`${lowHealthAccounts.length} low health accounts detected`);
    await Promise.all(lowHealthAccounts.map(async (currentAccount) => {
      const liquidity = await data.comptrollerContract.getAccountLiquidity(currentAccount);
      const positiveUSD = BigNumber(ethers.utils.formatEther(liquidity[1]).toString());
      const shortfallUSD = BigNumber(ethers.utils.formatEther(liquidity[2]).toString());

      if (positiveUSD.gt(0)) {
        // Uncomment this if you want to see low liquidity as well.
        // ts(
        //   `Low liquidity on ${currentAccount
        //   } with health of ${data.accounts[currentAccount].health.dp(3)
        //   } and cash reserve of +$${positiveUSD.dp(2)} USD`,
        // );
      }
      if (shortfallUSD.gt(0)) {
        ts(
          `Negative liquidity on ${currentAccount} with health of ${data.accounts[currentAccount].health.dp(3)
          } and shortfall of +$${shortfallUSD.dp(2)} USD`,
        );
      }
      // Lower health means that less money that can be retrieved.
      const liquidationAmount = shortfallUSD.multipliedBy(data.accounts[currentAccount].health);
      if (liquidationAmount.isGreaterThan(data.minimumLiquidationInUSD)) {
        const newFinding = createAlert(
          data.developerAbbreviation,
          data.protocolName,
          data.protocolAbbreviation,
          data.alert.type,
          data.alert.severity,
          currentAccount,
          liquidationAmount.dp(2),
          shortfallUSD.dp(2),
        );
        findings.push(newFinding);
      }
      // Zero out the health on the low accounts so they may be re-scanned. (optional)
      // data.accounts[currentAccount] = {};
    }));
    // #endregion

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
