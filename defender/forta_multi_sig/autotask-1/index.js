const stackName = 'forta_multi_sig';
const discordSecretName = `${stackName}_discordWebhook`;

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
  const data = { content: message };

  let response;
  try {
    // perform the POST request
    response = await post(url, method, headers, data);
  } catch (error) {
    // check if this is a "too many requests" error (HTTP status 429)
    if (error.response && error.response.status === 429) {
      // the request was made and a response was received
      // try again after waiting 5 - 50 seconds, if retry_after value is received, use that.
      let timeout;
      // Discord Webhook API defaults to v6, and v6 returns retry_after value in ms. Later versions
      // use seconds, so this will need to be updated when Discord changes their default API version
      // Ref: https://discord.com/developers/docs/reference
      if (error.response.data
        && error.response.data.retry_after
        && error.response.data.retry_after < 50000) {
        // Wait the specified amount of time + a random number to reduce
        // overlap with newer requests. Initial testing reveals that the Discord Webhook allows 5
        // requests and then resets the counter after 2 seconds. With a 15 second range of 5-20,
        // this function can reliably can handle batches of 15 requests. Increase the max variable
        // below if you anticipate a larger number of requests.
        // Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
        const min = 5000;
        const max = 30000;
        timeout = Math.floor(Math.random() * (max - min) + min);
        timeout += error.response.data.retry_after;
      } else {
        // If retry_after is larger than 50 seconds, then just wait 50 seconds.
        timeout = 50000;
      }
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, timeout));
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
  const { alertId, metadata } = alert;
  if (metadata === undefined) {
    throw new Error('metadata undefined');
  }

  const { protocolVersion } = metadata;

  let protocolVersionString = '';
  if (protocolVersion !== undefined) {
    if (protocolVersion === '2') {
      protocolVersionString = ' (Compound v2)';
    } else if (protocolVersion === '3') {
      protocolVersionString = ' (Compound v3)';
    } else if (protocolVersion === '2,3') {
      protocolVersionString = ' (Compound v2/v3)';
    }
  }

  // extract the hashes from the source Object
  const {
    transactionHash,
  } = source;

  // Start of usual modifications to the autotask script
  // extract the metadata
  const {
    multisigAddress,
  } = metadata;
  if (multisigAddress === undefined) {
    throw new Error('multisigAddress undefined');
  }

  const multisigAddressFormatted = multisigAddress.slice(0, 6);

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
  let cTokenFormatted;
  let newBorrowCap;
  let message;
  let id;
  let owner;

  switch (alertId) {
    case 'AE-COMP-MULTISIG-OWNER-ADDED-ALERT':
      ({ owner } = metadata);
      message = `🆕 **Added Owner** ${owner} to Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-APPROVED-HASH-ALERT':
      ({ owner, approvedHash } = metadata);
      message = `✅#️⃣  **Approved Hash** ${owner} approved hash ${approvedHash} to Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-CHANGED-MASTER-COPY-ALERT':
      ({ masterCopy } = metadata);
      message = `➡️ 📜 **Changed Master Copy** to ${masterCopy} to Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-CHANGED-THRESHOLD-ALERT':
      ({ threshold } = metadata);
      message = `🎚️ **Changed Threshold** to ${threshold} to Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-DISABLED-MODULE-ALERT':
      ({ module } = metadata);
      message = `🔴🧩 **Disabled Module** ${module} to Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-ENABLED-MODULE-ALERT':
      ({ module } = metadata);
      message = `🟢🧩 **Enabled Module** ${module} to Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-EXECUTION-FAILURE-ALERT':
      ({ txHash } = metadata);
      message = `❌ **Execution Failure** for transaction ${txHash} to Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-EXECUTION-FROM-MODULE-FAILURE-ALERT':
      ({ module } = metadata);
      message = `❌🧩 **Execution from Module Failure** for module ${module} to Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-EXECUTION-FROM-MODULE-SUCCESS-ALERT':
      ({ module } = metadata);
      message = `✅🧩 **Execution from Module Success** for module ${module} to Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-EXECUTION-SUCCESS-ALERT':
      ({ txHash } = metadata);
      message = `✅ **Execution Success** for transaction ${txHash} to Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-OWNER-REMOVED-ALERT':
      ({ owner } = metadata);
      message = `🙅‍♂️ **Removed Owner** ${owner} from Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-MULTISIG-SIGN-MESSAGE-ALERT':
      ({ msgHash } = metadata);
      message = `🔏 **Signed Message** hash ${msgHash} from Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-GOVERNANCE-PROPOSAL-CREATED-ALERT':
      ({ proposalId: id } = metadata);
      message = '📄 **New Proposal** created by Community Multi-Sig';
      message += `\nDetails: https://compound.finance/governance/proposals/${id}${protocolVersionString}`;
      break;
    case 'AE-COMP-GOVERNANCE-PROPOSAL-EXECUTED-ALERT':
      ({ proposalId: id } = metadata);
      message = `👏 **Executed Proposal** #${id} by Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-GOVERNANCE-PROPOSAL-CANCELED-ALERT':
      ({ proposalId: id } = metadata);
      message = `❌ **Canceled Proposal**  #${id} by Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-GOVERNANCE-VOTE-CAST-ALERT':
      ({ proposalId: id } = metadata);
      message = `🗳️ **Vote Cast** on proposal #${id} by Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-GOVERNANCE-THRESHOLD-SET-ALERT':
      ({ oldThreshold, newThreshold } = metadata);
      message = `📶 **Proposal Threshold Changed** from ${oldThreshold} to ${newThreshold} by Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-GOVERNANCE-NEW-ADMIN-ALERT':
      ({ oldAdmin, newAdmin } = metadata);
      message = `🧑‍⚖️ **Admin Changed** from ${oldAdmin} to ${newAdmin} by Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-NEW-PAUSE-GUARDIAN-ALERT':
      ({ oldPauseGuardian, newPauseGuardian } = metadata);
      message = `⏸️ **Pause Guardian Changed** from ${oldPauseGuardian} to ${newPauseGuardian} by Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-ACTION-PAUSED-ALERT':
      ({ action } = metadata);
      message = `⏯️ **Pause on Action** ${action} by Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-NEW-BORROW-CAP-ALERT':
      ({ cToken, newBorrowCap } = metadata);
      cTokenFormatted = cToken.slice(0, 6);
      message = `🧢 **New Borrow Cap** for ${cTokenFormatted} set to ${newBorrowCap} by Community Multi-Sig${protocolVersionString}`;
      break;
    case 'AE-COMP-NEW-BORROW-CAP-GUARDIAN-ALERT':
      ({ oldBorrowCapGuardian, newBorrowCapGuardian } = metadata);
      message = `👲 **New Borrow Cap Guardian** changed from ${oldBorrowCapGuardian} to ${newBorrowCapGuardian} by Community Multi-Sig${protocolVersionString}`;
      break;
    default:
      message = `📄 **Governance action** taken by **Community Multi-Sig** address **${multisigAddressFormatted}${protocolVersionString}**`;
  }

  // // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  // create promises for posting messages to Discord webhook
  // with Log Forwarding enabled, this console.log will forward the text string to Dune Analytics
  console.log(`${etherscanLink} ${message}`);
  await postToDiscord(discordUrl, `${etherscanLink} ${message}`);

  return {};
};
