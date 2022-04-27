// monitor for when more than an amount of COMP is delegated that puts the delagatee over an important threshold
// use handlTransaction() to track delegate events
// if the delegate event puts someone over an important threshold, then trigger an alert
/// @notice An event thats emitted when a delegate account's vote balance changes
// event DelegateVotesChanged(address indexed delegate, uint previousBalance, uint newBalance);

const {
  ethers, Finding, FindingSeverity, FindingType, getEthersProvider,
} = require('forta-agent');

const BigNumber = require('bignumber.js');

const config = require('../agent-config.json');

function getAbi(fileName) {
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
    description: `The address ${delegateAddress} has been delegated enough COMP token to pass`
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
    const { compERC20, governorBravo, delegateLevels } = config
    data.developerAbbreviation = config.developerAbbreviation;
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.COMPAddress = compERC20.address;
    data.CompERC20Abi = compERC20.abi;
    data.governorAddress = governorBravo.address;
    data.GovernorBravoAbi = governorBravo.abi;

    // get provider
    const provider = getEthersProvider();

    const compERC20Abi = getAbi(data.CompERC20Abi);
    const compContract = new ethers.Contract(data.COMPAddress, compERC20Abi, provider);
    const formatType = ethers.utils.FormatTypes.full;

    // use CErc20 abi to get signature for DelegateVotesChanged event
    const iface = new ethers.utils.Interface(compERC20Abi);
    const delegateVotesChangedEvent = iface.getEvent('DelegateVotesChanged').format(formatType);

    // get the number of decimals for the COMP token
    let compDecimals = await compContract.decimals();
    // convert to bignumber.js
    compDecimals = new BigNumber(compDecimals.toString());
    compDecimals = new BigNumber(10).pow(compDecimals);

    // get governor bravo abi and create gov bravo contract
    const govBravoAbi = getAbi(data.GovernorBravoAbi);
    const govBravoContract = new ethers.Contract(data.governorAddress, govBravoAbi, provider);

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
      COMPAddress,
      delegateVotesChangedEvent,
      compContract,
      compDecimals,
      voteMinimums,
      delegateLevels,
    } = data;

    // const findings = []
    const parsedLogs = txEvent.filterLog(delegateVotesChangedEvent, COMPAddress);
    const promises = parsedLogs.map(async (log) => {
      // check to see how much COMP the address that borrowed has now
      const delegateAddress = log.args.delegate;
      let delegateCOMPBalance = await compContract.balanceOf(delegateAddress);
      // convert to bignumber.js and divide by COMP decimals
      delegateCOMPBalance = new BigNumber(delegateCOMPBalance.toString()).div(compDecimals);

      // iterate over the borrow levels to see if any meaningful thresholds have been crossed
      let findings = Object.keys(delegateLevels).map((levelName) => {
        const { type, severity } = delegateLevels[levelName];
        // if the borrowLevel name matches "proposal" or "votingQuorum", use that defined minCOMP
        const minAmountCOMP = voteMinimums[levelName];
        if (minAmountCOMP !== undefined && delegateCOMPBalance.gte(minAmountCOMP)) {
          // a governance threshold has been crossed, generate an alert
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
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};

/*
@notice The number of votes required in order for a voter to become a proposer
uint public proposalThreshold;

@notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
uint public constant quorumVotes = 400000e18; // 400,000 = 4% of Comp

*/