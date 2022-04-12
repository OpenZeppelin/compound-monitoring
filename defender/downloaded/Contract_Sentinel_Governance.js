const axios = require('axios');

async function postToDiscord(discordWebhook, message) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const body = {
    content: message,
  };

  // perform the POST request
  const response = await axios({
    url: discordWebhook,
    method: 'post',
    headers,
    data: JSON.stringify(body),
  });

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

async function getAccountDisplayName(voter, proposalId) {
  const baseUrl = 'https://api.compound.finance/api/v2/governance/proposal_vote_receipts';
  const queryUrl = `?account=${voter}&proposal_id=${proposalId}`;
  let displayName;
  try {
    const result = await axios.get(baseUrl + queryUrl);
    displayName = result.data.proposal_vote_receipts[0].voter.display_name;
    if (displayName === null) {
      displayName = '';
    }
  } catch {
    displayName = '';
  }
  return displayName;
}

function getProposalTitleFromDescription(description) {
  const lines = description.split('\n');
  let [proposalName] = lines;
  // remove markdown heading symbol and then leading and trailing spaces
  if (proposalName !== undefined) {
    proposalName = proposalName.replaceAll('#', '').trim();
  }
  return proposalName;
}

async function createDiscordMessage(eventName, params, transactionHash) {
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
      message = `**New Proposal** ${proposalName} by ${proposer.slice(0, 6)} ${etherscanLink}`;
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

      displayName = await getAccountDisplayName(voter, proposalId);

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
        votes = '0.' + '0'.repeat(18 - votes.length) + votes[0];
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
      message = `**Canceled Proposa**l ${proposalName} ${noEntryEmoji}`;
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
  const { DiscordUrl: discordUrl } = secrets;
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
    sentinel: {
      abi
    },
    matchedAddresses,
  } = body;
  if (matchReasons === undefined) {
    return {};
  }

  const contractAddress = matchedAddresses[0];

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
    await postToDiscord(discordUrl, messages[i]);
  }

  console.log('Posted!');
  
  return {};
};