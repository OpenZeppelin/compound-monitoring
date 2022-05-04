// LARGE BORROWS GOVERNANCE AGENT ALERT - note there's never been an alert to this agent yet
// agent id - 0x704a35d97dfae2caf3b409206f1bc4c8a06671170108d07f9b3c7ea5026916fc

const axios = require('axios');

const fortaApiEndpoint = 'https://api.forta.network/graphql';
const needle = require('needle')

function createDiscordMessage(borrowerAddress, governanceEvent, transactionHash) {
  const borrowerFormatted = borrowerAddress.slice(0, 6);

  // // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  return `${etherscanLink} 💸 **${borrowerFormatted}** has enough **COMP** tokens to pass min threshold for the governance event: **${governanceEvent}**`;
}

// post to discord
async function postToDiscord(url, message) {
  const method = 'post';
  const headers = {
    'Content-Type': 'application/json',
  };
  const data = JSON.stringify({ content: message });

  let response;
  try {
    // perform the POST request
    response = needle.post(url, {content: message}, {json: true} )
  } catch (error) {
    // is this a "too many requests" error (HTTP status 429)
    if (error.response && error.response.status === 429) {
      // the request was made and a response was received
      // try again after waiting 5 seconds
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, 5000));
      await promise;
      response = needle.post(url, {content: message}, {json: true} )
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
    hash,
    source: {
      transactionHash,
      agent: {
        id: agentId,
      },
    },
  } = alert;

  // retrieve the metadata from the Forta public API
  let alerts = await getFortaAlerts(agentId, transactionHash);
  alerts = alerts.filter((alertObject) => alertObject.hash === hash);
  console.log('Alerts');
  console.log(JSON.stringify(alerts, null, 2));

  const promises = alerts.map((alertData) => {
    const { metadata } = alertData;
    const { borrowerAddress, governanceLevel: governanceEvent } = metadata;

    return createDiscordMessage(
      borrowerAddress,
      governanceEvent,
      transactionHash,
    );
  });

  // // wait for the promises to settle
  const messages = await Promise.all(promises);

  // // create promises for posting messages to Discord webhook
  const discordPromises = messages.map((message) => postToDiscord(discordUrl, `${message}`));

  // // wait for the promises to settle
  await Promise.all(discordPromises);

  return {};
};
