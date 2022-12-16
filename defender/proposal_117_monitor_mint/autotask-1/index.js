const stackName = 'proposal_117_monitor_mint';
const discordSecretName = `${stackName}_discordWebhook`;
const slackSecretName = `${stackName}_slackWebhook`;

/* eslint-disable import/no-extraneous-dependencies,import/no-unresolved */
const axios = require('axios');
const ethers = require('ethers');
const BigNumber = require('bignumber.js');

// import the DefenderRelayProvider to interact with its JSON-RPC endpoint
const { DefenderRelayProvider } = require('defender-relay-client/lib/ethers');
/* eslint-enable import/no-extraneous-dependencies,import/no-unresolved */

const cEtherAddress = '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5';

const oneInchAddress = '0x07D91f5fb9Bf7798734C3f606dB065549F6893bb';
const oneInchAbi = [
  'function getRateToEth(address srcToken, bool useSrcWrappers) view returns (uint256 weightedRate)',
];

const comptrollerAddress = '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B';
const comptrollerAbi = [
  'function getAssetsIn(address account) view returns (address[])',
  'function markets(address) view returns (bool isListed, uint256 collateralFactorMantissa, bool isComped)',
];

async function getSupplyAndBorrow(accountAddress, tokenObject) {
  const {
    cTokenContract,
    cTokenDecimalsMultiplier,
    tokenDecimalsMultiplier,
  } = tokenObject;
  const snapshot = await cTokenContract.getAccountSnapshot(accountAddress);
  /* eslint-disable no-param-reassign */
  tokenObject.supply = new BigNumber(snapshot[1].toString()).dividedBy(cTokenDecimalsMultiplier);
  tokenObject.borrow = new BigNumber(snapshot[2].toString()).dividedBy(tokenDecimalsMultiplier);
  /* eslint-enable no-param-reassign */
}

function getRandomInt(min, max) {
  return Math.floor((Math.random() * (max - min)) + min);
}

async function postToSlack(slackWebhook, message) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const body = {
    text: message,
  };

  const slackObject = {
    url: slackWebhook,
    method: 'post',
    headers,
    data: body,
  };

  let response;
  try {
    // perform the POST request
    response = await axios(slackObject);
  } catch (err) {
    if (err.response && err.response.status === 429) {
      // rate-limited, retry
      // after waiting a random amount of time between 2 and 120 seconds
      const delay = getRandomInt(2000, 120000);
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, delay));
      await promise;
      response = await axios(slackObject);
    } else {
      throw err;
    }
  }
  return response;
}

async function postToDiscord(discordWebhook, message) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const body = {
    content: message,
  };

  const discordObject = {
    url: discordWebhook,
    method: 'post',
    headers,
    data: body,
  };
  let response;
  try {
    // perform the POST request
    response = await axios(discordObject);
  } catch (err) {
    if (err.response && err.response.status === 429) {
      // rate-limited, retry
      // after waiting a random amount of time between 2 and 120 seconds
      const delay = getRandomInt(2000, 120000);
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, delay));
      await promise;
      response = await axios(discordObject);
    } else {
      throw err;
    }
  }
  return response;
}

