require('dotenv').config();

const stackName = 'governance_twitter_bot';
const discordSecretName = `${stackName}_webhookURL`;
const governanceAddressSecretName = `${stackName}_governanceAddress`;
const appKeySecretName = `${stackName}_appKey`;
const appSecretSecretName = `${stackName}_appSecret`;
const accessTokenSecretName = `${stackName}_accessToken`;
const accessSecretSecretName = `${stackName}_accessSecret`;

const ethers = require('ethers');
const axios = require('axios');
const axiosRetry = require('axios-retry');

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

const { DefenderRelayProvider } = require('defender-relay-client/lib/ethers');

const compoundGovernanceAbi = [
  'function initialProposalId() view returns (uint256)',
  'function proposalCount() view returns (uint256)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function proposals(uint256) view returns (uint256 id, address proposer, uint256 eta, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool canceled, bool executed)',
  'function comp() view returns (address)',
  'function quorumVotes() view returns (uint256)',
];

const compAbi = [
  'function decimals() view returns (uint8 decimals)',
];

async function postToTwitter(client, message, tweetIdToReply) {
  let result;
  if (tweetIdToReply) {
    // Reply to previous tweet if possible
    result = await client.v1.reply(message, tweetIdToReply);
  } else {
    // Otherwise start a new tweet thread
    result = await client.v1.tweet(message);
  }
  const { id_str: id } = result;
  return id;
}

async function getProposalTitle(proposalId) {
  const baseUrl = 'https://api.compound.finance/api/v2/governance/proposals';
  const queryUrl = `?proposal_ids[]=${proposalId}`;
  const fullUrl = baseUrl + queryUrl;
  let title;
  try {
    const result = await axios.get(fullUrl);
    title = result.data.proposals[0].title;
    if (title === null) {
      title = '';
    }
  } catch {
    title = '';
  }
  return title;
}

