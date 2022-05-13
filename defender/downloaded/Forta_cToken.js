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

const fortaApiEndpoint = 'https://api.forta.network/graphql';

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

async function getDecimalsAndSymbol(cTokenAddress, provider) {
  const cTokenContract = new ethers.Contract(
    cTokenAddress,
    CTOKEN_ABI,
    provider,
  );
  const underlyingTokenAddress = await cTokenContract.underlying();

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
  return { decimals, symbol };
}

function formatAmountString(amount, decimals) {
  const amountBN = ethers.BigNumber.from(amount);
  const divisorBN = ethers.BigNumber.from(10).pow(decimals);

  // the ethers BigNumber implementation will discard the decimal
  // portion of the value when we perform the division
  let resultString = amountBN.toString();
  if (resultString.length <= decimals) {
    resultString = `0.${'0'.repeat(decimals - resultString.length)}${resultString[0]}`;
  } else {
    resultString = amountBN.div(divisorBN).toString();
  }

  // format the number to have comma separators for powers of 1000
  const internationalNumberFormat = new Intl.NumberFormat('en-US');
  return internationalNumberFormat.format(resultString);
}

function createDiscordMessage(eventName, metadata, decimals, symbol, description) {
  const eventObject = eventMapping[eventName];
  if (eventObject !== undefined) {
    const amount = metadata[eventObject.amountKey];
    const amountString = formatAmountString(amount, decimals);
    const byAddress = metadata[eventObject.byKey];
    const { action } = eventObject;
    let message = `**${amountString} ${symbol}** ${action}`;

    if (action === 'liquidate') {
      const fromAddress = metadata[eventObject.fromKey];
      message += ` from ${fromAddress.slice(0, 6)} by ${byAddress.slice(0, 6)}`;
    } else if (action === 'repayBorrow') {
      const forAddress = metadata[eventObject.forKey];
      message += ` by ${byAddress.slice(0, 6)}`;
      if (forAddress !== byAddress) {
        message += ` for ${forAddress.slice(0, 6)}`;
      }
    } else {
      message += ` by ${byAddress.slice(0, 6)}`;
    }

    const emoji = description.slice(0, description.indexOf('-') - 1);

    return `${emoji} ${message}`;
  }
  return undefined;
}

async function post(url, method, headers, data) {
  return axios({
    url, method, headers, data,
  });
}

async function postToDiscord(url, message) {
  const method = 'post';
  const headers = {
    'Content-Type': 'application/json',
  };
  const data = JSON.stringify({ content: message });

  let response;
  try {
    // perform the POST request
    response = await post(url, method, headers, data);
  } catch (error) {
    // is this a "too many requests" error (HTTP status 429)
    if (error.response && error.response.status === 429) {
      // the request was made and a response was received
      // try again after waiting 5 seconds
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, 5000));
      await promise;
      response = await post(url, method, headers, data);
    } else {
      // re-throw the error if it's not from a 429 status
      throw error;
    }
  }

  return response;
}

async function getFortaAlerts(botId, transactionHash) {
  const headers = {
    'content-type': 'application/json',
  };

  const graphqlQuery = {
    operationName: 'recentAlerts',
    query: `query recentAlerts($input: AlertsInput) {
      alerts(input: $input) {
        pageInfo {
          hasNextPage
          endCursor {
            alertId
            blockNumber
          }
        }
        alerts {
          createdAt
          name
          protocol
          findingType
          hash
          source {
            transactionHash
            block {
              number
              chainId
            }
            bot {
              id
            }
          }
          severity
      metadata
      description
        }
      }
    }`,
    variables: {
      input: {
        first: 100,
        bots: [botId],
        transactionHash,
        createdSince: 0,
        chainId: 1,
      },
    },
  };

  // perform the POST request
  console.log('Getting Forta Alert from Public API');
  const response = await axios({
    url: fortaApiEndpoint,
    method: 'post',
    headers,
    data: graphqlQuery,
  });

  const { data } = response;
  if (data === undefined) {
    return undefined;
  }

  console.log('Forta Public API data');
  console.log(JSON.stringify(data, null, 2));
  const { data: { alerts: { alerts } } } = data;
  return alerts;
}

// eslint-disable-next-line func-names
exports.handler = async function (autotaskEvent) {
  // ensure that the autotaskEvent Object exists
  if (autotaskEvent === undefined) {
    return {};
  }
  console.log('Autotask Event');
  console.log(JSON.stringify(autotaskEvent, null, 2));

  const { secrets } = autotaskEvent;
  if (secrets === undefined) {
    return {};
  }

  // ensure that there is a DiscordUrl secret
  const { TestingDiscordUrl: discordUrl } = secrets;
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
  console.log('Body');
  console.log(JSON.stringify(body, null, 2));

  // ensure that the alert key exists within the body Object
  const { alert } = body;
  if (alert === undefined) {
    return {};
  }

  // extract the transaction hash and bot ID from the alert Object
  const {
    hash,
    source: {
      transactionHash,
      agent: {
        id: botId,
      },
    },
  } = alert;

  // retrieve the metadata from the Forta public API
  let alerts = await getFortaAlerts(botId, transactionHash);
  alerts = alerts.filter((alertObject) => alertObject.hash === hash);
  console.log('Alerts');
  console.log(JSON.stringify(alerts, null, 2));

  // use the relayer provider for JSON-RPC requests
  const provider = new DefenderRelayProvider(autotaskEvent);

  const promises = alerts.map(async (alertData) => {
    const { metadata, description } = alertData;
    const { eventName, contractAddress, cTokenSymbol } = metadata;
    let decimals;
    let symbol;
    if (cTokenSymbol === 'cETH') {
      decimals = 18;
      symbol = 'ETH';
    } else {
      ({ decimals, symbol } = await getDecimalsAndSymbol(contractAddress, provider));
    }
    // craft the Discord message
    return createDiscordMessage(eventName, metadata, decimals, symbol, description);
  });

  // wait for the promises to settle
  let results = await Promise.allSettled(promises);

  // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  // create promises for posting messages to Discord webhook
  const discordPromises = results.map((result) => postToDiscord(discordUrl, `${etherscanLink} ${result.value}`));

  // wait for the promises to settle
  results = await Promise.all(discordPromises);
  results = results.filter((result) => result.status === 'rejected');

  if (results.length > 0) {
    throw new Error(results[0].reason);
  }

  return {};
};
