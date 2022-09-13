const BigNumber = require('bignumber.js');
const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');

const { getAbi } = require('./utils');

// load any bot configuration parameters
const config = require('../bot-config.json');

// set up a variable to hold initialization data used in the handler
const initializeData = {};

// helper function to create distribution alerts
function createExceedsSaneDistributionAlert(
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  maximumSaneDistributionAmount,
  compToken,
  maliciousAddress,
  compDelta,
  compIndex,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Exceeds Sane Distribution Event`,
    description: `Distribution of ${compDelta} COMP to ${maliciousAddress} exceeds ${maximumSaneDistributionAmount}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-EXCEEDS-SANE-DISTRIBUTION-EVENT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    addresses: [
      compToken,
      maliciousAddress,
    ],
    metadata: {
      compDelta,
      compIndex,
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

    data.maximumSaneDistributionAmount = config.maximumSaneDistributionAmount;

    data.provider = getEthersProvider();

    const {
      Comptroller: comptroller,
      CompoundToken: compoundToken,
    } = config.contracts;

    // from the Comptroller contract
    const comptrollerAbi = getAbi(comptroller.abiFile);
    const comptrollerAddress = comptroller.address.toLowerCase();

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
    const compoundTokenAddress = compoundToken.address.toLowerCase();
    const compoundTokenContract = new ethers.Contract(
      compoundTokenAddress,
      decimalsAbi,
      data.provider,
    );
    const compoundTokenDecimals = await compoundTokenContract.decimals();

    data.compoundTokenDecimalsMultiplier = new BigNumber(10).pow(
      compoundTokenDecimals.toString(),
    );
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      compoundTokenDecimalsMultiplier,
      comptrollerContract,
      comptrollerAddress,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      maximumSaneDistributionAmount,
      distributionSignatures,
    } = data;

    if (!comptrollerContract) throw new Error('handleTransaction called before initialization');
    const findings = [];

    // if no events found for distributing COMP, return
    const distributionEvents = txEvent.filterLog(
      distributionSignatures,
      comptrollerAddress,
    );

    await Promise.all(distributionEvents.map(async (distributionEvent) => {
      const amountCompDistributedBN = new BigNumber(
        distributionEvent.args.compDelta.toString(),
      ).div(compoundTokenDecimalsMultiplier);

      let maliciousAddress;
      let compIndex;
      if (distributionEvent.name === 'DistributedBorrowerComp') {
        maliciousAddress = distributionEvent.args.borrower;
        compIndex = distributionEvent.args.compBorrowIndex;
      } else if (distributionEvent.name === 'DistributedSupplierComp') {
        maliciousAddress = distributionEvent.args.supplier;
        compIndex = distributionEvent.args.compSupplyIndex;
      }

      // check against a maximum "sane" distribution amount of COMP
      //  and alert then even if the previous is zero
      if (amountCompDistributedBN.gt(maximumSaneDistributionAmount)) {
        findings.push(createExceedsSaneDistributionAlert(
          protocolName,
          protocolAbbreviation,
          developerAbbreviation,
          maximumSaneDistributionAmount,
          distributionEvent.args.cToken,
          maliciousAddress,
          amountCompDistributedBN.toString(),
          compIndex.toString(),
        ));
      }
    }));
    console.log(JSON.stringify(findings, null, 2));
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  createExceedsSaneDistributionAlert,
};