async function getTokenInformation(cTokenAddress, provider) {
  const cTokenAbi = [
    'function decimals() view returns (uint8)',
    'function exchangeRateStored() view returns (uint256)',
    'function symbol() view returns (string)',
    'function underlying() view returns (address)',
    'function getAccountSnapshot(address account) view returns (uint256, uint256, uint256, uint256)',
  ];

  console.debug(`Getting information for token: ${cTokenAddress}`);
  const address = cTokenAddress.toLowerCase();
  const cTokenContract = new ethers.Contract(
    address,
    cTokenAbi,
    provider,
  );

  const cTokenSymbol = await cTokenContract.symbol();
  console.debug(`\tsymbol: ${cTokenSymbol}`);

  let underlyingAddress;
  if (address === cEtherAddress) {
    // cETH does not have an underlying contract, so link it to wETH instead
    underlyingAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  } else {
    underlyingAddress = await cTokenContract.underlying();
  }
  console.debug(`\tunderlying address: ${underlyingAddress}`);

  const exchangeRate = new BigNumber((await cTokenContract.exchangeRateStored()).toString());
  console.debug(`\texchangeRate: ${exchangeRate.toString()}`);
  const cTokenDecimals = new BigNumber((await cTokenContract.decimals()).toString());
  console.debug(`\tcToken decimals: ${cTokenDecimals.toString()}`);

  // Look up decimals of the underlying tokens as well.
  const decimalsABI = ['function decimals() view returns (uint)'];
  const underlyingTokenContract = new ethers.Contract(
    underlyingAddress,
    decimalsABI,
    provider,
  );
  const tokenDecimals = new BigNumber((await underlyingTokenContract.decimals()).toString());
  console.debug(`\ttoken decimals: ${tokenDecimals.toString()}`);

  const tokenDecimalsMultiplier = new BigNumber(10).pow(tokenDecimals);
  console.debug(`\ttokenDecimalsMultiplier: ${tokenDecimalsMultiplier.toString()}`);
  const cTokenDecimalsMultiplier = new BigNumber(10).pow(cTokenDecimals);
  console.debug(`\tcTokenDecimalsMultiplier: ${cTokenDecimalsMultiplier.toString()}`);

  // Adjusting the multiplier for easier use later.
  // “The current exchange rate as an unsigned integer, scaled by
  //   1 * 10 ^ (18 - 8 + Underlying Token Decimals)” - https://compound.finance/docs/ctokens#exchange-rate
  //   Simplified to 10^(10 + Underlying Token Decimals).
  const exchangeDecimalsMultiplier = new BigNumber(10).pow(10);
  console.debug(`\texchangeDecimalsMultiplier: ${exchangeDecimalsMultiplier.toString()}`);

  const exchangeRateMultiplier = exchangeRate
    .dividedBy(exchangeDecimalsMultiplier)
    .dividedBy(tokenDecimalsMultiplier);
  console.debug(`\texchangeRateMultiplier: ${exchangeRateMultiplier.toString()}`);

  return {
    cTokenContract,
    cTokenSymbol,
    cTokenDecimals,
    cTokenDecimalsMultiplier,
    cTokenAddress,
    underlyingAddress,
    underlyingTokenContract,
    tokenDecimals,
    tokenDecimalsMultiplier,
    exchangeRate,
    exchangeDecimalsMultiplier,
    exchangeRateMultiplier,
  };
}

async function getPriceInformation(oneInchContract, comptrollerContract, tokenObject) {
  const {
    underlyingAddress,
    tokenDecimals,
    cTokenAddress,
  } = tokenObject;

  console.debug(`Getting price information for: ${underlyingAddress}`);
  const price = await oneInchContract.getRateToEth(underlyingAddress, 0);
  console.debug(`\tprice: ${price.toString()}`);

  // 1inch's getRateToEth is scaled to 1e18 but is also affected by the underlying token decimal
  //   getRateToEth = (amount of Token / amount of Ether) * 10^18
  // To account for token decimals, Ether decimals, and the scaling,
  //   we need to perform the following:
  //   price = getRateToEth * (10^tokenDecimals) * (1 / 10^etherDecimals) * (1 / 10^18)
  // Because the number of Ether decimals is fixed at 18, we can simplify the expression
  //   price = getRateToEth * (10^tokenDecimals / 10^36)
  //     or
  //   price = getRateToEth * 10^(tokenDecimals - 36)
  //     or
  //   price = getRateToEth / (10^(36 - tokenDecimals))
  // Ref: https://docs.1inch.io/docs/spot-price-aggregator/examples
  const oneInchMultiplier = new BigNumber(10).pow(36 - tokenDecimals);
  console.debug(`\toneInchMultiplier: ${oneInchMultiplier.toString()}`);

  // Adjust for native decimals
  // eslint-disable-next-line no-param-reassign
  tokenObject.price = new BigNumber(price.toString()).dividedBy(oneInchMultiplier);
  console.debug(`\tadjusted price: ${tokenObject.price.toString()}`);

  // Update the Collateral Factor
  console.debug(`cTokenAddress: ${cTokenAddress}`);
  const market = await comptrollerContract.markets(cTokenAddress);
  console.debug(`\tmarket: ${market}`);

  // Ref: https://compound.finance/docs/comptroller#collateral-factor
  //   "collateralFactorMantissa, scaled by 1e18, is multiplied by a supply balance to determine
  //    how much value can be borrowed"
  // eslint-disable-next-line no-param-reassign,max-len
  tokenObject.collateralMultiplier = new BigNumber(market[1].toString()).dividedBy(BigNumber(10).pow(18));
  console.debug(`\tcollateralMultiplier: ${tokenObject.collateralMultiplier}`);
}

