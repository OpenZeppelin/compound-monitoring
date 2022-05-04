const BigNumber = require('bignumber.js');
const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');

const { getAbi } = require('./utils');

// load any agent configuration parameters
const config = require('../agent-config.json');

const ERC20_TRANSFER_EVENT = 'event Transfer(address indexed from, address indexed to, uint256 value)';

// set up a variable to hold initialization data used in the handler
const initializeData = {};

// helper function to create distribution alerts
function createExceedsRatioThresholdDistributionAlert(
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  accruedToDistributedRatio,
  receiver,
  compDistributed,
  compAccrued,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Exceeds Ratio Threshold Distribution Event`,
    description: `Distributed ${accruedToDistributedRatio.toFixed(0)}% more COMP to ${receiver} than expected`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-EXCEEDS-RATIO-THRESHOLD-DISTRIBUTION-EVENT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      receiver,
      compDistributed,
      compAccrued,
    },
  });
  return finding;
}

// helper function to create distribution alerts
function createExceedsSaneDistributionAlert(
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  maximumSaneDistributionAmount,
  receiver,
  compDistributed,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Exceeds Sane Distribution Event`,
    description: `Distribution of ${compDistributed} COMP to ${receiver} exceeds ${maximumSaneDistributionAmount}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-EXCEEDS-SANE-DISTRIBUTION-EVENT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      receiver,
      compDistributed,
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

    data.distributionThresholdPercent = config.distributionThresholdPercent;
    data.minimumDistributionAmount = config.minimumDistributionAmount;
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
      compoundTokenAddress, decimalsAbi, data.provider,
    );
    const compoundTokenDecimals = await compoundTokenContract.decimals();

    data.compoundTokenDecimalsMultiplier = new BigNumber(10).pow(
      compoundTokenDecimals.toString(),
    );
    data.compoundTokenAddress = compoundTokenAddress;
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      compoundTokenAddress,
      compoundTokenDecimalsMultiplier,
      comptrollerContract,
      comptrollerAddress,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      distributionThresholdPercent,
      minimumDistributionAmount,
      maximumSaneDistributionAmount,
      distributionSignatures,
    } = data;

    if (!comptrollerContract) throw new Error('handleTransaction called before initialization');
    const findings = [];

    // if no events found for distributing COMP, return
    const compDistributedEvents = txEvent.filterLog(
      distributionSignatures,
      comptrollerAddress,
    );

    if (!compDistributedEvents.length) return findings;
    // determine how much COMP distributed using Transfer event
    const transferEvents = txEvent.filterLog(ERC20_TRANSFER_EVENT, compoundTokenAddress).filter(
      (transferEvent) => transferEvent.args.from.toLowerCase() === comptrollerAddress,
    );
    await Promise.all(transferEvents.map(async (transferEvent) => {
      const amountCompDistributedBN = new BigNumber(transferEvent.args.value.toString()).div(
        compoundTokenDecimalsMultiplier,
      );

      // if we don't reach the minimum threshold for distributed COMP
      //  do not bother calculating the ratio to the previous accrued amount
      if (amountCompDistributedBN.gt(minimumDistributionAmount)) {
        // determine Comptroller.compAccrued() in previous block
        const { blockNumber } = txEvent;
        const prevBlockCompAccrued = await comptrollerContract.compAccrued(
          transferEvent.args.to, { blockTag: blockNumber - 1 },
        );
        const prevBlockCompAccruedBN = new BigNumber(prevBlockCompAccrued.toString()).div(
          compoundTokenDecimalsMultiplier,
        );

        // calculate ratio of accrued to distributed COMP
        const accruedToDistributedRatio = amountCompDistributedBN.div(
          prevBlockCompAccruedBN,
        ).times(100);

        // check against a maximum "sane" distribution amount of COMP
        //  and alert then even if the previous is zero?
        if (amountCompDistributedBN.gt(maximumSaneDistributionAmount)) {
          findings.push(createExceedsSaneDistributionAlert(
            protocolName,
            protocolAbbreviation,
            developerAbbreviation,
            maximumSaneDistributionAmount,
            transferEvent.args.to,
            amountCompDistributedBN.toString(),
          ));
        } else if (!prevBlockCompAccruedBN.isZero()
          && accruedToDistributedRatio.gt(distributionThresholdPercent)) {
          // if the previous accrual is zero our heuristic of using the ratio will not work
          //  otherwise if the ratio of between the previous accrued amount to the distribution
          //  amount exceeds the threshold report a finding
          findings.push(createExceedsRatioThresholdDistributionAlert(
            protocolName,
            protocolAbbreviation,
            developerAbbreviation,
            accruedToDistributedRatio,
            transferEvent.args.to,
            amountCompDistributedBN.toString(),
            prevBlockCompAccruedBN.toString(),
          ));
        }
      }
    }));

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  createExceedsRatioThresholdDistributionAlert,
  createExceedsSaneDistributionAlert,
};
