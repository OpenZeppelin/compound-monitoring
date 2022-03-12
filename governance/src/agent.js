const { ethers } = require('forta-agent');

const { createGovernanceFindings } = require('./governance');

// load any agent configuration parameters
const config = require('../agent-config.json');

function getAbi(abiName) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const { abi } = require(`../abi/${abiName}`);
  return abi;
}

// set up a variable to hold initialization data used in the handler
const initializeData = {};

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // assign configurable fields
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    const sigTypeFull = ethers.utils.FormatTypes.full;

    const { governance } = config;

    // GovernorBravo contract
    const governorBravoAbi = getAbi(governance.abiFile);
    const governorBravoInterface = new ethers.utils.Interface(governorBravoAbi);
    const { events: governorBravoEvents, address } = governance;
    data.governorBravoAddress = address;
    data.governorBravoInfo = governorBravoEvents.map((eventName) => {
      const signature = governorBravoInterface.getEvent(eventName).format(sigTypeFull);
      return signature;
    });
    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      governorBravoInfo,
      governorBravoAddress,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    } = data;

    if (!governorBravoInfo) throw new Error('handleTransaction called before initialization');

    const findings = [];

    // check GovernorBravo contract
    governorBravoInfo.forEach((signature) => {
      // filter down to only the events we want to alert on
      const parsedLogs = txEvent.filterLog(signature, governorBravoAddress);

      const configFields = {
        developerAbbreviation,
        protocolName,
        protocolAbbreviation,
      };
      const results = createGovernanceFindings(parsedLogs, governorBravoAddress, configFields);
      findings.push(...results);
    });
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  getAbi,
};
