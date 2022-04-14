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

async function getCoinGeckoData(url) {
  let response;
  try {
    response = await axios.get(url);
  } catch (err) {
    if (err.response && err.response.status === 403) {
      // the request was made and a response was received
      // try again after waiting 15 seconds
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, 15000));
      await promise;
      response = await axios.get(url);
    } else {
      throw err;
    }
  }
  return response;
}

async function getTokenPrice(tokenAddress) {
  const coingeckoApiUrl = 'https://api.coingecko.com/api/v3/simple/token_price/ethereum?';
  const addressQuery = `contract_addresses=${tokenAddress}`;
  const vsCurrency = '&vs_currencies=usd';

  // create the URL
  const url = coingeckoApiUrl.concat(addressQuery.concat(vsCurrency));

  // get the price from the CoinGecko API
  const { data } = await getCoinGeckoData(url);

  // parse the response and convert the prices to ethers.jd BigNumber type
  const usdPerToken = (data[tokenAddress.toLowerCase()].usd).toString();

  let usdPerTokenDecimals = 0;
  let usdPerTokenBN;
  const index = usdPerToken.indexOf('.');
  if (index !== -1) {
    const valueInt = usdPerToken.slice(0, index);
    const valueDec = usdPerToken.slice(index + 1);
    usdPerTokenBN = ethers.BigNumber.from(valueInt + valueDec);
    usdPerTokenDecimals = valueDec.length;
  } else {
    usdPerTokenBN = ethers.BigNumber.from(usdPerToken);
  }

  return { usdPerTokenBN, usdPerTokenDecimals };
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

async function postToDiscord(discordWebhook, message) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const body = {
    content: message,
  };

  // perform the POST request
  const response = await axios({
    url: discordWebhook,
    method: 'post',
    headers,
    data: JSON.stringify(body),
  });

  return response;
}

// eslint-disable-next-line func-names
exports.handler = async function (autotaskEvent) {
  console.log(JSON.stringify(autotaskEvent, null, 2));

  // ensure that the autotaskEvent Object exists
  if (autotaskEvent === undefined) {
    return {};
  }

  const { secrets } = autotaskEvent;
  if (secrets === undefined) {
    return {};
  }

  // ensure that there is a DiscordUrl secret
  const { DiscordUrl: discordUrl } = secrets;
  if (discordUrl === undefined) {
    return {};
  }

  // ensure that the request key exists within the autotaskEvent Object
  const { request } = autotaskEvent;
  if (request === undefined) {
    return {};
  }

  // ensure that the body key exists within the request Object
  const { body } = request;
  if (body === undefined) {
    return {};
  }

  // ensure that the alert key exists within the body Object
  const {
    matchReasons,
    hash: transactionHash,
    matchedAddresses,
  } = body;
  if (matchReasons === undefined) {
    return {};
  }

  // use the relayer provider for JSON-RPC requests
  const provider = new DefenderRelayProvider(autotaskEvent);

  const contractAddress = matchedAddresses[0];

  // create messages for Discord
  const promises = matchReasons.map(async (reason) => {
    // determine the type of event it was
    const { signature, params } = reason;
    const eventName = signature.slice(0, signature.indexOf('('));
    const {
      decimals,
      symbol,
      underlyingTokenAddress,
    } = await getTokenInfo(contractAddress, provider);

    // get the conversion rate for this token to USD
    const {
      usdPerTokenBN,
      usdPerTokenDecimals,
    } = await getTokenPrice(underlyingTokenAddress);

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

  const discordPromises = messages.map((message) => postToDiscord(discordUrl, `${etherscanLink} ${message}`));

  // wait for the promises to settle
  await Promise.all(discordPromises);

  console.log('Messages sent to Discord webhook');

  return {};
};
