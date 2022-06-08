// Set the name of the Secret set in Autotask
const discordSecretName = 'SecurityAlertsDiscordUrl';

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
  const { metadata } = alert;
  if (source === undefined) {
    throw new Error('metadata undefined');
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

  // switch (alertId) {
  //   case 'AE-COMP-MULTISIG-OWNER-ADDED-ALERT':
  //     ({ owner } = metadata);
  //     message = `🆕 **Added Owner** ${owner} to Community Multi-Sig`;
  //     break;
  //   case 'AE-COMP-MULTISIG-OWNER-REMOVED-ALERT':
  //     ({ owner } = metadata);
  //     message = `🙅‍♂️ **Removed Owner** ${owner} from Community Multi-Sig`;
  //     break;
  //   case 'AE-COMP-GOVERNANCE-PROPOSAL-CREATED-ALERT':
  //     ({ proposalId: id } = metadata);
  //     message = '📄 **New Proposal** created by Community Multi-Sig';
  //     message += `\nDetails: https://compound.finance/governance/proposals/${id}`;
  //     break;
  //   case 'AE-COMP-GOVERNANCE-PROPOSAL-EXECUTED-ALERT':
  //     ({ proposalId: id } = metadata);
  //     proposalName = await getProposalTitle(id);
  //     message = `👏 **Executed Proposal** ${proposalName} by Community Multi-Sig`;
  //     break;
  //   case 'AE-COMP-GOVERNANCE-PROPOSAL-CANCELED-ALERT':
  //     ({ proposalId: id } = metadata);
  //     proposalName = await getProposalTitle(id);
  //     message = `❌ **Canceled Proposal** ${proposalName} by Community Multi-Sig`;
  //     break;
  //   case 'AE-COMP-GOVERNANCE-VOTE-CAST-ALERT':
  //     ({ proposalId: id } = metadata);
  //     proposalName = await getProposalTitle(id);
  //     message = `🗳️ **Vote Cast** on proposal ${proposalName} by Community Multi-Sig`;
  //     break;
  //   case 'AE-COMP-GOVERNANCE-THRESHOLD-SET-ALERT':
  //     ({ oldThreshold, newThreshold } = metadata);
  //     message = `📶 **Proposal Threshold Changed** from ${oldThreshold} to ${newThreshold} by Community Multi-Sig`;
  //     break;
  //   case 'AE-COMP-GOVERNANCE-NEW-ADMIN-ALERT':
  //     ({ oldAdmin, newAdmin } = metadata);
  //     message = `🧑‍⚖️ **Admin Changed** from ${oldAdmin} to ${newAdmin} by Community Multi-Sig`;
  //     break;
  //   case 'AE-COMP-NEW-PAUSE-GUARDIAN-ALERT':
  //     ({ oldPauseGuardian, newPauseGuardian } = metadata);
  //     message = `⏸️ **Pause Guardian Changed** from ${oldPauseGuardian} to ${newPauseGuardian} by Community Multi-Sig`;
  //     break;
  //   case 'AE-COMP-ACTION-PAUSED-ALERT':
  //     ({ action } = metadata);
  //     message = `⏯️ **Pause on Action** ${action} by Community Multi-Sig`;
  //     break;
  //   case 'AE-COMP-NEW-BORROW-CAP-ALERT':
  //     ({ cToken, newBorrowCap } = metadata);
  //     contract = new ethers.Contract(
  //       cToken,
  //       CTOKEN_ABI,
  //       provider,
  //     );
  //     symbol = await contract.symbol();
  //     message = `🧢 **New Borrow Cap** for ${symbol} set to ${newBorrowCap} by Community Multi-Sig`;
  //     break;
  //   case 'AE-COMP-NEW-BORROW-CAP-GUARDIAN-ALERT':
  //     ({ oldBorrowCapGuardian, newBorrowCapGuardian } = metadata);
  //     message = `👲 **New Borrow Cap Guardian** changed from ${oldBorrowCapGuardian} to ${newBorrowCapGuardian} by Community Multi-Sig`;
  //     break;
  //   default:
  //     return undefined;
  // }
  // return message;

  const multisigAddressFormatted = multisigAddress.slice(0, 6);

  // // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;

  const message = `${etherscanLink} 📄 **Governance action** taken by **Community Multi-Sig** address **${multisigAddressFormatted}**`;

  // create promises for posting messages to Discord webhook
  await postToDiscord(discordUrl, message);

  return {};
};
