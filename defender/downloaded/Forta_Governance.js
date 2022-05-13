// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');

const fortaApiEndpoint = 'https://api.forta.network/graphql';

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
    data: JSON.stringify(body),
  };
  
  console.log(`discordObject: ${discordObject}`);
  console.log(`stringified: ${JSON.stringify(discordObject, null, 2)}`);

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
          alertId
          createdAt
          name
          protocol
          hash
          findingType
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

async function getProposalTitle(proposalId) {
  const baseUrl = 'https://api.compound.finance/api/v2/governance/proposals';
  const queryUrl = `?proposal_ids[]=${proposalId}`;
  let title;
  try {
    const result = await axios.get(baseUrl + queryUrl);
    title = result.data.proposals[0].title;
    if (title === null) {
      title = '';
    }
  } catch {
    title = '';
  }
  return title;
}

function getProposalTitleFromDescription(description) {
  const lines = description.split('\n');
  let [proposalName] = lines;
  // remove markdown heading symbol and then leading and trailing spaces
  proposalName = proposalName.replaceAll('#', '').trim();
  return proposalName;
}

async function getAccountDisplayName(voter, proposalId) {
  const baseUrl = 'https://api.compound.finance/api/v2/governance/proposal_vote_receipts';
  const queryUrl = `?account=${voter}&proposal_id=${proposalId}`;
  let displayName;
  try {
    console.log(baseUrl + queryUrl);
    const result = await axios.get(baseUrl + queryUrl);
    console.log(result);
    displayName = result.data.proposal_vote_receipts[0].voter.display_name;
    console.log(displayName);
    if (displayName === null) {
      displayName = '';
    }
  } catch {
    displayName = '';
  }
  return displayName;
}

async function createDiscordMessage(metadata, description, alertId, transactionHash) {
  let proposer;
  let voter;
  let votes;
  let reason;
  let proposalName;
  let proposalDescription;
  let message;
  let displayName;
  let id;
  let supportEmoji;
  let eta;
  const internationalNumberFormat = new Intl.NumberFormat('en-US');

  const noEntryEmoji = '⛔';
  const checkMarkEmoji = '✅';

  // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  switch (alertId) {
    case 'AE-COMP-GOVERNANCE-PROPOSAL-CREATED':
      ({ proposer, id, description: proposalDescription } = metadata);
      proposalName = getProposalTitleFromDescription(proposalDescription);
      message = `**New Proposal** ${proposalName} by ${proposer.slice(0, 6)} ${etherscanLink}`;
      message += `\nDetails: https://compound.finance/governance/proposals/${id}`;
      break;
    case 'AE-COMP-GOVERNANCE-VOTE-CAST':
      ({
        reason,
        voter,
        votes,
        displayName,
        id,
      } = metadata);

      console.log('Retrieving name from Compound API');
      displayName = await getAccountDisplayName(voter, id);

      if (description.includes('against')) {
        supportEmoji = noEntryEmoji;
      } else if (description.includes('in support of')) {
        supportEmoji = checkMarkEmoji;
      }

      if (votes.length > 18) {
        votes = votes.slice(0, votes.length - 18);
      } else {
        votes = '0';
      }
      votes = internationalNumberFormat.format(votes);

      proposalName = await getProposalTitle(id);
      if (displayName !== '') {
        message = `**Vote** ${proposalName} ${supportEmoji} ${votes} by ${displayName} ${etherscanLink}`;
      } else {
        message = `**Vote** ${proposalName} ${supportEmoji} ${votes} by ${voter.slice(0, 6)} ${etherscanLink}`;
      }

      if (reason !== '') {
        message += `\n\`\`\`${reason}\`\`\``;
      }
      break;
    case 'AE-COMP-GOVERNANCE-PROPOSAL-CANCELED':
      ({ id } = metadata);
      proposalName = await getProposalTitle(id);
      message = `**Canceled Proposal** ${proposalName} ${noEntryEmoji}`;
      break;
    case 'AE-COMP-GOVERNANCE-PROPOSAL-EXECUTED':
      ({ id } = metadata);
      proposalName = await getProposalTitle(id);
      message = `**Executed Proposal** ${proposalName} ${checkMarkEmoji}`;
      break;
    case 'AE-COMP-GOVERNANCE-PROPOSAL-QUEUED':
      ({ eta, id } = metadata);
      proposalName = await getProposalTitle(id);
      // message = `Queued Proposal ${proposalName} ${checkMarkEmoji}
      // available to execute after ${eta} days`;
      message = `**Queued Proposal** ${proposalName} ${checkMarkEmoji} available to execute at timestamp ${eta}`;
      break;
    default:
      return undefined;
  }

  return message;
}

// eslint-disable-next-line func-names
exports.handler = async function (autotaskEvent) {
  // ensure that the autotaskEvent Object exists
  if (autotaskEvent === undefined) {
    return {};
  }
  console.log('autotaskEvent');
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

  const promises = alerts.map(async (alertData) => {
    const { metadata, description, alertId } = alertData;
    const message = await createDiscordMessage(metadata, description, alertId, transactionHash);
    console.log(`message created: ${message}`);
    return message;
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
