const ethers = require('ethers');

const { DefenderRelayProvider, DefenderRelaySigner } = require('defender-relay-client/lib/ethers');

const compoundGovernanceAddress = '0xc0Da02939E1441F497fd74F78cE7Decb17B66529'; // GovernorBravoDelegate.sol

const compTokenAddress = '0xc00e94Cb662C3520282E6f5717214004A7f26888'; // Comp.sol

const compoundGovernanceAbi = [
  'function castVoteBySig(uint proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s)',
];

const compTokenAbi = [
  'function delegateBySig(address delegatee, uint nonce, uint expiry, uint8 v, bytes32 r, bytes32 s)',
];

exports.handler = async function handler(autotaskEvent) {
  if (autotaskEvent.request === undefined) {
    throw new Error('POST request information not found');
  }
  // get batch of signed messages to submit on-chain through the Defender Relayer
  // the api endpoint does most of the validation checking for us already
  // (ex. checks for valid signatures)
  // https://app.swaggerhub.com/apis-docs/arr00/COMP.vote/1.0#/
  const { body } = autotaskEvent.request;

  if (Array.isArray(body) === false) {
    throw new Error('Request body must be an Array');
  }

  // initiate a new relay signer
  console.debug('Creating DefenderRelayProvider');
  const provider = new DefenderRelayProvider(autotaskEvent);

  console.debug('Creating DefenderRelaySigner');
  const signer = new DefenderRelaySigner(autotaskEvent, provider, { speed: 'fast' });

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

  // cast vote or delegate on-chain
  const promises = body.map(async (votes) => {
    if (votes.delegatee !== undefined) {
      const {
        address, delegatee, nonce, expiry, v, r, s,
      } = votes;

      // delegate vote on-chain
      console.debug(`Delgating votes from ${address} to ${delegatee}`);
      try {
        await compTokenContract.delegateBySig(delegatee, nonce, expiry, v, r, s);
      } catch (error) {
        console.error(error);
      }
    } else if (votes.support !== undefined) {
      const {
        address, proposalId, support, v, r, s,
      } = votes;
      if (support === 0) {
        console.debug(`Address ${address} is casting a vote in favor of proposal ID: ${proposalId}`);
      } else if (support === 1) {
        console.debug(`Address ${address} is casting a vote against proposal ID: ${proposalId}`);
      } else if (support === 2) {
        console.debug(`Address ${address} is casting a vote to abstain for proposal ID: ${proposalId}`);
      }

      // cast vote on-chain
      try {
        await governanceContract.castVoteBySig(proposalId, support, v, r, s);
      } catch (error) {
        console.error(error);
      }
    } else {
      // error is not throw to prevent one failed transaction from failing the rest in the batch
      console.error('Action is not a vote or delgate-vote');
    }
  });
  await Promise.all(promises);

  return true;
};