async function getAccountHealth(accountAddress, tokens) {
  let supplyBalance = new BigNumber(0);
  let borrowBalance = new BigNumber(0);

  tokens.forEach((token) => {
    const {
      exchangeRateMultiplier,
      price,
      collateralMultiplier,
      supply,
      borrow,
    } = token;

    // Ref: https://github.com/compound-finance/compound-protocol/blob/3affca87636eecd901eb43f81a4813186393905d/contracts/Comptroller.sol#L751
    const tokensToDenom = exchangeRateMultiplier.times(price.times(collateralMultiplier));

    if (supply !== undefined) {
      // Supply balances are stored in cTokens and need to be multiplied by the
      //   exchange rate, price and the collateral factor to determine the ETH value
      //   of the collateral.
      // Ref: https://github.com/compound-finance/compound-protocol/blob/3affca87636eecd901eb43f81a4813186393905d/contracts/Comptroller.sol#L754
      // eslint-disable-next-line no-param-reassign
      token.supplyBalance = supply.times(tokensToDenom);
      supplyBalance = supplyBalance.plus(token.supplyBalance);
    } else {
      // eslint-disable-next-line no-param-reassign
      token.supplyBalance = new BigNumber(0);
    }

    // Ref: https://github.com/compound-finance/compound-protocol/blob/3affca87636eecd901eb43f81a4813186393905d/contracts/Comptroller.sol#L757
    if (borrow !== undefined) {
      // Only need to multiply by the price.
      // eslint-disable-next-line no-param-reassign
      token.borrowBalance = borrow.times(price);
      borrowBalance = borrowBalance.plus(token.borrowBalance);
    } else {
      // eslint-disable-next-line no-param-reassign
      token.borrowBalance = new BigNumber(0);
    }
  });

  const health = supplyBalance.dividedBy(borrowBalance);
  return {
    health,
    borrowBalance,
    supplyBalance,
  };
}

