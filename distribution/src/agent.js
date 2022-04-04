const BigNumber = require('bignumber.js');
const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');

const { getAbi } = require('./utils');

// load any agent configuration parameters
const config = require('../agent-config.json');

// set up a variable to hold initialization data used in the handler
const initializeData = {};

// because the Comptroller ABI has multiple overloaded functions, the ethers logger will show a
// bunch of warnings - since we aren't using any functions that are overloaded we can move the log
// level to only show errors
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

// helper function to create distribution alerts
function createDistributionAlert(
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  compAccruedDistribution,
  receiver,
  compDistributionThreshold,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Distribution Event`,
    description: `Distributed ${compAccruedDistribution.toFixed(0).toString()} COMP to ${receiver}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-LARGE-DISTRIBUTION-EVENT`,
    protocol: protocolName,
    type: FindingType.Suspicious,
    severity: FindingSeverity.High,
    metadata: {
      compAccruedDistribution,
      compDistributionThreshold,
      receiver,
    },
  });
  return finding;
}

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // assign configurable fields
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    data.compDistributionThreshold = config.compDistributionThreshold;

    data.provider = getEthersProvider();

    const {
      Comptroller: comptroller,
      CompoundToken: compToken,
    } = config.contracts;

    // from the Comptroller contract
    const comptrollerAbi = getAbi(comptroller.abiFile);
    const comptrollerAddress = comptroller.address;
    data.comptrollerAddress = comptrollerAddress;
    data.comptrollerContract = new ethers.Contract(
      comptrollerAddress,
      comptrollerAbi,
      data.provider,
    );

    const sigType = ethers.utils.FormatTypes.full;
    const iface = new ethers.utils.Interface(comptrollerAbi);
    data.distributionSignatures = [
      iface.getEvent('DistributedSupplierComp').format(sigType),
      iface.getEvent('DistributedBorrowerComp').format(sigType),
    ];

    const decimalsAbi = ['function decimals() view returns (uint8)'];
    const compAddress = compToken.address;
    const compContract = new ethers.Contract(compAddress, decimalsAbi, data.provider);
    const compDecimals = await compContract.decimals();
    data.compDecimalsMultiplier = new BigNumber(10).pow(compDecimals);
    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      comptrollerContract,
      comptrollerAddress,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      compDistributionThreshold,
      distributionSignatures,
      compDecimalsMultiplier,
    } = data;

    if (!comptrollerContract) throw new Error('handleTransaction called before initialization');

    const findings = [];

    // if no events found for distributing COMP, return
    const compDistributedEvents = txEvent.filterLog(
      distributionSignatures,
      comptrollerAddress,
    );

    // create Object to track COMP accrued over multiple events
    const compAccrued = {};
    compDistributedEvents.forEach(async (compDistributedEvent) => {
      // the two events we have filtered are
      //   DistributedSupplierComp
      //   DistributedBorrowerComp
      // for both of these events, the address of interest is the second argument
      // and the delta amount is the third argument
      const address = compDistributedEvent.args[1];
      const compDelta = compDistributedEvent.args[2];
      const compDeltaBN = new BigNumber(compDelta.toString());

      // accumulate the COMP accrued in this event
      if (compAccrued[address] === undefined) {
        compAccrued[address] = new BigNumber(0);
      }
      compAccrued[address] = compAccrued[address].plus(compDeltaBN);
    });

    // iterate over the entries to create findings
    Object.entries(compAccrued).forEach(([address, amount]) => {
      const accruedAmount = amount.div(compDecimalsMultiplier);
      if (accruedAmount.gt(compDistributionThreshold)) {
        // create finding
        findings.push(createDistributionAlert(
          protocolName,
          protocolAbbreviation,
          developerAbbreviation,
          accruedAmount,
          address,
          compDistributionThreshold,
        ));
      }
    });
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  createDistributionAlert,
};
