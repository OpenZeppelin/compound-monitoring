const {
  Finding, FindingSeverity, FindingType, ethers, getEthersBatchProvider,
} = require('forta-agent');

const {
  getAbi,
  extractEventArgs,
} = require('./utils');

// load any agent configuration parameters
const config = require('../agent-config.json');

// set up a variable to hold initialization data used in the handler
const initializeData = {};

// helper function to create cToken alerts
function createCTokenAlert(
  eventName,
  cTokenSymbol,
  contractAddress,
  eventType,
  eventSeverity,
  args,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const eventArgs = extractEventArgs(args);
  const finding = Finding.fromObject({
    name: `${protocolName} cToken Event`,
    description: `The ${eventName} event was emitted by the ${cTokenSymbol} cToken contract`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-CTOKEN-EVENT`,
    type: FindingType[eventType],
    severity: FindingSeverity[eventSeverity],
    protocol: protocolName,
    metadata: {
      cTokenSymbol,
      contractAddress,
      eventName,
      ...eventArgs,
    },
  });
  return finding;
}

function getEventInfo(iface, events, sigType) {
  const result = Object.entries(events).map(([eventName, entry]) => {
    const signature = iface.getEvent(eventName).format(sigType);
    return {
      name: eventName,
      signature,
      type: entry.type,
      severity: entry.severity,
    };
  });
  return result;
}

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // assign configurable fields
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    data.provider = getEthersBatchProvider();

    const {
      Comptroller: comptroller,
      cTokens,
    } = config.contracts;

    // from the Comptroller contract, get all of the cTokens
    const comptrollerAbi = getAbi(comptroller.abiFile);
    data.comptrollerContract = new ethers.Contract(
      comptroller.address,
      comptrollerAbi,
      data.provider,
    );

    // this looks like a hack, but it is necessary to be able to add new cToken addresses to the
    // Array in the handler.  If we do not create the data.cTokenAddresses Array this way and just
    // use the returned cTokenAddresses Object, we will be unable to push new elements into the
    // Array.  When ethers.js returns this Object, it has a read-only length property that prevents
    // the push from occurring.
    const cTokenAddresses = await data.comptrollerContract.getAllMarkets();
    data.cTokenAddresses = [...cTokenAddresses];

    const sigTypeFull = ethers.utils.FormatTypes.full;

    // cToken contracts
    // gather the event signatures, types, and severities for every event listed in the config file
    data.cTokenAbi = getAbi(cTokens.abiFile);
    const cTokenInterface = new ethers.utils.Interface(data.cTokenAbi);
    const { events: cTokenEvents } = cTokens;
    data.cTokenInfo = getEventInfo(cTokenInterface, cTokenEvents, sigTypeFull);

    // create ethers Contract Objects for all of the existing cTokens
    data.cTokenContracts = {};
    const promises = data.cTokenAddresses.map(async (address) => {
      const contract = new ethers.Contract(address, data.cTokenAbi, data.provider);
      const symbol = await contract.symbol();
      data.cTokenContracts[address] = {
        contract,
        symbol,
      };
    });
    await Promise.all(promises);
    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      cTokenAddresses,
      cTokenInfo,
      cTokenAbi,
      cTokenContracts,
      comptrollerContract,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    } = data;

    if (!cTokenInfo) throw new Error('handleTransaction called before initialization');

    const findings = [];

    // first check that no additional cTokens have been added
    const currentCTokenAddresses = await comptrollerContract.getAllMarkets();
    const unique = currentCTokenAddresses.filter((addr) => cTokenAddresses.indexOf(addr) === -1);
    cTokenAddresses.push(...unique);

    if (unique.length > 0) {
      // create ethers.js Contract Objects and add them to the Object of other Contract Objects
      const promises = unique.map(async (address) => {
        const contract = new ethers.Contract(address, cTokenAbi, data.provider);
        const symbol = await contract.symbol();
        cTokenContracts[address] = { contract, symbol };
      });
      await Promise.all(promises);
    }

    // check all cToken contracts
    cTokenInfo.forEach((eventInfo) => {
      const {
        name,
        signature,
        type,
        severity,
      } = eventInfo;

      // filter down to only the events we want to alert on
      const parsedLogs = txEvent.filterLog(signature, cTokenAddresses);

      parsedLogs.forEach((parsedLog) => {
        const { address } = parsedLog;
        const { symbol } = cTokenContracts[ethers.utils.getAddress(address)];
        findings.push(createCTokenAlert(
          name,
          symbol,
          parsedLog.address,
          type,
          severity,
          parsedLog.args,
          protocolName,
          protocolAbbreviation,
          developerAbbreviation,
        ));
      });
    });
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};
