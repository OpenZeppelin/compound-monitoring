const ethers = require('ethers');

const { DefenderRelayProvider, DefenderRelaySigner } = require('defender-relay-client/lib/ethers');

const compoundGovernanceAddress = '0xc0Da02939E1441F497fd74F78cE7Decb17B66529'; // GovernorBravoDelegate.sol

const compTokenAddress = '0xc00e94Cb662C3520282E6f5717214004A7f26888'; // Comp.sol

const compoundGovernanceAbi = [
  'function castVoteBySig(uint proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s)',
  'function state(uint256 proposalId) view returns (uint8)',
];

const compTokenAbi = [
  'function delegateBySig(address delegatee, uint nonce, uint expiry, uint8 v, bytes32 r, bytes32 s)',
  'function balanceOf(address account) external view returns (uint)',
  'function getCurrentVotes(address account) external view returns (uint96)',
];

exports.handler = async function handler(autotaskEvent) {
  if (autotaskEvent.request === undefined) {
    throw new Error('POST request information not found');
  }
  // body contains batch of signed messages to submit on-chain through the Defender Relayer
  // the api endpoint does most of the validation checking for us already
  // (ex. checks for valid signatures and all required fields)
  // https://app.swaggerhub.com/apis-docs/arr00/COMP.vote/1.0#/
  const { body } = autotaskEvent.request;

  if (Array.isArray(body) === false) {
    throw new Error('Request body must be an Array');
  }

  // initiate a new relay provider
  console.debug('Creating DefenderRelayProvider');
  const provider = new DefenderRelayProvider(autotaskEvent);

  // initiate a new relay signer
  console.debug('Creating DefenderRelaySigner');
  const signer = new DefenderRelaySigner(autotaskEvent, provider, { speed: 'fast' });

  // Test relay and check for balance
  let relayAddress;
  try {
    relayAddress = await signer.getAddress();
  } catch (error) {
    console.error('Relay is not working, check if it is connected : ', error);
    throw error;
  }

  const relayBalance = await provider.getBalance(relayAddress);
  if (relayBalance <= 0) {
    throw new Error('Insufficient funds for Relay, please deposit funds.');
  }

  // create an ethers.js Contract Object to interact with the on-chain governance smart contract
  console.debug('Creating governanceContract');
  const governanceContract = new ethers.Contract(
    compoundGovernanceAddress,
    compoundGovernanceAbi,
    signer,
  );

  // create an ethers.js Contract Object to interact with the on-chain COMP smart contract
  console.debug('Creating compContract');
  const compTokenContract = new ethers.Contract(
    compTokenAddress,
    compTokenAbi,
    signer,
  );

  // if any transactions fail, set this to false
  let resultOutcome = true;

  // cast vote or delegate vote on-chain
  const promises = body.map(async (votes) => {
    if (votes.delegatee !== undefined) {
      const {
        address, delegatee, nonce, expiry, v, r, s,
      } = votes;

      // check if address has votes to delegate
      const delegateCompBalance = await compTokenContract.balanceOf(address);
      if (delegateCompBalance > 0) {
        // delegate vote on-chain
        console.debug(`Delegating votes from ${address} to ${delegatee}`);
        await compTokenContract.delegateBySig(delegatee, nonce, expiry, v, r, s);
      }
    } else if (votes.support !== undefined) {
      const {
        address, proposalId, support, v, r, s,
      } = votes;

      // check if address has enough delegated votes to submit a vote
      // check if proposal is active - only active proposals can be voted on
      const addressDelegatedVotes = await compTokenContract.getCurrentVotes(address);
      const state = await governanceContract.state(proposalId);
      if (addressDelegatedVotes > 0 && state === 1) {
        if (support === 0) {
          console.debug(`Address ${address} is casting a vote in favor of proposal ID: ${proposalId}`);
        } else if (support === 1) {
          console.debug(`Address ${address} is casting a vote against proposal ID: ${proposalId}`);
        } else if (support === 2) {
          console.debug(`Address ${address} is casting a vote to abstain for proposal ID: ${proposalId}`);
        }
        // cast vote on-chain
        await governanceContract.castVoteBySig(proposalId, support, v, r, s);
      }
    } else {
      // error is not thrown to prevent one failed transaction from failing the rest in the batch
      resultOutcome = false;
      console.error('Action is not a vote or delgate-vote');
    }
  });

  // filter through for failed transactions
  // log out reason for each failure
  let results = await Promise.allSettled(promises);

  results = results.filter((result) => result.status === 'rejected');
  if (results.length > 0) {
    resultOutcome = false;
    results.forEach((result) => {
      console.error(result.reason);
    });
  }

  // if false, at least one transaction has failed
  return resultOutcome;
};
