const {
  ethers, Finding, FindingSeverity, FindingType, getEthersProvider,
} = require('forta-agent');
const anchoredViewAbi = require('../abi/UniswapAnchoredView.json');

const UNI_ANCHORED_VIEW_ADDRESS = '0x50ce56A3239671Ab62f185704Caedf626352741e';
// set up a variable to hold initialization data used in the handler
const initializeData = {};

function createAlert(
  cTokenAddress,
  underlyingTokenAddress,
  priceReporterAddress,
  currentPrice,
  rejectedPrice,
  protocolVersion,
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
      protocolVersion,
    },
  });
}

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // request the ethers provider from the forta sdk
    const provider = getEthersProvider();
    const iface = new ethers.utils.Interface(anchoredViewAbi);
    // initialize the UniswapAnchoredView contract
    data.contract = new ethers.Contract(UNI_ANCHORED_VIEW_ADDRESS, anchoredViewAbi, provider);
    data.priceGuardedEvent = iface.getEvent('PriceGuarded').format(ethers.utils.FormatTypes.full);
    // UniswapAnchoredView price feed contract is only used in Compound v2
    data.protocolVersion = '2';
    /* eslint-enable no-param-reassign */
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const { priceGuardedEvent, contract, protocolVersion } = data;

    // use parseLog to see if the event PriceGuarded has been emitted, this is the event that
    // means the price returned from the validator proxy did not meet the acceptable Uniswap V2 TWAP
    // percent range and was rejected
    const parsedLogs = txEvent.filterLog(priceGuardedEvent, UNI_ANCHORED_VIEW_ADDRESS);

    const promises = parsedLogs.map(async (log) => {
      // the first argument of PriceGuarded is the symbol hash of the cToken, use this to retrieve
      // the cToken information from the UniswapAnchoredView contract and generate a finding
      const { symbolHash, reporterPrice, anchorPrice } = log.args;

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
        protocolVersion,
      );
    });

    const findings = (await Promise.all(promises)).flat();
    console.log(JSON.stringify(findings, null, 2));
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
