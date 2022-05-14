/* eslint-disable import/no-extraneous-dependencies */
const axios = require('axios');
/* eslint-enable import/no-extraneous-dependencies */

const fortaApiEndpoint = 'https://api.forta.network/graphql';

function createDiscordMessage(cTokenSymbol, transactionHash) {
  // // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  return `${etherscanLink} 🆙 Underlying asset for the **${cTokenSymbol}** cToken contract was upgraded`;
}

function getRandomInt(min, max) {
  return Math.floor((Math.random() * (max - min)) + min);
}

// post to discord
async function postToDiscord(url, message) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const body = {
    content: message,
  };

  const discordObject = {
    url,
    method: 'post',
    headers,
    data: body,
  };

  let response;
  try {
    // perform the POST request
    response = await axios(discordObject);
  } catch (error) {
    // is this a "too many requests" error (HTTP status 429)
    if (error.response && error.response.status === 429) {
      // rate-limited, retry
      // after waiting a random amount of time between 2 and 15 seconds
      const delay = getRandomInt(2000, 15000);
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, delay));
      await promise;
      response = await axios(discordObject);
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

  // construct query with data that you want to get back
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
  const { COMPSecurityAlertsDiscordUrl: discordUrl } = secrets;
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

  const promises = alerts.map((alertData) => {
    const { metadata } = alertData;
    const { cTokenSymbol } = metadata;

    return createDiscordMessage(
      cTokenSymbol,
      transactionHash,
    );
  });

  // wait for the promises to settle
  let results = await Promise.allSettled(promises);

  // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  // create promises for posting messages to Discord webhook
  const discordPromises = results.map((result) => postToDiscord(discordUrl, `${etherscanLink} ${result.value}`));

  // wait for the promises to settle
  results = await Promise.allSettled(discordPromises);
  results = results.filter((result) => result.status === 'rejected');

  if (results.length > 0) {
    throw new Error(results[0].reason);
  }

  return {};
};
