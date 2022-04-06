const BigNumber = require('bignumber.js');
const {
  Finding, FindingSeverity, FindingType, ethers, getEthersProvider,
} = require('forta-agent');

const { getAbi } = require('./utils');

// load any agent configuration parameters
const config = require('../agent-config.json');

const ERC20_TRANSFER_EVENT = "event Transfer(address indexed from, address indexed to, uint256 value)";

// set up a variable to hold initialization data used in the handler
const initializeData = {};

// helper function to create distribution alerts
function createDistributionAlert(
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  accruedToDistributedRatio,
  receiver,
  compDistributed,
  compAccrued,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Distribution Event`,
    description: `Distributed ${accruedToDistributedRatio.toFixed(0)}% more COMP to ${receiver} than expected`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-DISTRIBUTION-EVENT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      compDistributed,
      compAccrued,
      receiver
    },
  });
  return finding;
}

function provideInitialize(data) {
  return async function initialize() {
    // assign configurable fields
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    data.distributionThresholdPercent = config.distributionThresholdPercent;
    data.minimumDistributionAmount = config.minimumDistributionAmount;

    data.provider = getEthersProvider();

    const {
      Comptroller: comptroller,
      CompoundToken: compToken,
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
    const compAddress = compToken.address.toLowerCase();
    const compContract = new ethers.Contract(compAddress, decimalsAbi, data.provider);
    const compDecimals = await compContract.decimals();

    data.compDecimalsMultiplier = new BigNumber(10).pow(compDecimals);
    data.compAddress = compAddress;
  }
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      compAddress,
      compDecimalsMultiplier,
      comptrollerContract,
      comptrollerAddress,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      distributionThresholdPercent,
      minimumDistributionAmount,
      distributionSignatures
    } = data;

    if (!comptrollerContract) throw new Error('handleTransaction called before initialization');
    const findings = [];
  
    // if no events found for distributing COMP, return
    const compDistributedEvents = txEvent.filterLog(
      distributionSignatures, 
      comptrollerAddress
    );

    if (!compDistributedEvents.length) return findings;
    // determine how much COMP distributed using Transfer event
    const transferEvents = txEvent.filterLog(ERC20_TRANSFER_EVENT, compAddress).filter((transferEvent) => transferEvent.args.from.toLowerCase() === comptrollerAddress);
    for ( const transferEvent of transferEvents ) {
      const amountCompDistributedBN = new BigNumber(transferEvent.args.value.toString())

      // if we don't reach the minimum threshold for distributed COMP do not bother calculating the ratio to the previous accrued amount
      if ( amountCompDistributedBN.div(compDecimalsMultiplier).lt(minimumDistributionAmount) ) {
        continue;
      }

      // determine Comptroller.compAccrued() in previous block
      const blockNumber = txEvent.blockNumber;
      const prevBlockCompAccrued = await comptrollerContract.compAccrued(transferEvent.args.to, { blockTag: blockNumber-1 });
      const prevBlockCompAccruedBN = new BigNumber(prevBlockCompAccrued.toString());
      
      // if the previous accrual is zero, our heuristic of using the ratio will not work
      if ( prevBlockCompAccruedBN.isZero() ) {
        // TODO: potentially check against a maximum "sane" distribution amount of COMP and alert then even if the previous is zero?
        continue;
      }

      // calculate ratio of accrued to distributed COMP
      const accruedToDistributedRatio = amountCompDistributedBN.div(prevBlockCompAccruedBN).times(100)
      if (accruedToDistributedRatio.gt(distributionThresholdPercent)) {
        findings.push(createDistributionAlert(
          protocolName,
          protocolAbbreviation,
          developerAbbreviation,
          accruedToDistributedRatio,
          receiver = transferEvent.args.to,
          compDistributed = amountCompDistributedBN.toString(),
          compAccrued = prevBlockCompAccruedBN.toString()
        ));
      }
    }

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  createDistributionAlert
};