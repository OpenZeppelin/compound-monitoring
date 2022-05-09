const { ethers } = require('forta-agent');

// load bot configuration parameters
const config = require('../bot-config.json');

// require utilities
const utils = require('./utils');

// set up variable to hold initialization data for use in the handler
const initializeData = {};

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */

    // get protocol and developer info
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    const sigTypeFull = ethers.utils.FormatTypes.full;

    // get contracts' abi and monitored event signatures
    const { contracts } = config;
    data.contractsInfo = Object.entries(contracts).map(([name, entry]) => {
      const { events: eventNames, address, abiFile } = entry;
      const file = utils.getAbi(abiFile);
      const contractInterface = new ethers.utils.Interface(file.abi);
      const eventSignatures = eventNames.map((eventName) => {
        const signature = contractInterface.getEvent(eventName).format(sigTypeFull);
        return signature;
      });

      // determine which create finding function to use
      let createFinding;

      if (address === contracts.multisig.address) {
        createFinding = utils.createGnosisFinding;
      } else if (address === contracts.governance.address) {
        createFinding = utils.createGovernanceFinding;
      } else if (address === contracts.comptroller.address) {
        createFinding = utils.createComptrollerFinding;
      }

      // create object to store and return necessary contract information
      const contract = {
        createFinding,
        address,
        name,
        eventSignatures,
        eventNames,
      };

      return contract;
    });

    // get contract address of multisig wallet
    data.multisigAddress = config.contracts.multisig.address.toLowerCase();
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      contractsInfo,
      multisigAddress,
    } = data;

    const findings = [];

    // filter for transactions involving the multisig address
    const txAddrs = Object.keys(txEvent.addresses).map((address) => address.toLowerCase());

    // if the multisig was involved in a transaction, find out specifically which one
    if (txAddrs.indexOf(multisigAddress) !== -1) {
      contractsInfo.forEach((contract) => {
        // filter for which event and address the multisig transaction was involved in
        const parsedLogs = txEvent.filterLog(contract.eventSignatures, contract.address);

        parsedLogs.forEach((log) => {
          const finding = contract.createFinding(
            log,
            protocolName,
            protocolAbbreviation,
            developerAbbreviation,
          );
          findings.push(finding);
        });
      });
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
