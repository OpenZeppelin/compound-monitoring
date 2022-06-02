/* eslint-disable import/no-extraneous-dependencies,import/no-unresolved */
const axios = require('axios');
const ethers = require('ethers');

// import the DefenderRelayProvider to interact with its JSON-RPC endpoint
const { DefenderRelayProvider } = require('defender-relay-client/lib/ethers');
/* eslint-enable import/no-extraneous-dependencies,import/no-unresolved */

const TOKEN_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];
const MAKER_TOKEN_ABI = [
  'function decimals() view returns (uint256)',
  'function symbol() view returns (bytes32)',
];
const CTOKEN_ABI = ['function underlying() view returns (address)'];

const makerTokenAddress = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2'.toLowerCase();
const saiTokenAddress = '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359'.toLowerCase();
const oddTokens = [makerTokenAddress, saiTokenAddress];
const cEtherAddress = '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5'.toLowerCase();

const eventMapping = {
  Borrow: {
    amountKey: 'borrowAmount',
    byKey: 'borrower',
    action: 'borrow',
  },
  LiquidateBorrow: {
    amountKey: 'repayAmount',
    byKey: 'liquidator',
    fromKey: 'borrower',
    action: 'liquidate',
  },
  Mint: {
    amountKey: 'mintAmount',
    byKey: 'minter',
    action: 'supply',
  },
  Redeem: {
    amountKey: 'redeemAmount',
    byKey: 'redeemer',
    action: 'withdraw',
  },
  RepayBorrow: {
    amountKey: 'repayAmount',
    byKey: 'payer',
    forKey: 'borrower',
    action: 'repay',
  },
};

const comptrollerAddress = '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B';
const comptrollerAbi = ['function oracle() view returns (address)'];
const oracleAbi = ['function getUnderlyingPrice(address cToken) external view returns (uint)'];

async function getOracleContract(provider) {
  // create an ethers.js Contract for the Comptroller contract
  const comptrollerContract = new ethers.Contract(
    comptrollerAddress,
    comptrollerAbi,
    provider,
  );

  // get the oracle address
  const oracleAddress = await comptrollerContract.oracle();

  // create an ethers.js Contract for the Oracle contract
  const oracleContract = new ethers.Contract(
    oracleAddress,
    oracleAbi,
    provider,
  );

  return oracleContract;
}

async function getTokenPrice(oracleContract, cTokenAddress, decimals) {
  // returned price is of the form
  //   scaledPrice = rawPrice * 1e36 / baseUnit
  // where baseUnit is the smallest denomination of a token per whole token
  // for example, for Ether, baseUnit = 1e18
  const scaledPrice = await oracleContract.getUnderlyingPrice(cTokenAddress);

  // calculate the baseUnit
  const baseUnit = ethers.BigNumber.from(10).pow(decimals);

  // remove the decimals scaling
  const usdPerTokenBN = scaledPrice.mul(baseUnit);

  // return the value and the number of decimals on it
  return { usdPerTokenBN, usdPerTokenDecimals: 36 };
}

function emojiForEvent(eventName, usdValueString) {
  // create the appropriate number of whale emoji for the value
  // add one whale for each power of 1000
  const numWhales = Math.floor((usdValueString.length - 1) / 3);
  const whaleString = '🐳'.repeat(numWhales);

  switch (eventName) {
    case 'Borrow':
      return whaleString.concat('📥');
    case 'LiquidateBorrow':
      return whaleString.concat('💔');
    case 'Mint':
      return whaleString.concat('📈');
    case 'Redeem':
      return whaleString.concat('📉');
    case 'RepayBorrow':
      return whaleString.concat('📤');
    default:
      return '';
  }
}

async function getTokenInfo(cTokenAddress, provider) {
  let underlyingTokenAddress;
  if (cTokenAddress.toLowerCase() === cEtherAddress) {
    underlyingTokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  } else {
    const cTokenContract = new ethers.Contract(
      cTokenAddress,
      CTOKEN_ABI,
      provider,
    );
    underlyingTokenAddress = await cTokenContract.underlying();
  }

  let decimals;
  let symbol;
  if (oddTokens.indexOf(underlyingTokenAddress.toLowerCase()) !== -1) {
    const underlyingTokenContract = new ethers.Contract(
      underlyingTokenAddress,
      MAKER_TOKEN_ABI,
      provider,
    );

    decimals = await underlyingTokenContract.decimals();
    // need to convert decimals from uint256 to uint8
    decimals = parseInt(decimals.toString(), 10);

    symbol = await underlyingTokenContract.symbol();
    // need to convert symbol from bytes32 to string
    symbol = ethers.utils.parseBytes32String(symbol);
  } else {
    const underlyingTokenContract = new ethers.Contract(
      underlyingTokenAddress,
      TOKEN_ABI,
      provider,
    );
    decimals = await underlyingTokenContract.decimals();
    symbol = await underlyingTokenContract.symbol();
  }
  return { decimals, symbol, underlyingTokenAddress };
}

function floorBigNumberString(valueString) {
  // remove any decimal portion of the value
  const index = valueString.indexOf('.');
  if (index !== -1) {
    return valueString.slice(0, index);
  }
  return valueString;
}

