const {
  ethers, Finding, FindingSeverity, FindingType, getEthersProvider,
} = require('forta-agent');
const achoredViewAbi = require('../abi/UniswapAnchoredView.json');

const UNI_ANCHORED_VIEW_ADDRESS = '0x046728da7cb8272284238bD3e47909823d63A58D';
// set up a variable to hold initialization data used in the handler
const initializeData = {};

function createAlert(
  cTokenAddress, underlyingTokenAddress, priceReporterAddress, currentPrice, rejectedPrice,
) {
  return Finding.fromObject({
    name: 'Compound Oracle Price Monitor',
    description: `The new price reported by ValidatorProxy ${priceReporterAddress} was rejected `
      + `for cToken ${cTokenAddress}`,
    alertId: 'AE-COMP-CTOKEN-PRICE-REJECTED',
    type: FindingType.Degraded,
    severity: FindingSeverity.High,
    metadata: {
      cTokenAddress,
      underlyingTokenAddress,
      validatorProxyAddress: priceReporterAddress,
      anchorPrice: currentPrice,
      reporterPrice: rejectedPrice,
    },
  });
}

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // request the ethers provider from the forta sdk
    data.provider = getEthersProvider();
    data.iface = new ethers.utils.Interface(achoredViewAbi);
    // initialize the UniswapAnchoredView contract
    data.contract = new ethers.Contract(UNI_ANCHORED_VIEW_ADDRESS, achoredViewAbi, data.provider);
    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const { iface, contract } = data;

    // use parseLog to see if the event PriceGuarded has been emitted, this is the event that
    // means the price returned from the validator proxy did not meet the acceptable Uniswap V2 TWAP
    // percent range and was rejected
    const priceGuardedEvent = iface.getEvent('PriceGuarded').format(ethers.utils.FormatTypes.full);
    const parsedLogs = txEvent.filterLog(priceGuardedEvent, UNI_ANCHORED_VIEW_ADDRESS);

    const promises = parsedLogs.map(async (log) => {
      // the first argument of PriceGuarded is the symbol hash of the cToken, use this to retrieve
      // the cToken information from the UniswapAnchoredView contract and generate a finding
      const { symbolHash, reporter: reporterPrice, anchor: anchorPrice } = log.args;

      /*
        struct TokenConfig {
          address cToken;
          address underlying;
          bytes32 symbolHash;
          uint256 baseUnit;
          PriceSource priceSource;
          uint256 fixedPrice;
          address uniswapMarket;
          address reporter;
          uint256 reporterMultiplier;
          bool isUniswapReversed;
        }
      */
      const cTokenConfig = await contract.getTokenConfigBySymbolHash(symbolHash);
      return createAlert(
        cTokenConfig[0],
        cTokenConfig[1],
        cTokenConfig[7],
        anchorPrice.toString(),
        reporterPrice.toString(),
      );
    });

    const findings = (await Promise.all(promises)).flat();
    return findings;
  };
}

module.exports = {
  UNI_ANCHORED_VIEW_ADDRESS,
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};
