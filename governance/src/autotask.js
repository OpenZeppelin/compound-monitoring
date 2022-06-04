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

async function getAccountDisplayName(voter) {
  const baseUrl = 'https://api.compound.finance/api/v2/governance/proposal_vote_receipts';
  const queryUrl = `?account=${voter}`;
  let displayName;
  try {
    const result = await axios.get(baseUrl + queryUrl);
    displayName = result.data.proposal_vote_receipts[0].voter.display_name;
    if (displayName === null) {
      displayName = '';
    }
  } catch (err) {
    displayName = '';
  }
  return displayName;
}

function getProposalTitleFromDescription(description) {
  const lines = description.split('\n');
  let [proposalName] = lines;
  // remove markdown heading symbol and then leading and trailing spaces
  if (proposalName !== undefined) {
    try {
      proposalName = proposalName.replaceAll('#', '').trim();
    } catch (err) {
      proposalName = undefined;
    }
  }
  return proposalName;
}

async function createDiscordMessage(eventName, params, transactionHash) {
  let description;
  let support;
  let proposalId;
  let proposer;
  let voter;
  let votes;
  let reason;
  let proposalName;
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

  switch (eventName) {
    case 'ProposalCreated':
      ({ proposer, id, description } = params);
      proposalName = getProposalTitleFromDescription(description);
      if (proposalName === undefined) {
        proposalName = await getProposalTitle(id);
      }
      displayName = await getAccountDisplayName(proposer);
      if (displayName === '') {
        message = `**New Proposal** ${proposalName} by ${proposer.slice(0, 6)} ${etherscanLink}`;
      } else {
        message = `**New Proposal** ${proposalName} by ${displayName} ${etherscanLink}`;
      }
      message += `\nDetails: https://compound.finance/governance/proposals/${id}`;
      break;
    case 'VoteCast':
      ({
        reason,
        voter,
        votes,
        support,
        proposalId,
      } = params);

      displayName = await getAccountDisplayName(voter);

      if (support === 0) {
        supportEmoji = noEntryEmoji;
      } else if (support === 1) {
        supportEmoji = checkMarkEmoji;
      }

      if (votes.length > 18) {
        votes = votes.slice(0, votes.length - 18);
      } else {
        // keep the most significant digit and add the appropriate
        // number of zeros to create an accurate decimal representation
        votes = `0.${'0'.repeat(18 - votes.length)}${votes[0]}`;
      }
      votes = internationalNumberFormat.format(votes);

      proposalName = await getProposalTitle(proposalId);
      if (displayName !== '') {
        message = `**Vote** ${proposalName} ${supportEmoji} ${votes} by ${displayName} ${etherscanLink}`;
      } else {
        message = `**Vote** ${proposalName} ${supportEmoji} ${votes} by ${voter.slice(0, 6)} ${etherscanLink}`;
      }

      if (reason !== '') {
        message += `\n\`\`\`${reason}\`\`\``;
      }
      break;
    case 'ProposalCanceled':
      ({ id } = params);
      proposalName = await getProposalTitle(id);
      message = `**Canceled Proposal** ${proposalName} ${noEntryEmoji}`;
      break;
    case 'ProposalExecuted':
      ({ id } = params);
      proposalName = await getProposalTitle(id);
      message = `**Executed Proposal** ${proposalName} ${checkMarkEmoji}`;
      break;
    case 'ProposalQueued':
      ({ eta, id } = params);
      proposalName = await getProposalTitle(id);
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
    throw new Error('autotaskEvent undefined');
  }

  const { secrets } = autotaskEvent;
  if (secrets === undefined) {
    throw new Error('secrets undefined');
  }

  // ensure that there is a DiscordUrl secret
  const { discordUrl } = secrets;
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
  const { metadata, name } = alert;
  if (source === undefined) {
    throw new Error('metadata undefined');
  }
  if (name === undefined) {
    throw new Error('name undefined');
  }

  // extract the hashes from the source Object
  const {
    transactionHash,
    // block: {
    //   hash,
    // },
  } = source;

  // Start of usual modifications to the autotask script

  // Parse the EventName from the emitted event name
  const lastWord = name.split(' ').pop();
  let eventName;
  switch (lastWord) {
    case 'Created':
      eventName = 'ProposalCreated';
      break;
    case 'Cast':
      eventName = 'VoteCast';
      break;
    case 'Canceled':
      eventName = 'ProposalCanceled';
      break;
    case 'Executed':
      eventName = 'ProposalExecuted';
      break;
    case 'Queued':
      eventName = 'ProposalQueued';
      break;
    case 'Set':
      eventName = 'ThresholdSet';
      break;
    default:
      throw new Error('Unknown eventName');
  }

  const message = await createDiscordMessage(eventName, metadata, transactionHash);

  // create promises for posting messages to Discord webhook
  await postToDiscord(discordUrl, message);

  return {};
};