function formatAmountString(amount, decimals, usdPerTokenBN, usdPerTokenDecimals) {
  const amountBN = ethers.BigNumber.from(amount);
  const divisorBN = ethers.BigNumber.from(10).pow(decimals);
  const result = amountBN.div(divisorBN);

  let resultString = amountBN.toString();
  if (resultString.length <= decimals) {
    resultString = `0.${'0'.repeat(decimals - resultString.length)}${resultString[0]}`;
  } else {
    resultString = floorBigNumberString(result.toString());
  }

  const usdValueDivisor = ethers.BigNumber.from(10).pow(usdPerTokenDecimals);
  const usdValue = usdPerTokenBN.mul(result).div(usdValueDivisor);
  const usdValueString = floorBigNumberString(usdValue.toString());

  // format the number to have comma separators for powers of 1000
  const internationalNumberFormat = new Intl.NumberFormat('en-US');
  return {
    amountString: internationalNumberFormat.format(resultString),
    usdValueString,
  };
}

function createDiscordMessage(
  eventName,
  params,
  decimals,
  symbol,
  usdPerTokenBN,
  usdPerTokenDecimals,
) {
  const eventObject = eventMapping[eventName];
  if (eventObject !== undefined) {
    const amount = params[eventObject.amountKey];
    const {
      amountString,
      usdValueString,
    } = formatAmountString(amount, decimals, usdPerTokenBN, usdPerTokenDecimals);

    const eventEmoji = emojiForEvent(eventName, usdValueString);

    const byAddress = params[eventObject.byKey];
    const { action } = eventObject;
    let message = `${eventEmoji} **${amountString} ${symbol}** ${action}`;

    if (action === 'liquidate') {
      const fromAddress = params[eventObject.fromKey];
      message += ` from ${fromAddress.slice(0, 6)} by ${byAddress.slice(0, 6)}`;
    } else if (action === 'repayBorrow') {
      const forAddress = params[eventObject.forKey];
      message += ` by ${byAddress.slice(0, 6)}`;
      if (forAddress !== byAddress) {
        message += ` for ${forAddress.slice(0, 6)}`;
      }
    } else {
      message += ` by ${byAddress.slice(0, 6)}`;
    }
    return message;
  }
  return undefined;
}

function getRandomInt(min, max) {
  return Math.floor((Math.random() * (max - min)) + min);
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

function getAddressForMatchReason(reason, logs, abi) {
  let found;
  let parsedLog;
  const { params, signature } = reason;
  const iface = new ethers.utils.Interface(abi);
  const keys = Object.keys(params);
  let key;
  let value;
  for (let i = 0; i < logs.length; i++) {
    try {
      // attempt to parse the log
      // because there could be many logs emitted by many contracts
      // we don't know whether the call to parseLog will fail, hence
      // wrapping it with a try...catch
      // if parseLog throws, we will move on to the next log
      parsedLog = iface.parseLog(logs[i]);

      // check that the event signature matches
      // this should be equivalent to checking the topic hashes
      if (parsedLog.signature !== signature) {
        // eslint-disable-next-line no-continue
        continue;
      }

      // check that all of the parameter names and values match
      // the keys and values in the params variable are the named
      // arguments and their associated values for the event
      // the parsedLog Object will have its named arguments and values
      // stored under the args key
      found = true;
      for (let j = 0; j < keys.length; j++) {
        key = keys[j];
        value = params[key];
        if (parsedLog.args[key].toString() !== value.toString()) {
          found = false;
          break;
        }
      }

      // if a match was found, return the address from the log
      if (found === true) {
        return logs[i].address;
      }
      // eslint-disable-next-line no-empty
    } catch {}
  }
  return undefined;
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
  const { DiscordUrl: discordUrl } = secrets;
  if (discordUrl === undefined) {
    throw new Error('discordUrl undefined');
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
    transaction: {
      logs,
    },
    sentinel: {
      abi,
    },
  } = body;
  if (matchReasons === undefined) {
    throw new Error('matchReasons undefined');
  }

  // use the relayer provider for JSON-RPC requests
  const provider = new DefenderRelayProvider(autotaskEvent);

  // create an ethers.js Contract for the Compound Oracle contract
  const oracleContract = await getOracleContract(provider);

  // create messages for Discord
  const promises = matchReasons.map(async (reason) => {
    // if there are multiple events in the transaction
    // from multiple addresses, we won't know which event was emitted
    // from which address, so we have to go back through all of the logs
    // to make that determination
    const cTokenAddress = getAddressForMatchReason(reason, logs, abi);
    if (cTokenAddress === undefined) {
      throw new Error('unable to get address for match reason');
    }

    // determine the type of event it was
    const { signature, params } = reason;
    const eventName = signature.slice(0, signature.indexOf('('));
    const {
      decimals,
      symbol,
    } = await getTokenInfo(cTokenAddress, provider);

    // get the conversion rate for this token to USD
    const {
      usdPerTokenBN,
      usdPerTokenDecimals,
    } = await getTokenPrice(oracleContract, cTokenAddress, decimals);

    // craft the Discord message
    return createDiscordMessage(
      eventName,
      params,
      decimals,
      symbol,
      usdPerTokenBN,
      usdPerTokenDecimals,
    );
  });

  // wait for the promises to settle
  const messages = await Promise.all(promises);

  // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  const discordPromises = messages.map((message) => {
    console.log(`${etherscanLink} ${message}`);
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