exports.handler = async function handler(autotaskEvent) {
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

  // create a Provider from the connected Relay
  console.debug('Creating DefenderRelayProvider');
  const provider = new DefenderRelayProvider(autotaskEvent);

  try {
    await provider.getBlock('latest');
  } catch (error) {
    console.error('Error attempting to use Relay provider');
    throw error;
  }

  // create an ethers.js Contract Object to interact with the on-chain smart contract
  console.debug('Creating governanceContract');
  const governanceContract = new ethers.Contract(
    compoundGovernanceAddress,
    compoundGovernanceAbi,
    provider,
  );

  const twitterKeys = {
    // Consumer Keys from an elevated developer account
    appKey: '',
    appSecret: '',
    // Authentication Tokens (must have write permissions)
    accessToken: '',
    accessSecret: '',
  };

  const userClient = new TwitterApi(config);

  // check the initialized value of the proposal ID
  // NOTE: the first proposal ID is this value PLUS 1
  const initialProposalId = (await governanceContract.initialProposalId()).toNumber();
  const startProposalId = initialProposalId + 1;
  console.debug(`first proposal value: ${startProposalId}`);

  // check the value of the latest proposal ID
  const currentProposalId = (await governanceContract.proposalCount()).toNumber();
  console.debug(`currentProposalId: ${currentProposalId}`);

  // create the Array of proposal IDs to check
  const proposalsToCheck = [];
  for (let proposalId = startProposalId; proposalId <= currentProposalId; proposalId++) {
    proposalsToCheck.push(proposalId);
  }
  console.debug(`proposalsToCheck: ${proposalsToCheck}`);

  const results = await Promise.all(proposalsToCheck.map(async (proposalId) => {
    const state = await governanceContract.state(proposalId);
    switch (state) {
      case 0: // Pending
        // nothing to do
        break;
      case 1: // Active
        console.debug(`Proposal ${proposalId} is active!`);
        return proposalId;
      case 2: // Canceled
        // nothing to do
        break;
      case 3: // Defeated
        // nothing to do
        break;
      case 4: // Successful
        // nothing to do
        break;
      case 5: // Queued
        // nothing to do
        break;
      case 6: // Expired
        // nothing to do
        break;
      case 7: // Executed
        // nothing to do
        break;
      default:
        console.error(`Unexpected proposal state: ${state}`);
    }
    return null;
  }));

  const pendingProposals = results.filter(Boolean);

  // End early if there is nothing to process
  if (pendingProposals.length === 0) {
    console.debug('No pending proposals found');
    return true;
  }

  // Get timing info
  const blockGap = 1000;
  const currentBlock = await provider.getBlock('latest');
  const oldBlock = await provider.getBlock(currentBlock.number - blockGap);
  const timePerBlock = (currentBlock.timestamp - oldBlock.timestamp) / blockGap;

  // Get vote info for each pending proposal
  console.debug('Gathering vote information');

  // Get COMP's address to query for decimals.
  const compAddress = await governanceContract.comp();
  const compContract = new ethers.Contract(compAddress, compAbi, provider);
  const compDecimals = await compContract.decimals();
  const compScale = ethers.BigNumber.from(10).pow(compDecimals);

  // Find how many votes are need to pass
  const quorumVotes = await governanceContract.quorumVotes();

  // Get titles of the Proposals
  const titleMap = {};
  await Promise.all(pendingProposals.map(async (proposalId) => {
    titleMap[proposalId] = await getProposalTitle(proposalId);
  }));

  // Get proposal info
  const proposalInfo = await Promise.all(pendingProposals
    .map(async (proposalId) => governanceContract.proposals(proposalId)));

  // Define the initial message
  const initialMessage = `Current Compound Governance Proposals as of ${new Date().toUTCString()}`;
  let tweetId = postToTwitter(userClient, initialMessage, null);

  for (let proposalIndex = 0; proposalIndex < proposalInfo.length; proposalIndex++) {
    const proposal = proposalInfo[proposalIndex];

    const forVotes = proposal.forVotes.div(compScale).toString();
    const againstVotes = proposal.againstVotes.div(compScale).toString();
    const abstainVotes = proposal.abstainVotes.div(compScale).toString();
    const vsQuorum = proposal.forVotes.mul(100).div(quorumVotes).toString();

    const blocksLeft = proposal.endBlock - currentBlock.number;
    let timeLeft = blocksLeft * timePerBlock;
    // 86400 seconds in a day. 60 * 60 * 24 = 86400
    const days = Math.trunc(timeLeft / 86400);
    timeLeft %= 86400;
    // 3600 seconds in an hour 60 * 60 = 3600
    const hours = Math.trunc(timeLeft / 3600);
    timeLeft %= 3600;
    // 60 seconds in a minute
    const minutes = Math.trunc(timeLeft / 60);
    timeLeft %= 60;
    const seconds = Math.trunc(timeLeft);

    const titleLink = `[${proposal.id} - ${titleMap[proposal.id]}]`
      + `(https://compound.finance/governance/proposals/${proposal.id})`;
    const discordMessage = `Compound Governance: Proposal ${titleLink} is active with:\n\t`
      + `FOR votes vs quorum threshold: ${vsQuorum}%\n\t`
      + `👍 (for) votes:     ${forVotes}\n\t`
      + `👎 (against) votes: ${againstVotes}\n\t`
      + `🙊 (abstain) votes: ${abstainVotes}\n\t`
      + `Time left to vote: ${days} day(s) ${hours} hour(s) ${minutes} minutes(s) ${seconds} seconds(s) `;
    console.debug(discordMessage);
    await postToDiscord(discordUrl, discordMessage);
  }
  await Promise.all(proposalInfo.map(async (proposal) => {
  }));
  return true;
};

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  const { RELAYER_API_KEY: apiKey, RELAYER_SECRET_KEY: apiSecret } = process.env;
  const secrets = {};
  secrets[discordSecretName] = process.env.DISCORD_URL;

  exports.handler({ apiKey, apiSecret, secrets })
    .then(() => process.exit(0))
    .catch((error) => { console.error(error); process.exit(1); });
}
