const axios = require('axios');

async function post(url, method, headers, data) {
  return axios({
    url,
    method,
    headers,
    data,
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

// eslint-disable-next-line func-names
exports.handler = async function (autotaskEvent) {
  // ensure that the autotaskEvent Object exists
  if (autotaskEvent === undefined) {
    return {};
  }

  const { secrets } = autotaskEvent;
  if (secrets === undefined) {
    return {};
  }

  // ensure that there is a DiscordUrl secret
  const { discordUrl } = secrets;
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

  // ensure that the alert key exists within the body Object
  const { source } = body;
  if (source === undefined) {
    return {};
  }

  console.log(alert);
  // extract the metadata from the alert Object
  const {
    metadata,
  } = alert;

  // extract the hashes from the source Object
  const {
    // transactionHash,
    block: {
      hash,
    },
  } = source;

  const {
    borrowerAddress,
    liquidationAmount,
  } = metadata;

  const message = `📉💵🔥 **Liquidatable account detected** account ${borrowerAddress} `
    + `is liquidatable for $${liquidationAmount}`;

  // construct the Etherscan transaction link
  // const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;
  let etherscanLink = `[BLOCK](<https://etherscan.io/block/${hash}>)`;
  etherscanLink += ` - [ACCT](<https://etherscan.io/address/${borrowerAddress}>)`;
  // create promises for posting messages to Discord webhook
  await postToDiscord(discordUrl, `${etherscanLink} ${message}`);

  return {};
};
