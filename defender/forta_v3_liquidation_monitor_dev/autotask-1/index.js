const stackName = 'forta_v3_liquidation_monitor_dev';
const discordSecretName = `${stackName}_discordWebhook`;

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
    throw new Error('request undefined');
  }

  // ensure that the body key exists within the request Object
  const { body } = request;
  if (body === undefined) {
    throw new Error('body undefined');
  }

  const {
    alert,
    source,
  } = body;
  if (alert === undefined) {
    throw new Error('alert undefined');
  } else if (source === undefined) {
    throw new Error('source undefined');
  }

  // extract the metadata from the alert Object
  const { metadata } = alert;
  if (metadata === undefined) {
    throw new Error('metadata undefined');
  }

  const {
    borrowerAddress,
    blockNumber,
  } = metadata;

  const message = `📉💵🔥 **Liquidatable account detected** account ${borrowerAddress.slice(0, 6)} `
    + `is liquidatable in block ${blockNumber} (Compound v3)`;

  // construct the Etherscan transaction link
  let etherscanLink = `[BLOCK](<https://etherscan.io/block/${blockNumber}>)`;
  etherscanLink += ` - [ACCT](<https://etherscan.io/address/${borrowerAddress}>)`;

  // create promises for posting messages to Discord webhook
  // with Log Forwarding enabled, this console.log will forward the text string to Dune Analytics
  console.log(`${etherscanLink} ${message}`);
  await postToDiscord(discordUrl, `${etherscanLink} ${message}`);

  return {};
};