// eslint-disable-next-line func-names
exports.handler = async function (autotaskEvent) {
  // ensure that the autotaskEvent Object exists
  if (autotaskEvent === undefined) {
    throw new Error('autotaskEvent undefined');
  }

  const { secrets } = autotaskEvent;
  if (secrets === undefined) {
    throw new Error('secrets undefined');
  }

  // ensure that there is a DiscordUrl secret
  const discordUrl = secrets[discordSecretName];
  if (discordUrl === undefined) {
    throw new Error('discordUrl undefined');
  }

  // ensure that there is a SlackUrl secret
  const slackUrl = secrets[slackSecretName];
  if (slackUrl === undefined) {
    throw new Error('slackUrl undefined');
  }

  // ensure that the request key exists within the autotaskEvent Object
  const { request } = autotaskEvent;
  if (request === undefined) {
    throw new Error('request undefined');
  }

  // ensure that the body key exists within the request Object
  const { body } = request;
  if (body === undefined) {
    throw new Error('body undefined');
  }

  // ensure that the alert key exists within the body Object
  const {
    matchReasons,
    hash: transactionHash,
  } = body;
  if (matchReasons === undefined) {
    throw new Error('matchReasons undefined');
  }

  // use the relayer provider for JSON-RPC requests
  const provider = new DefenderRelayProvider(autotaskEvent);

  // Create Comptroller contract
  const comptrollerContract = new ethers.Contract(
    comptrollerAddress,
    comptrollerAbi,
    provider,
  );

  // Create a contract for 1inch
  const oneInchContract = new ethers.Contract(
    oneInchAddress,
    oneInchAbi,
    provider,
  );

  // go through the matchReasons and extract the account address(es)
  const outerPromises = matchReasons.map(async (reason) => {
    const accountAddress = reason.params.minter;

    // Get all of the assets listed for this account
    console.debug(`Getting all assetsIn for account: ${accountAddress}`);
    const assetsIn = await comptrollerContract.getAssetsIn(accountAddress);
    console.debug(`${assetsIn}`);

    // Get data for all of the assets
    console.debug('Getting token information for all assetsIn');
    let promises = assetsIn.map(async (address) => getTokenInformation(address, provider));
    const tokens = await Promise.all(promises);

    // Get all of the supply and borrow amounts
    console.debug('Getting all supply and borrow amounts');
    promises = tokens.map(async (token) => getSupplyAndBorrow(accountAddress, token));
    await Promise.all(promises);

    // Calculate price using 1inch
    console.debug('Calculating price using 1inch');
    promises = tokens.map(async (token) => getPriceInformation(
      oneInchContract,
      comptrollerContract,
      token,
    ));
    await Promise.all(promises);

    // Convert borrows and supplies into equivalent ETH and calculate health
    const results = await getAccountHealth(accountAddress, tokens);
    console.debug(`Health factor: ${results.health}`);
    console.debug(`Total Borrow balance (ETH): ${results.borrowBalance}`);
    console.debug(`Total Supply balance (ETH): ${results.supplyBalance}`);
    return {
      accountAddress,
      results,
      tokens,
    };
  });

  let outputs = await Promise.all(outerPromises);
  outputs = outputs.filter((output) => output !== undefined);
  if (outputs.length === 0) {
    console.debug('cEther not included in markets entered, returning');
    return {};
  }

  const discordPromises = outputs.map(async (output) => {
    const { results, accountAddress, tokens } = output;

    // craft the Discord message that will provide account information for review
    // construct the Etherscan transaction link
    const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;
    const slackEtherscanLink = `<https://etherscan.io/tx/${transactionHash}|TX>`;
    let message = `⚠️⚠️⚠️ Account entered cEther market: ${accountAddress}\n`
      + `\tHealth factor: ${results.health}\n`
      + `\tTotal Borrows: ${results.borrowBalance} ETH\n`
      + `\tTotal Supply : ${results.supplyBalance} ETH\n`
      + 'Details:\n';

    let details = '';
    tokens.forEach((token) => {
      const {
        cTokenAddress,
        cTokenSymbol,
        supplyBalance,
        borrowBalance,
      } = token;
      details += `\t${cTokenSymbol} - ${cTokenAddress}:\n`;
      details += `\t\tSupply: ${supplyBalance.toString()} ETH\n`;
      details += `\t\tBorrow: ${borrowBalance.toString()} ETH\n`;
    });
    message += details;

    console.debug(`${message}`);

    try {
      await postToSlack(slackUrl, `${slackEtherscanLink} ${message}`);
    } catch (error) {
      console.error(`Error posting to Slack: ${error}`);
    }

    return postToDiscord(discordUrl, `${etherscanLink} ${message}`);
  });

  // wait for the promises to settle
  // we want to have as many succeed as possible, so we are using
  // .allSettled() rather than .all() here
  let results = await Promise.allSettled(discordPromises);

  results = results.filter((result) => result.status === 'rejected');
  if (results.length > 0) {
    throw new Error(results[0].reason);
  }

  return {};
};
