// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');

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
      const promise = new Promise((resolve) => setTimeout(resolve, delay));
      await promise;
      response = await axios(discordObject);
    } else {
      throw err;
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
    console.log(`Display name successfully retrieved: ${displayName}`);
    if (displayName === null) {
      displayName = '';
    }
  } catch (err) {
    console.error(`Display name NOT successfully retrieved: ${err}`);
    displayName = '';
  }
  return displayName;
}

function getProposalTitleFromDescription(description) {
  const lines = description.split('\n');
  let [proposalName] = lines;
  // remove markdown heading symbol and then leading and trailing spaces
  if (proposalName !== undefined) {
    console.log(proposalName);
    try {
      proposalName = proposalName.replaceAll('#', '').trim();
    } catch (err) {
      console.error(err);
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
  console.log(autotaskEvent);
  // ensure that the autotaskEvent Object exists
  if (autotaskEvent === undefined) {
    return {};
  }

  const { secrets } = autotaskEvent;
  if (secrets === undefined) {
    return {};
  }

  // ensure that there is a DiscordUrl secret
  const { COMPGovernanceDiscordUrl: discordUrl } = secrets;
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
  const {
    matchReasons,
    hash: transactionHash,
  } = body;
  if (matchReasons === undefined) {
    return {};
  }

  // create messages for Discord
  const promises = matchReasons.map(async (reason) => {
    // determine the type of event it was
    const { signature, params } = reason;
    const eventName = signature.slice(0, signature.indexOf('('));
    // craft the Discord message
    console.log('Creating Discord message');
    return createDiscordMessage(eventName, params, transactionHash);
  });

  // wait for the promises to settle
  const messages = await Promise.all(promises);

  for (let i = 0; i < messages.length; i++) {
    console.log('Posting to Discord');
    console.log(messages[i]);
    // eslint-disable-next-line no-await-in-loop
    await postToDiscord(discordUrl, messages[i]);
  }

  console.log('Posted!');

  return {};
};
