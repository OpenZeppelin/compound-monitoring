require('dotenv').config();

const stackName = 'governance_twitter_summary';
const governanceAddressSecretName = `${stackName}_governanceAddress`;
// Consumer Keys from an elevated developer account
const appKeySecretName = `${stackName}_appKey`;
const appSecretSecretName = `${stackName}_appSecret`;
// Authentication Tokens (must have write permissions)
const accessTokenSecretName = `${stackName}_accessToken`;
const accessSecretSecretName = `${stackName}_accessSecret`;

const ethers = require('ethers');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const { DefenderRelayProvider } = require('defender-relay-client/lib/ethers');
const { TwitterApi } = require('./twitter-api-v2');

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
  // Use the id_str because id is greater than Number.MAX_SAFE_INTEGER
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

  // ensure that there is a governanceAddress secret
  const governanceAddress = secrets[governanceAddressSecretName];
  if (governanceAddress === undefined) {
    throw new Error('governanceAddress undefined');
  }

  // ensure that there is an appKey secret
  const appKey = secrets[appKeySecretName];
  if (appKey === undefined) {
    throw new Error('appKey undefined');
  }

  // ensure that there is an appSecret secret
  const appSecret = secrets[appSecretSecretName];
  if (appSecret === undefined) {
    throw new Error('appSecret undefined');
  }

  // ensure that there is an accessToken secret
  const accessToken = secrets[accessTokenSecretName];
  if (accessToken === undefined) {
    throw new Error('accessToken undefined');
  }

  // ensure that there is an accessSecret secret
  const accessSecret = secrets[accessSecretSecretName];
  if (accessSecret === undefined) {
    throw new Error('accessSecret undefined');
  }

  const twitterKeys = {
    // Consumer Keys from an elevated developer account
    appKey,
    appSecret,
    // Authentication Tokens (must have write permissions)
    accessToken,
    accessSecret,
  };
  const userClient = new TwitterApi(twitterKeys);

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
    governanceAddress,
    compoundGovernanceAbi,
    provider,
  );

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

  const activeProposals = results.filter(Boolean);

  // End early if there is nothing to process
  if (activeProposals.length === 0) {
    console.debug('No active proposals found');
    return true;
  }

  // Get timing info
  const blockGap = 1000;
  const currentBlock = await provider.getBlock('latest');
  const oldBlock = await provider.getBlock(currentBlock.number - blockGap);
  const timePerBlock = (currentBlock.timestamp - oldBlock.timestamp) / blockGap;

  // Get vote info for each active proposal
  console.debug('Gathering vote information');

  // Get COMP's address to query for decimals
  const compAddress = await governanceContract.comp();
  const compContract = new ethers.Contract(compAddress, compAbi, provider);
  const compDecimals = await compContract.decimals();
  const compScale = ethers.BigNumber.from(10).pow(compDecimals);

  // Find how many votes are needed to pass
  const quorumVotes = await governanceContract.quorumVotes();

  // Get titles of the Proposals
  const titleMap = {};
  await Promise.all(activeProposals.map(async (proposalId) => {
    titleMap[proposalId] = await getProposalTitle(proposalId);
  }));

  // Get proposal info
  const proposalInfo = await Promise.all(activeProposals
    .map(async (proposalId) => governanceContract.proposals(proposalId)));

  // Define the initial message
  const initialMessage = `Current Compound Governance Proposals as of ${new Date().toUTCString()}:`;
  let tweetId = await postToTwitter(userClient, initialMessage, null);

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

    const proposalLink = `https://compound.finance/governance/proposals/${proposal.id}`;
    const currentTweet = `Proposal #${proposal.id} - ${titleMap[proposal.id]}:\n`
      + `FOR votes vs quorum threshold: ${vsQuorum}%\n`
      + `👍 (for) votes: ${forVotes}\n`
      + `👎 (against) votes: ${againstVotes}\n`
      + `🙊 (abstain) votes: ${abstainVotes}\n`
      + `Time left to vote: ${days} day(s) ${hours} hour(s) ${minutes} minutes(s) ${seconds} seconds(s)\n`
      + `${proposalLink}`;
    console.debug(currentTweet);
    // eslint-disable-next-line no-await-in-loop
    tweetId = await postToTwitter(userClient, currentTweet, tweetId);
  }

  return true;
};

// To run locally (this code will not be executed in AutoTasks)
if (require.main === module) {
  // Import values from the local .env file
  const { RELAYER_API_KEY: apiKey, RELAYER_SECRET_KEY: apiSecret } = process.env;
  const secrets = {
    [governanceAddressSecretName]: process.env.GOVERNANCE_ADDRESS,
    [appKeySecretName]: process.env.TWITTER_APP_KEY,
    [appSecretSecretName]: process.env.TWITTER_APP_SECRET,
    [accessTokenSecretName]: process.env.TWITTER_ACCESS_TOKEN,
    [accessSecretSecretName]: process.env.TWITTER_ACCESS_SECRET,
  };

  exports.handler({ apiKey, apiSecret, secrets })
    .then(() => process.exit(0))
    .catch((error) => { console.error(error); process.exit(1); });
}
