/* eslint-disable global-require */
const {
  ethers, Finding, FindingSeverity, FindingType, getEthersProvider,
} = require('forta-agent');

const BigNumber = require('bignumber.js');

const config = require('../bot-config.json');

function getAbi(fileName) {
  // eslint-disable-next-line import/no-dynamic-require
  const abi = require(`../abi/${fileName}`);
  return abi;
}

function createAlert(
  developerAbbreviation,
  protocolName,
  protocolAbbreviation,
  type,
  severity,
  levelName,
  delegateAddress,
  minAmountCOMP,
  delegateCOMPBalance,
) {
  return Finding.fromObject({
    name: `${protocolName} Governance Delegate Threshold Alert`,
    description: `The address ${delegateAddress} has been delegated enough COMP token to pass `
      + `the minimum threshold for the governance event: ${levelName}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-DELEGATE-THRESHOLD`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
    protocol: protocolName,
    metadata: {
      delegateAddress,
      levelName,
      minAmountCOMP,
      delegateCOMPBalance,
    },
  });
}

// set up a variable to hold initialization data used in the handler
const initializeData = {};

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    const { compERC20, governorBravo, delegateLevels } = config;
    data.developerAbbreviation = config.developerAbbreviation;
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.compAddress = compERC20.address;

    // get provider
    const provider = getEthersProvider();

    // get COMP token Abi to create contract and interface
    const compERC20Abi = getAbi(compERC20.abi);
    const compContract = new ethers.Contract(data.compAddress, compERC20Abi, provider);
    const formatType = ethers.utils.FormatTypes.full;

    // use CErc20 abi to get signature for DelegateVotesChanged event
    const iface = new ethers.utils.Interface(compERC20Abi);
    const delegateVotesChangedEvent = iface.getEvent('DelegateVotesChanged').format(formatType);

    // get the number of decimals for the COMP token
    let compDecimals = await compContract.decimals();
    compDecimals = new BigNumber(10).pow(compDecimals.toString()); // convert to bignumber.js

    // get governor bravo Abi and create gov bravo contract
    const govBravoAbi = getAbi(governorBravo.abi);
    const govBravoContract = new ethers.Contract(governorBravo.address, govBravoAbi, provider);

    // query for min threshold from gov bravo contract
    let minProposalVotes = await govBravoContract.proposalThreshold();
    minProposalVotes = new BigNumber(minProposalVotes.toString()).div(compDecimals);
    let minQuorumVotes = await govBravoContract.quorumVotes();
    minQuorumVotes = new BigNumber(minQuorumVotes.toString()).div(compDecimals);

    data.voteMinimums = {
      proposal: minProposalVotes,
      votingQuorum: minQuorumVotes,
    };

    data.delegateVotesChangedEvent = delegateVotesChangedEvent;
    data.compContract = compContract;
    data.compDecimals = compDecimals;
    data.delegateLevels = delegateLevels;
    /* eslint-disable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      developerAbbreviation,
      protocolName,
      protocolAbbreviation,
      compAddress,
      compContract,
      compDecimals,
      delegateVotesChangedEvent,
      voteMinimums,
      delegateLevels,
    } = data;

    const parsedLogs = txEvent.filterLog(delegateVotesChangedEvent, compAddress);
    const promises = parsedLogs.map(async (log) => {
      // check to see how much COMP the delegate address has now
      const delegateAddress = log.args.delegate;
      let delegateCOMPBalance = await compContract.balanceOf(delegateAddress);
      // convert to bignumber.js and divide by COMP decimals
      delegateCOMPBalance = new BigNumber(delegateCOMPBalance.toString()).div(compDecimals);
      // iterate over the delegate levels to see if any meaningful thresholds have been crossed
      let findings = Object.keys(delegateLevels).map((levelName) => {
        const { type, severity } = delegateLevels[levelName];
        // check if delegate COMP balance is higher than "proposal" or "votingQuorum" levels
        const minAmountCOMP = voteMinimums[levelName];
        if (minAmountCOMP !== undefined && delegateCOMPBalance.gte(minAmountCOMP)) {
          // create alert if threshold is crossed
          return createAlert(
            developerAbbreviation,
            protocolName,
            protocolAbbreviation,
            type,
            severity,
            levelName,
            delegateAddress,
            minAmountCOMP.toString(),
            delegateCOMPBalance.toString(),
          );
        }

        return undefined;
      });

      // filter out any empty object findings
      findings = findings.filter((finding) => finding !== undefined);

      return findings;
    });

    const findings = (await Promise.all(promises)).flat();
    console.log(JSON.stringify(findings, null, 2));
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};
