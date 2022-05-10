const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
  getEthersProvider,
} = require('forta-agent');
const BigNumber = require('bignumber.js');
const config = require('../agent-config.json');
const {
  getAbi, callCompoundAPI, buildJsonRequest,
} = require('./utils');

// Stores information about each account
const initializeData = {};

// Global functions
function createAlert(
  developerAbbreviation,
  protocolName,
  protocolAbbreviation,
  type,
  severity,
  borrowerAddress,
  liquidationAmount,
  shortfallAmount,
  healthFactor,
) {
  return Finding.fromObject({
    name: `${protocolName} Liquidation Threshold Alert`,
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
      healthFactor,
    },
  });
}

async function verifyToken(data, tokenAddressImport) {
  const { tokens } = data;
  const tokenAddress = tokenAddressImport.toLowerCase();
  if (tokens[tokenAddress] === undefined) {
    tokens[tokenAddress] = {};
    tokens[tokenAddress].contract = new ethers.Contract(
      tokenAddress, data.cTokenABI, data.provider,
    );
    const cContract = tokens[tokenAddress].contract;
    tokens[tokenAddress].symbol = await cContract.symbol();

    // cETH does not have an underlying contract, so link it to wETH instead
    if (tokenAddress === '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5') {
      tokens[tokenAddress].underlying = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    } else {
      tokens[tokenAddress].underlying = await cContract.underlying();
    }
    const exchangeRate = new BigNumber((await cContract.exchangeRateStored()).toString());
    tokens[tokenAddress].cTokenDecimals = new BigNumber(
      (await cContract.decimals()).toString(),
    );

    // Look up decimals of the underlying tokens as well.
    const decimalsABI = '["function decimals() view returns (uint)"]';
    const underlyingTokenContract = new ethers.Contract(
      tokens[tokenAddress].underlying, decimalsABI, data.provider,
    );
    tokens[tokenAddress].tokenDecimals = new BigNumber(
      (await underlyingTokenContract.decimals()).toString(),
    );

    tokens[tokenAddress].tokenDecimalsMult = new BigNumber(10)
      .pow(tokens[tokenAddress].tokenDecimals);
    tokens[tokenAddress].cTokenDecimalsMult = new BigNumber(10)
      .pow(tokens[tokenAddress].cTokenDecimals);

    // Adjusting the multiplier for easier use later.
    // “The current exchange rate as an unsigned integer, scaled by
    //   1 * 10 ^ (18 - 8 + Underlying Token Decimals)” - https://compound.finance/docs/ctokens#exchange-rate
    //   Simplified to 10^(10 + Underlying Token Decimals).
    const exchangeDecimalsMult = new BigNumber(10).pow(10);
    tokens[tokenAddress].exchangeRateMult = exchangeRate
      .dividedBy(exchangeDecimalsMult).dividedBy(tokens[tokenAddress].tokenDecimalsMult);

    if (data.borrow[tokenAddress] === undefined) data.borrow[tokenAddress] = {};
    if (data.supply[tokenAddress] === undefined) data.supply[tokenAddress] = {};
  }
}

