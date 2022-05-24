// ORACLE PRICE ALERT - note there's never been an alert to this agent yet

const axios = require('axios');
const ethers = require('ethers');
const needle = require('needle');

// import the DefenderRelayProvider to interact with its JSON-RPC endpoint
const { DefenderRelayProvider } = require('defender-relay-client/lib/ethers');

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

async function getDecimalsAndSymbol(cTokenAddress, provider) {
  // Special cETH / ETH  case
  if (cTokenAddress.toLowerCase() === '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5'.toLowerCase()) {
    const decimals = 18;
    const symbol = 'ETH';
    return { decimals, symbol };
  }

  const cTokenContract = new ethers.Contract(
    cTokenAddress,
    CTOKEN_ABI,
    provider,
  );
  const underlyingTokenAddress = await cTokenContract.underlying();

  let decimals;
  let symbol;
  if (oddTokens.includes(underlyingTokenAddress.toLowerCase())) {
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

async function createDiscordMessage(reporterPrice, cTokenAddress, transactionHash, provider) {
  const { decimals, symbol } = await getDecimalsAndSymbol(cTokenAddress, provider);

  const amountString = formatAmountString(reporterPrice, decimals);

  // // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  return `${etherscanLink} 🚫 reported price of **${amountString}** for **${symbol}** was rejected`;
}

// post to discord
async function postToDiscord(url, message) {
  let response;
  try {
    // perform the POST request
    response = needle.post(url, { content: message }, { json: true });
  } catch (error) {
    // is this a "too many requests" error (HTTP status 429)
    if (error.response && error.response.status === 429) {
      // the request was made and a response was received
      // try again after waiting 5 seconds
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, 5000));
      await promise;
      response = needle.post(url, { content: message }, { json: true });
    } else {
      // re-throw the error if it's not from a 429 status
      throw error;
    }
  }

  return response;
}

async function getFortaAlerts(agentId, transactionHash) {
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
            agent {
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
        agents: [agentId],
        transactionHash,
        createdSince: 0,
        chainId: 1,
      },
    },
  };

  // perform the POST request
  const response = await axios.post(
    fortaApiEndpoint,
    graphqlQuery,
    headers,
  );

  const { data } = response;
  if (data === undefined) {
    return undefined;
  }

  console.log('Forta Public API data');
  console.log(JSON.stringify(data, null, 2));
  const { data: { alerts: { alerts } } } = data;
  return alerts;
}

// entry point for autotask
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

  // ensure that there is a DiscordUrl secret. Name changes depending on what webhook secret you use
  const { FortaSentinelTestingDiscord: discordUrl } = secrets;
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

  // extract the transaction hash and agent ID from the alert Object
  const {
    source: {
      transactionHash,
      agent: {
        id: agentId,
      },
    },
  } = alert;

  // retrieve the metadata from the Forta public API
  const alerts = await getFortaAlerts(agentId, transactionHash);
  console.log('Alerts');
  console.log(JSON.stringify(alerts, null, 2));

  // use the relayer provider for JSON-RPC requests
  const provider = new DefenderRelayProvider(autotaskEvent);

  const promises = alerts.map((alertData) => {
    const { metadata } = alertData;
    const { reporterPrice, cTokenAddress } = metadata;

    return createDiscordMessage(
      reporterPrice,
      cTokenAddress,
      transactionHash,
      provider,
    );
  });

  // wait for the promises to settle
  const messages = await Promise.all(promises);

  // create promises for posting messages to Discord webhook
  const discordPromises = messages.map((message) => postToDiscord(discordUrl, `${message}`));

  // wait for the promises to settle
  await Promise.all(discordPromises);

  return {};
};
