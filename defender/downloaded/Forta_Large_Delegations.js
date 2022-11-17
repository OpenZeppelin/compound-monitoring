// Set the name of the Secret set in Autotask
const discordSecretName = 'SecurityAlertsDiscordUrl';

const axios = require('axios');
const axiosRetry = require('axios-retry');

function condition(error) {
  const result = axiosRetry.isNetworkOrIdempotentRequestError(error);
  const rateLimit = (error.response.status === 429);
  return result || rateLimit;
}

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: condition,
});

async function postToDiscord(url, message) {
  const method = 'post';
  const headers = {
    'Content-Type': 'application/json',
  };
  const data = { content: message };

  const response = await axios({
    url,
    method,
    headers,
    data,
  });
  return response;
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

  // Ref: https://developer.mozilla.org/en-US/docs/Web/API/URL
  function isValidUrl(string) {
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }
    return url.href;
  }

  if (isValidUrl(discordUrl) === false) {
    throw new Error('discordUrl is not a valid URL');
  }

  // ensure that the request key exists within the autotaskEvent Object
  const { request } = autotaskEvent;
  if (request === undefined) {
    console.error('request undefined, Autotask must be triggered by a sentinel');
    return 'request undefined, Autotask must be triggered by a sentinel';
  }

  // ensure that the body key exists within the request Object
  const { body } = request;
  if (body === undefined) {
    throw new Error('body undefined');
  }

  // ensure that the alert key exists within the body Object
  const { alert } = body;
  if (alert === undefined) {
    throw new Error('alert undefined');
  }

  // ensure that the alert key exists within the body Object
  const { source } = body;
  if (source === undefined) {
    throw new Error('source undefined');
  }

  // extract the metadata from the alert Object
  const { metadata } = alert;
  if (metadata === undefined) {
    throw new Error('metadata undefined');
  }

  // extract the hashes from the source Object
  const {
    transactionHash,
  } = source;

  // Start of usual modifications to the autotask script
  // extract the metadata
  const {
    delegateAddress,
    levelName,
  } = metadata;
  if (delegateAddress === undefined) {
    throw new Error('delegateAddress undefined');
  }

  const delegateFormatted = delegateAddress.slice(0, 6);

  // // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  const message = `${etherscanLink} 💸 **${delegateFormatted}** has been delegated  enough **COMP** tokens to pass min threshold for the governance event: **${levelName}**`;

  // create promises for posting messages to Discord webhook
  // with Log Forwarding enabled, this console.log will forward the text string to Dune Analytics
  console.log(message);
  await postToDiscord(discordUrl, message);

  return {};
};
