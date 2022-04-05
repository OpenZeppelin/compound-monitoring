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

    const sigTypeFull = ethers.utils.FormatTypes.full;
    const { contracts } = config;
    data.contractsInfo = Object.entries(contracts).map(([name, entry]) => {
      const { events: eventNames, address, abiFile } = entry;
      const file = utils.getAbi(abiFile);
      const contractInterface = new ethers.utils.Interface(file.abi);
      const eventSignatures = eventNames.map((eventName) => {
        const signature = contractInterface.getEvent(eventName).format(sigTypeFull);
        return signature;
      });

      const contract = {
        name,
        eventSignatures,
        eventNames,
      };

      return contract;
    });
    data.multisigAddress = config.contracts.multisig.address;
    data.governanceAddress = config.contracts.governance.address;
    data.comptrollerAddress = config.contracts.comptroller.address;
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
      governanceAddress,
      comptrollerAddress,
    } = data;

    const findings = [];
    // filter for transactions involving the multisig address
    const txAddrs = Object.keys(txEvent.addresses).map((address) => address.toLowerCase());

    // if the multisig was involed in a transaction, find out specifically which one
    if (txAddrs.includes(multisigAddress)) {
      contractsInfo.forEach((contract) => {
        // get all tranasaction events from the multisig wallet
        const parsedLogs = txEvent.filterLog(contract.eventSignatures, multisigAddress);

        // case if interaction is with gnosis wallet (add/remove owner)
        parsedLogs.forEach((log) => {
          const finding = utils.createGnosisFinding(
            log,
            protocolName,
            protocolAbbreviation,
            developerAbbreviation,
          );
          findings.push(finding);
        });

        if (txEvent.to === governanceAddress) {
          // check for governance interaction
          // check what governance event was emited
          parsedLogs.forEach((log) => {
            const finding = utils.createGovernanceFinding(
              log,
              protocolName,
              protocolAbbreviation,
              developerAbbreviation,
            );
            findings.push(finding);
          });
        }

        if (txEvent.to === comptrollerAddress) {
          // check for comptroller interaction
          // check what comptroller event was emiiter
          parsedLogs.forEach((log) => {
            const finding = utils.createComptrollerFinding(
              log,
              protocolName,
              protocolAbbreviation,
              developerAbbreviation,
            );
            findings.push(finding);
          });
        }
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
