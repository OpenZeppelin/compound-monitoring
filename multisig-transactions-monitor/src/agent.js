const {
  Finding, FindingSeverity, FindingType, ethers,
} = require('forta-agent');

// load agent configuration parameters
const config = require('../agent-config.json');

// require utilities
const utils = require('./utils');

// set up variable to hold initalization data for use in the handler
const initializeData = {};

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    const { multisig } = config;
    const { events: multisigEvents, multisigAddress, abiFile } = multisig;
    const sigTypeFull = ethers.utils.FormatTypes.full;

    // eslint-disable-next-line import/no-dynamic-require
    const multisigAbi = utils.getAbi(abiFile);

    data.multisigInterface = new ethers.utils.Interface(multisigAbi);
    data.eventSignatures = multisigEvents.map((eventName) => {
      const signature = data.multisigInterface.getEvent(eventName).format(sigTypeFull);
      return signature;
    });

    data.multisigAddress = multisigAddress;
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      eventSignatures,
      multisigAddress,
    } = data;

    const findings = [];
    // get all addresses involved in the transaction
    // alert if the multisig address is involved
    const txAddrs = Object.keys(txEvent.addresses).map((address) => address.toLowerCase());

    // filter txEvent to narrow down to only transactions from (or to?) the multisig
    const parsedLogs = txEvent.filterLog(eventSignatures, multisigAddress);

    // create finding based on what event was emitted
    parsedLogs.forEach((log) => {
      const finding = utils.createFinding(
        log,
        protocolName,
        protocolAbbreviation,
        developerAbbreviation,
      );
      findings.push(finding);
    });

    // create a finding if the multisig was involved in any transaction
    if (txAddrs.includes(multisigAddress)) {
      const finding = Finding.fromObject({
        name: `${protocolName} Multisig Transaction Alert`,
        description: `Mulitsig address ${multisigAddress} was involved in a transaction`,
        alertId: `${developerAbbreviation}-${protocolAbbreviation}-MULTISIG-TRANSACTION-ALERT`,
        type: FindingType.Info,
        severity: FindingSeverity.Info,
      });
      findings.push(finding);
    }

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};
