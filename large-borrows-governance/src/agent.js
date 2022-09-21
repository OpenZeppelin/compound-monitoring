const {
  ethers, Finding, FindingSeverity, FindingType, getEthersProvider,
} = require('forta-agent');
const BigNumber = require('bignumber.js');
const config = require('../bot-config.json');
const cERC20Abi = require('../abi/CErc20.json');
const compAbi = require('../abi/CompERC20.json');
const governorAbi = require('../abi/GovernorBravo.json');

// set up a variable to hold initialization data used in the handler
const initializeData = {};

function createAlert(
  developerAbbreviation,
  protocolName,
  protocolAbbreviation,
  type,
  severity,
  governanceLevel,
  borrowerAddress,
  minCOMPNeeded,
  currCOMPOwned,
) {
  return Finding.fromObject({
    name: `${protocolName} Governance Threshold Alert`,
    description: `The address ${borrowerAddress} has borrowed and accrued enough COMP token to pass`
      + `the minimum threshold for the governance event: ${governanceLevel}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-THRESHOLD`,
    type: FindingType[type],
    severity: FindingSeverity[severity],
    protocol: protocolName,
    metadata: {
      borrowerAddress,
      governanceLevel,
      minCOMPNeeded,
      currCOMPOwned,
    },
  });
}

function provideInitialize(data) {
  return async function initialize() {
    const {
      developerAbbreviation,
      protocolName,
      protocolAbbreviation,
      cCOMPAddress,
      COMPAddress,
      governorAddress,
      borrowLevels,
    } = config;

    // quick sanity check on config fields
    if (developerAbbreviation === '' || developerAbbreviation === undefined
        || protocolName === '' || protocolName === undefined
        || protocolAbbreviation === '' || protocolAbbreviation === undefined
        || cCOMPAddress === '' || cCOMPAddress === undefined
        || COMPAddress === '' || COMPAddress === undefined
        || governorAddress === '' || governorAddress === undefined
        || Object.keys(borrowLevels).length === 0) {
      throw new Error('Required config fields are empty or undefined');
    }

    // using the CErc20 ABI, get the signature for the Borrow event
    const iface = new ethers.utils.Interface(cERC20Abi);
    const borrowEvent = iface.getEvent('Borrow').format(ethers.utils.FormatTypes.full);

    // get the provider from the forta-agent SDK and create a contract instance for the COMP token
    const provider = getEthersProvider();
    const compContract = new ethers.Contract(COMPAddress, compAbi, provider);
    // get the number of decimals for the COMP token
    let compDecimals = await compContract.decimals();
    // convert to bignumber.js
    compDecimals = new BigNumber(compDecimals.toString());
    compDecimals = new BigNumber(10).pow(compDecimals);

    // create a contract instance for the Governor contract
    const governorContract = new ethers.Contract(governorAddress, governorAbi, provider);

    // get proposalThreshold and quorumVotes from Governor Bravo contract
    let minProposalVotes = await governorContract.proposalThreshold();
    minProposalVotes = new BigNumber(minProposalVotes.toString()).div(compDecimals);
    let minQuorumVotes = await governorContract.quorumVotes();
    minQuorumVotes = new BigNumber(minQuorumVotes.toString()).div(compDecimals);

    /* eslint-disable no-param-reassign */
    data.voteMinimums = {
      proposal: minProposalVotes,
      votingQuorum: minQuorumVotes,
    };
    data.developerAbbreviation = developerAbbreviation;
    data.protocolName = protocolName;
    data.protocolAbbreviation = protocolAbbreviation;
    data.cCOMPAddress = cCOMPAddress;
    data.borrowEvent = borrowEvent;
    data.borrowLevels = borrowLevels;
    data.contract = compContract;
    data.decimalsExp = compDecimals;
    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      developerAbbreviation,
      protocolName,
      protocolAbbreviation,
      cCOMPAddress,
      borrowEvent,
      borrowLevels,
      contract,
      decimalsExp,
      voteMinimums,
    } = data;

    const parsedLogs = txEvent.filterLog(borrowEvent, cCOMPAddress);
    const promises = parsedLogs.map(async (log) => {
      // check to see how much COMP the address that borrowed has now
      const borrowerAddress = log.args.borrower;
      let userCOMPBalance = await contract.balanceOf(borrowerAddress);
      // convert to bignumber.js and divide by COMP decimals
      userCOMPBalance = new BigNumber(userCOMPBalance.toString()).div(decimalsExp);

      // iterate over the borrow levels to see if any meaningful thresholds have been crossed
      let findings = Object.keys(borrowLevels).map((levelName) => {
        const { type, severity } = borrowLevels[levelName];
        // if the borrowLevel name matches "proposal" or "votingQuorum", use that defined minCOMP
        const minAmountCOMP = voteMinimums[levelName];
        if (minAmountCOMP !== undefined && userCOMPBalance.gte(minAmountCOMP)) {
          // a governance threshold has been crossed, generate an alert
          return createAlert(
            developerAbbreviation,
            protocolName,
            protocolAbbreviation,
            type,
            severity,
            levelName,
            borrowerAddress,
            minAmountCOMP.toString(),
            userCOMPBalance.toString(),
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
