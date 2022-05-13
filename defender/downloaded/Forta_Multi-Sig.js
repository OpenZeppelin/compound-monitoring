/* eslint-disable import/no-extraneous-dependencies,import/no-unresolved */
const axios = require('axios');
const ethers = require('ethers');

// import the DefenderRelayProvider to interact with its JSON-RPC endpoint
const { DefenderRelayProvider } = require('defender-relay-client/lib/ethers');
/* eslint-enable import/no-extraneous-dependencies,import/no-unresolved */

const fortaApiEndpoint = 'https://api.forta.network/graphql';

const CTOKEN_ABI = ['function symbol() view returns (string)'];

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
    data: JSON.stringify(body),
  };

  let response;
  try {
    // perform the POST request
    response = await axios(discordObject);
  } catch (err) {
    if (err.response && err.response.status === 429) {
      // rate-limited, retry
      // after waiting a random amount of time between 2 and 15 seconds
      const delay = getRandomInt(2000, 15000);
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
          hash
          protocol
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

async function createDiscordMessage(metadata, description, alertId, transactionHash, provider) {
  let oldPauseGuardian;
  let newPauseGuardian;
  let action;
  let oldAdmin;
  let newAdmin;
  let oldThreshold;
  let newThreshold;
  let oldBorrowCapGuardian;
  let newBorrowCapGuardian;
  let cToken;
  let symbol;
  let newBorrowCap;
  let contract;
  let proposalName;
  let message;
  let id;
  let owner;

  // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  switch (alertId) {
    case 'AE-COMP-MULTISIG-OWNER-ADDED-ALERT':
      ({ owner } = metadata);
      message = `**Added Owner** ${owner} to Community Multi-Sig ${etherscanLink}`;
      break;
    case 'AE-COMP-MULITSIG-OWNER-REMOVED-ALERT':
      ({ owner } = metadata);
      message = `**Removed Owner** ${owner} from Community Multi-Sig ${etherscanLink}`;
      break;
    case 'AE-COMP-GOVERNANCE-PROPOSAL-CREATED-ALERT':
      ({ proposalId: id } = metadata);
      message = `**New Proposal** created by Community Multi-Sig ${etherscanLink}`;
      message += `\nDetails: https://compound.finance/governance/proposals/${id}`;
      break;
    case 'AE-COMP-GOVERNANCE-PROPOSAL-EXECUTED-ALERT':
      ({ proposalId: id } = metadata);
      proposalName = await getProposalTitle(id);
      message = `**Executed Proposal** ${proposalName} by Community Multi-Sig ${etherscanLink}`;
      break;
    case 'AE-COMP-GOVERNANCE-PROPOSAL-CANCELED-ALERT':
      ({ proposalId: id } = metadata);
      proposalName = await getProposalTitle(id);
      message = `**Canceled Proposal** ${proposalName} by Community Multi-Sig ${etherscanLink}`;
      break;
    case 'AE-COMP-GOVERNANCE-VOTE-CAST-ALERT':
      ({ proposalId: id } = metadata);
      proposalName = await getProposalTitle(id);
      message = `**Vote Cast** on proposal ${proposalName} by Community Multi-Sig ${etherscanLink}`;
      break;
    case 'AE-COMP-GOVERNANCE-PROPOSAL-THRESHOLD-SET-ALERT':
      ({ oldThreshold, newThreshold } = metadata);
      message = `**Proposal Threshold Changed** from ${oldThreshold} to ${newThreshold} by Community Multi-Sig ${etherscanLink}`;
      break;
    case 'AE-COMP-GOVERNANCE-NEW-ADMIN-ALERT':
      ({ oldAdmin, newAdmin } = metadata);
      message = `**Admin Changed** from ${oldAdmin} to ${newAdmin} by Community Multi-Sig ${etherscanLink}`;
      break;
    case 'AE-COMP-NEW-PAUSE-GUARDIAN-ALERT':
      ({ oldPauseGuardian, newPauseGuardian } = metadata);
      message = `**Pause Guardian Changed** from ${oldPauseGuardian} to ${newPauseGuardian} by Community Multi-Sig ${etherscanLink}`;
      break;
    case 'AE-COMP-ACTION-PAUSED-ALERT':
      ({ action } = metadata);
      message = `**Pause on Action** ${action} by Community Multi-Sig ${etherscanLink}`;
      break;
    case 'AE-COMP-NEW-BORROW-CAP-ALERT':
      ({ cToken, newBorrowCap } = metadata);
      contract = new ethers.Contract(
        cToken,
        CTOKEN_ABI,
        provider,
      );
      symbol = await contract.symbol();
      message = `**New Borrow Cap** for ${symbol} set to ${newBorrowCap} by Community Multi-Sig ${etherscanLink}`;
      break;
    case 'AE-COMP-NEW-BORROW-CAP-GUARDIAN-ALERT':
      ({ oldBorrowCapGuardian, newBorrowCapGuardian } = metadata);
      message = `**New Borrow Cap Guardian** changed from ${oldBorrowCapGuardian} to ${newBorrowCapGuardian} by Community Multi-Sig ${etherscanLink}`;
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

  // use the relayer provider for JSON-RPC requests
  const provider = new DefenderRelayProvider(autotaskEvent);

  const { secrets } = autotaskEvent;
  if (secrets === undefined) {
    return {};
  }

  // ensure that there is a DiscordUrl secret
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
    const message = await createDiscordMessage(
      metadata,
      description,
      alertId,
      transactionHash,
      provider,
    );
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
