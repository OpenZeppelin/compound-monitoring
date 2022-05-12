// DISTRIBUTIONS AGENT ALERT
// agent id - 0xfca83adc900f88f22dafcd91117d0929343cba3f18e4607bcd861ff0bcd706fa

/* eslint-disable import/no-unresolved,import/no-extraneous-dependencies */
const ethers = require('ethers');
const axios = require('axios');
/* eslint-enable import/no-unresolved,import/no-extraneous-dependencies */

const fortaApiEndpoint = 'https://api.forta.network/graphql';

// axios post request for forta graphql api
async function post(url, method, headers, data) {
  return axios({
    url, method, headers, data,
  });
}

function createDiscordMessage(compAccrued, compDistributed, receiver, transactionHash) {
  const receiverFormatted = receiver.slice(0, 6);

  // // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  // handle case for infinity % (no comp accrued before)
  if (compAccrued.eq(0) || compDistributed.eq(0)) {
    return `${etherscanLink} 🌊 **${receiverFormatted}** previously had no **COMP** accrued and was just distributed **COMP** tokens`;
  }

  // % disctribution % is calculated by compDistributed / compAccrued * 100
  // format the number to have comma separators for powers of 1000
  const internationalNumberFormat = new Intl.NumberFormat('en-US');

  let percentageMore = compDistributed.div(compAccrued).mul(100).toString();
  percentageMore = internationalNumberFormat.format(percentageMore);

  return `${etherscanLink} 🌊 **${percentageMore}%** more **COMP** distributed to **${receiverFormatted}** than expected`;
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
    let { compAccrued, compDistributed } = metadata;
    const { receiver } = metadata;
    compAccrued = ethers.BigNumber.from(compAccrued);
    compDistributed = ethers.BigNumber.from(compDistributed);

    return createDiscordMessage(
      compAccrued,
      compDistributed,
      receiver,
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
