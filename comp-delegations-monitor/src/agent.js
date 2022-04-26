// monitor for when more than an amount of COMP is delegated that puts the delagatee over an important threshold
// use handlTransaction() to track delegate events
// if the delegate event puts someone over an important threshold, then trigger an alert
/// @notice An event thats emitted when an account changes its delegate
// event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate); - this is the event we want

const {
  ethers, Finding, FindingSeverity, FindingType, getEthersProvider,
} = require('forta-agent');

const BigNumber = require('bignumber.js');

const config = require('../agent-config.json')

function getAbi(fileName) {
  const abi = require(`../abi/${fileName}`);
  return abi;
}

// set up a variable to hold initialization data used in the handler
const initializeData = {};

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    data.developerAbbreviation = config.developerAbbreviation;
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.COMPAddress = config.COMPAddress;
    data.governorAddress = config.governorAddress;
    data.CompERC20Abi = config.CompERC20Abi;
    data.GovernorBravoAbi = config.GovernorBravoAbi;

    // get provider
    const provider = getEthersProvider();

    const compERC20Abi = getAbi(data.CompERC20Abi);
    const compContract = new ethers.Contract(data.COMPAddress, compERC20Abi, provider)
    const formatType = ethers.utils.FormatTypes.full;

    // use CErc20 abi to get signature for DelegateVotesChanged event
    const iface = new ethers.utils.Interface(compERC20Abi);
    const delegateChangedEvent = iface.getEvent('DelegateChanged').format(formatType);

    // get the number of decimals for the COMP token
    let compDecimals = await compContract.decimals();
    // convert to bignumber.js
    compDecimals = new BigNumber(compDecimals.toString());
    compDecimals = new BigNumber(10).pow(compDecimals);

    // get governor bravo abi and create gov bravo contract
    const govBravoAbi = getAbi(data.GovernorBravoAbi);
    const govBravoContract = new ethers.Contract(data.governorAddress, govBravoAbi, provider);

    // query for min threshold with from gov bravo contract
    let minProposalVotes = await govBravoContract.proposalThreshold();
    minProposalVotes = new BigNumber(minProposalVotes.toString()).div(compDecimals);
    let minQuorumVotes = await govBravoContract.quorumVotes();
    minQuorumVotes = new BigNumber(minQuorumVotes.toString()).div(compDecimals);

    data.delegateChangedEvent = delegateChangedEvent;
    data.minProposalVotes = minProposalVotes;
    data.minQuorumVotes = minQuorumVotes;
    /* eslint-disable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {

  }
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};