// Initializes data required for handler
function provideInitialize(data) {
  return async function initialize() {
    // Assign configurable fields
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;
    data.alert = config.liquidationMonitor.alert;
    data.minimumLiquidationInUSD = config.liquidationMonitor.triggerLevels.minimumLiquidationInUSD;
    data.lowHealthThreshold = config.liquidationMonitor.triggerLevels.lowHealthThreshold;
    data.cTokenABI = getAbi('cErc20.json');
    data.provider = getEthersProvider();
    data.accounts = {}; // Health of all accounts, calcHealth, lastUpdated, [assetsIn addresses]
    data.supply = {}; // qty of cTokens (not Tokens)
    data.borrow = {}; // qty of Tokens (not cTokens)
    data.tokens = {}; // each cToken's address, symbol, contract, ratio, price, lastUpdatePrice
    data.newAccounts = []; // New account from transaction events
    data.totalNewAccounts = 0;

    // Compound API filter and Comptroller contract
    const {
      comptrollerAddress,
      oneInchAddress,
      triggerLevels: {
        maximumHealth,
        minimumBorrowInETH,
      },
    } = config.liquidationMonitor;
    const comptrollerABI = getAbi(config.liquidationMonitor.comptrollerABI);
    const oneInchABI = getAbi(config.liquidationMonitor.oneInchABI);
    data.comptrollerAddress = comptrollerAddress;
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

    // Get initial accounts from Compound API
    // Find total number of results with the first request
    const initialRequest = buildJsonRequest(maximumHealth, minimumBorrowInETH, 1, 1);
    const initialResults = await callCompoundAPI(initialRequest);
    const totalEntries = initialResults.pagination_summary.total_entries;

    // Determine number of pages needed to query.
    const pageIncrement = 100;
    const maxPages = Math.ceil(totalEntries / pageIncrement);

    // Query each page and add accounts. Starting at 1 and including maxPages
    // Shorthand Range() function. ( Ex: 5 => [1,2,3,4,5] )
    const pages = [...Array(maxPages)].map((_, i) => 1 + i);
    const foundAccounts = (await Promise.all(pages.map(async (page) => {
      const currentRequest = buildJsonRequest(
        maximumHealth, minimumBorrowInETH, page, pageIncrement,
      );
      const apiResults = await callCompoundAPI(currentRequest);
      return apiResults.accounts;
    }))).flat();

    // Parse Compound data into new objects
    // Get a full list of token addresses
    const foundTokens = foundAccounts
      .map((currentAccount) => currentAccount.tokens.map((token) => token.address)).flat();

    // Use Array to Set to Array to remove duplicates
    const filteredTokens = Array.from(new Set(foundTokens));

    // Initialize token objects first
    await Promise.all(filteredTokens.map(async (token) => {
      await verifyToken(data, token);
    }));

    // Loop through found accounts
    foundAccounts.forEach((account) => {
      const {
        address: accountAddress,
        health: {
          value,
        },
      } = account;

      // add to tracked accounts
      if (data.accounts[accountAddress] === undefined) data.accounts[accountAddress] = {};
      // Add found health
      data.accounts[accountAddress].health = new BigNumber(value);

      // Loop through tokens and update balances.
      account.tokens.forEach((token) => {
        const {
          borrow_balance_underlying: borrowBalanceUnderlying,
          supply_balance_underlying: supplyBalanceUnderlying,
          address: tokenAddress,
        } = token;

        // Process borrows as 'token'
        if (borrowBalanceUnderlying !== undefined && borrowBalanceUnderlying.value !== 0) {
          data.borrow[tokenAddress][accountAddress] = new BigNumber(borrowBalanceUnderlying.value);
        }
        // Process supplies as 'cTokens'
        if (supplyBalanceUnderlying !== undefined && supplyBalanceUnderlying.value !== 0) {
          data.supply[tokenAddress][accountAddress] = new BigNumber(supplyBalanceUnderlying.value)
            .dividedBy(data.tokens[tokenAddress].exchangeRateMult);
        }
      }); // end token loop
    }); // end account loop
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    // Filter all new transactions and look for new accounts to track.
    const borrowString = 'event Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows)';
    const exitMarketString = 'event MarketExited(address cToken, address account)';

    const exitMarketEvents = txEvent.filterLog(exitMarketString, data.comptrollerAddress);
    exitMarketEvents.forEach((exitEvent) => { data.newAccounts.push(exitEvent.args.account); });
    const borrowEvents = txEvent.filterLog(borrowString);
    borrowEvents.forEach((borrowEvent) => { data.newAccounts.push(borrowEvent.args.borrower); });

    // Return zero findings
    return [];
  };
}

