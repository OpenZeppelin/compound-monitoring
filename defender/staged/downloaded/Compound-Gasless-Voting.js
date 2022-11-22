const ethers = require('ethers');

const { DefenderRelayProvider, DefenderRelaySigner } = require('defender-relay-client/lib/ethers');

const compoundGovernanceAddress = '0xc0Da02939E1441F497fd74F78cE7Decb17B66529'; // GovernorBravoDelegate.sol
const compTokenAddress = '0xc00e94Cb662C3520282E6f5717214004A7f26888' // Comp.sol

const compoundGovernanceAbi = [
    'function castVoteBySig(uint proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s)',
];

const compTokenAbi = [
    `function delegateBySig(address delegatee, uint nonce, uint expiry, uint8 v, bytes32 r, bytes32 s)`
]

exports.handler = async function handler(autotaskEvent) {
    // get all the signed transactions from the api
    // filler object for now
    let apiObject = {
        "address": "string",
        "delegatee": "string",
        "nonce": 0,
        "expiry": 0,
        "v": "string",
        "r": "string",
        "s": "string"
    } 

    // voting object - filler for now
    /*
    {
        "address": "string",
        "proposalId": 0,
        "support": 0,
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

    // invoke transactions on chain by calling the appropriate Compound smart contract
    // if it's a vote, call the `castVoteBySig()` function on the GovernorBravoDelegate.sol contract
    
    if (apiObject.delegatee) {
        // delegate vote on-chain
        await compTokenContract.delegateBySig()
        
    } else {
        // cast vote on-chain
        await governanceContract.castVoteBySig()
    }
    
    // if it's a delegate, call the `delegateBySig()` function on the Comp.sol contract
}