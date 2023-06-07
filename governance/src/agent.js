const { ethers } = require('forta-agent');

const { createGovernanceFindings } = require('./governance');

// load any bot configuration parameters
const config = require('../bot-config.json');

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
    data.governorBravoInterface = new ethers.utils.Interface(governorBravoAbi);
    const { events: governorBravoEvents, address } = governance;
    data.governorBravoAddress = address;
    data.governorBravoInfo = governorBravoEvents.map((eventName) => {
      const signature = data.governorBravoInterface.getEvent(eventName).format(sigTypeFull);
      return signature;
    });

    // track proposals
    data.proposals = {};

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
      proposals,
    } = data;

    if (!governorBravoInfo) throw new Error('handleTransaction called before initialization');

    // check GovernorBravo contract
    // filter down to only the events we want to alert on
    const parsedLogs = txEvent.filterLog(governorBravoInfo, governorBravoAddress);

    const configFields = {
      developerAbbreviation,
      protocolName,
      protocolAbbreviation,
      proposals,
    };
    const findings = await createGovernanceFindings(parsedLogs, governorBravoAddress, configFields);
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