function provideHandleBlock(data) {
  return async function handleBlock() {
    const findings = [];
    const {
      comptrollerContract,
      oneInchContract,
      accounts,
      tokens,
      borrow,
      supply,
    } = data;

    // Initialize accounts. New accounts will get updated in the block section
    data.newAccounts.forEach((newAccount) => { accounts[newAccount.toLowerCase()] = {}; });
    data.totalNewAccounts += data.newAccounts.length;
    data.newAccounts = [];

    // Update Balances on zero health accounts
    const filteredAccounts = [];
    Object.keys(accounts).forEach((currentAccount) => {
      if (accounts[currentAccount].health == null
        || accounts[currentAccount].health === 0) {
        filteredAccounts.push(currentAccount);
        // Zero account balances
        Object.keys(supply).forEach((currentToken) => {
          supply[currentToken][currentAccount] = null;
        });
        Object.keys(borrow).forEach((currentToken) => {
          borrow[currentToken][currentAccount] = null;
        });
      }
    });

    // Grab the assets in first, and make sure they are initialized
    const foundTokens = [];
    await Promise.all(filteredAccounts.map(async (currentAccount) => {
      const assetsIn = await comptrollerContract.getAssetsIn(currentAccount);
      accounts[currentAccount].assetsIn = assetsIn.map((asset) => {
        const address = asset.toLowerCase();
        foundTokens.push(address);
        return address;
      });
    }));
    // Use Array to Set to Array to remove duplicates
    const filteredTokens = Array.from(new Set(foundTokens));

    // Initialize token objects
    await Promise.all(filteredTokens.map(async (token) => {
      await verifyToken(data, token);
    }));

    // Grab token balances from on-chain
    await Promise.all(filteredAccounts.map(async (currentAccount) => {
      await Promise.all(accounts[currentAccount].assetsIn.map(async (currentToken) => {
        const snapshot = await tokens[currentToken].contract.getAccountSnapshot(currentAccount);

        // update the supply balance and token quantity
        supply[currentToken][currentAccount] = new BigNumber(snapshot[1].toString())
          .dividedBy(tokens[currentToken].cTokenDecimalsMult);

        // update the borrow balance
        borrow[currentToken][currentAccount] = new BigNumber(snapshot[2].toString());
      }));
    }));

    // Update all token prices via 1inch
    await Promise.all(Object.entries(tokens).map(async ([currentToken, entry]) => {
      const price = await oneInchContract.getRateToEth(entry.underlying, 0);

      // 1inch's getRateToEth is scaled to 1e18 but is also affected by the underlying token decimal
      //   using the calculation: 10^18 / 10^(tokenDecimal) - https://docs.1inch.io/docs/spot-price-aggregator/examples
      //   Combining the two scaling factors: 10^(18 + 18 - tokenDecimal) => 10^(36 - tokenDecimal)
      const oneInchMult = new BigNumber(10).pow(36 - entry.tokenDecimals);

      // Adjust for native decimals
      entry.price = new BigNumber(price.toString()).dividedBy(oneInchMult);

      // Update the Collateral Factor
      const market = await comptrollerContract.markets(currentToken);
      // Per Compound: https://compound.finance/docs/comptroller#collateral-factor
      //   "collateralFactorMantissa, scaled by 1e18, is multiplied by a supply balance to determine
      //    how much value can be borrowed"
      entry.collateralMult = new BigNumber(market[1].toString())
        .dividedBy(BigNumber(10).pow(18));
    }));

    // Calculate health on all accounts
    Object.keys(accounts).forEach((account) => {
      let borrowBalance = new BigNumber(0);
      let supplyBalance = new BigNumber(0);
      Object.keys(tokens).forEach((token) => {
        if (supply[token][account]) {
          // Supply balances are stored in cTokens and need to be multiplied by the
          //   exchange rate, price and the collateral factor to determine the ETH value
          //   of the collateral.
          supplyBalance = supplyBalance.plus(supply[token][account]
            .multipliedBy(tokens[token].exchangeRateMult)
            .multipliedBy(tokens[token].price)
            .multipliedBy(tokens[token].collateralMult));
        }
        if (borrow[token][account]) {
          // Only need to multiply by the price.
          borrowBalance = borrowBalance.plus(borrow[token][account]
            .multipliedBy(tokens[token].price));
        }
      });

      // Remove non-borrowers
      if (borrowBalance.eq(0)) {
        delete accounts[account];
      } else {
        accounts[account].supplyBalance = supplyBalance;
        accounts[account].borrowBalance = borrowBalance;
        accounts[account].health = supplyBalance.dividedBy(borrowBalance);
      }
    });

    // Check the Comptroller contract for actual liquidity if the health is below x
    const lowHealthAccounts = [];
    Object.keys(accounts).forEach((currentAccount) => {
      if (accounts[currentAccount].health.isLessThan(data.lowHealthThreshold)) {
        lowHealthAccounts.push(currentAccount);
      }
    });
    await Promise.all(lowHealthAccounts.map(async (currentAccount) => {
      const liquidity = await comptrollerContract.getAccountLiquidity(currentAccount);
      const shortfallUSD = new BigNumber(ethers.utils.formatEther(liquidity[2]).toString());

      // Health factor affects the liquidatable amount. Ex: Shortfall of $50 with a Health factor
      // of 0.50 means that only $25 can be successfully liquidated. ( $25 supplied / $50 borrowed )
      const liquidationAmount = shortfallUSD.multipliedBy(accounts[currentAccount].health);

      // Create a finding if the liquidatable amount is below the threshold
      // Shorten metadata to 2 decimal places
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
          accounts[currentAccount].health.dp(2),
        );
        findings.push(newFinding);
      }
      // Zero out the health on the low accounts so they may be re-scanned. (optional)
      // accounts[currentAccount] = {};
    }));
    return findings;
  };
}

// exports
module.exports = {
  verifyToken,
  createAlert,
  provideHandleBlock,
  handleBlock: provideHandleBlock(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  provideInitialize,
  initialize: provideInitialize(initializeData),
};
