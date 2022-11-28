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
  // get all the signed transactions from the api
  const { body } = autotaskEvent.request; // get json-parsed POST body
  /*
    voting object
    {
        "address": "string",
        "proposalId": 0,
        "support": 0,
        "v": "string",
        "r": "string",
        "s": "string"
    }

    delegate object
    {
        "address": "string",
        "delegatee": "string",
        "nonce": 0,
        "expiry": 0,
        "v": "string",
        "r": "string",
        "s": "string"
    }
    */
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
    if (votes.delegatee) {
      const {
        address, delegatee, nonce, expiry, v, r, s,
      } = votes;
      // delegate vote on-chain
      console.debug(`Delgating votes from ${address} to ${delegatee}`);
      await compTokenContract.delegateBySig(delegatee, nonce, expiry, v, r, s);
    } else if (votes.support) {
      // cast vote on-chain
      // 'function castVoteBySig(uint proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s)',
      await governanceContract.castVoteBySig();
    } else {
      throw new Error('Action is not a vote or delgate-vote');
    }
  });
  await Promise.all(promises);
};
