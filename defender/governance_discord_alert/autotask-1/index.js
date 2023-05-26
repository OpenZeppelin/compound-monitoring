const stackName = 'governance_discord_alert';
const discordSecretName = `${stackName}_discordWebhook`;
const tallyApiKeySecretName = `${stackName}_tallyApiKey`;
let tallyApiKey;
// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');

const baseTallyUrl = 'https://api.tally.xyz/query';
const v2GovernorAddress = '0xc0da02939e1441f497fd74f78ce7decb17b66529';
const ethereumMainnetChainId = 'eip155:1';

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
    data: body,
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
// Using both chainId and governor address to be safe
async function getProposalTitle(proposalId) {
  let title;
  try {
    const tallyRes = await axios.post(
      baseTallyUrl,
      {
        query: 'query Proposals($chainId: ChainID!,\n$governors: [Address!],\n$proposalIds: [ID!]) {\nproposals(\nchainId: $chainId,\ngovernors: $governors,\nproposalIds: $proposalIds,\n) {\nid\ntitle\ndescription\n},}',
        variables: {
          chainId: ethereumMainnetChainId,
          governors: [v2GovernorAddress],
          proposalIds: [proposalId],
        },
      },
      {
        headers: {
          'Api-Key': tallyApiKey,
        },
      },
    );
    title = tallyRes.data.data.proposals[0].title.replaceAll('#', '').trim();

    if (title === null) {
      title = '';
    }
  } catch {
    title = '';
  }
  return title;
}

async function getAccountDisplayName(voter) {
  let displayName;
  try {
    const result = await axios.post(
      baseTallyUrl,
      {"query":"query Accounts(\n$ids: [AccountID!],\n$addresses:[Address!]\n) {\naccounts(\nids: $ids,\naddresses: $addresses\n ) {\nid\naddress\nname}}",
        variables: {
          ids: [`${ethereumMainnetChainId}:${voter}`],
          addresses: [voter],
        },
      },
      {
        headers: {
          'Api-Key': tallyApiKey,
        },
      },
    );
    displayName = result.data.data.accounts[0].name;
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

  let voteTypeString;
  const noEntryEmoji = '⛔';
  const checkMarkEmoji = '✅';
  const speakNoEvilEmoji = '🙊';

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
      // Reference:
      // https://discord.com/developers/docs/resources/channel#allowed-mentions-object-allowed-mentions-reference
      if (displayName === '') {
        message = `@here **New Proposal** ${proposalName} by ${proposer.slice(0, 6)} ${etherscanLink}`;
      } else {
        message = `@here **New Proposal** ${proposalName} by ${displayName} ${etherscanLink}`;
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
        voteTypeString = '**Vote**';
      } else if (support === 1) {
        supportEmoji = checkMarkEmoji;
        voteTypeString = '**Vote**';
      } else if (support === 2) {
        supportEmoji = speakNoEvilEmoji; // abstain
        voteTypeString = '**Abstain**';
      }

      if (votes.length > 18) {
        votes = votes.slice(0, votes.length - 18);
      } else {
        // do not display votes less than 1 COMP
        console.debug(`Number of votes is less than 1 COMP, not displaying message: ${votes}`);
        return undefined;
      }
      votes = internationalNumberFormat.format(votes);

      proposalName = await getProposalTitle(proposalId);
      if (displayName !== '') {
        message = `${voteTypeString} ${proposalName} ${supportEmoji} ${votes} by ${displayName} ${etherscanLink}`;
      } else {
        message = `${voteTypeString} ${proposalName} ${supportEmoji} ${votes} by ${voter.slice(0, 6)} ${etherscanLink}`;
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

  const { secrets, request } = autotaskEvent;
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

  // ensure that there is a Tally secret
  tallyApiKey = secrets[tallyApiKeySecretName];
  if (tallyApiKey === undefined) {
    throw new Error('Tally API key undefined');
  }

  // ensure that the request key exists within the autotaskEvent Object
  if (request === undefined) {
    throw new Error('request undefined');
  }

  // ensure that the body key exists within the request Object
  const { body } = request;
  if (body === undefined) {
    throw new Error('body undefined');
  }

  // ensure that the alert key exists within the body Object
  // This looks like a Forta event type?
  const {
    matchReasons,
    hash: transactionHash,
  } = body;
  if (matchReasons === undefined) {
    throw new Error('matchReasons undefined');
  }

  // create messages for Discord
  const promises = matchReasons.map(async (reason) => {
    // determine the type of event it was
    const { signature, params } = reason;
    const eventName = signature.slice(0, signature.indexOf('('));
    // craft the Discord message
    return createDiscordMessage(eventName, params, transactionHash);
  });

  // wait for the promises to settle
  let results = await Promise.allSettled(promises);

  const discordPromises = results.map((result) => {
    // if the number of votes cast was less than 1 COMP, the resulting message will be undefined
    if (result.value === undefined) {
      // return early, do not attempt a POST request to Discord
      return undefined;
    }

    return postToDiscord(discordUrl, result.value);
  });

  results = await Promise.allSettled(discordPromises);
  results = results.filter((result) => result.status === 'rejected');

  if (results.length > 0) {
    throw new Error(results[0].reason);
  }

  return {};
};
