const {
  Finding, FindingSeverity, FindingType, ethers, getEthersBatchProvider,
} = require('forta-agent');

const CERC20_MINT_EVENT = 'event Mint(address minter, uint256 mintAmount, uint256 mintTokens)';
const ERC20_TRANSFER_EVENT = 'event Transfer(address indexed from, address indexed to, uint256 amount)';

const { getAbi } = require('./utils');

// load any agent configuration parameters
const config = require('../agent-config.json');

// set up a variable to hold initialization data used in the handler
const initializeData = {};

// the Forta SDK filterLog function does not supply the logIndex with the results
//  we need this to determine the order the events were emitted in
/* eslint-disable */
function filterLog(eventLogs, eventAbi, contractAddress) {
  var logs = eventLogs;
  eventAbi = Array.isArray(eventAbi) ? eventAbi : [eventAbi];
  if (contractAddress) {
      contractAddress = Array.isArray(contractAddress)
          ? contractAddress
          : [contractAddress];
      var contractAddressMap_1 = {};
      contractAddress.forEach(function (address) {
          contractAddressMap_1[address.toLowerCase()] = true;
      });
      logs = logs.filter(function (log) { return contractAddressMap_1[log.address.toLowerCase()]; });
  }
  var results = [];
  var iface = new ethers.utils.Interface(eventAbi);
  for (var _i = 0, logs_1 = logs; _i < logs_1.length; _i++) {
      var log = logs_1[_i];
      try {
          var parsedLog = iface.parseLog(log);
          results.push(Object.assign(parsedLog, { address: log.address, logIndex: log.logIndex }));
      }
      catch (e) { }
  }
  return results;
}
/* eslint-enable */

// helper function to create cToken alerts
function createMarketAttackAlert(
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  compTokenSymbol,
  compTokenAddress,
  mintAmount,
  mintTokens,
  maliciousAddress,
  maliciousAmount,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} cToken Market Attack Event`,
    description: `The address ${maliciousAddress} is potentially manipulating the cToken ${compTokenSymbol} market`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-MARKET-ATTACK-EVENT`,
    type: FindingType.Suspicious,
    severity: FindingSeverity.Info,
    protocol: protocolName,
    metadata: {
      compTokenSymbol,
      compTokenAddress,
      mintAmount,
      mintTokens,
      maliciousAddress,
      maliciousAmount,
    },
  });
  return finding;
}

async function getCompoundTokens(
  provider,
  comptrollerContract,
  compTokenAbi,
  excludeAddresses,
  compTokens,
) {
  let compTokenAddresses = await comptrollerContract.getAllMarkets();
  compTokenAddresses = compTokenAddresses
    .map((addr) => addr.toLowerCase())
    .filter((addr) => excludeAddresses.indexOf(addr) === -1)
    .filter((addr) => !Object.keys(compTokens).includes(addr));

  await Promise.all(compTokenAddresses.map(async (tokenAddress) => {
    const contract = new ethers.Contract(tokenAddress, compTokenAbi, provider);
    const symbol = await contract.symbol();
    const underlying = await contract.underlying();

    // eslint-disable-next-line no-param-reassign
    compTokens[tokenAddress] = {
      symbol,
      underlying: underlying.toLowerCase(),
    };
  }));
}

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */
    // assign configurable fields
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    const { excludeAddresses } = config;
    data.excludeAddresses = excludeAddresses.map((addr) => addr.toLowerCase());

    data.provider = getEthersBatchProvider();

    const {
      Comptroller: comptroller,
      CompToken: compToken,
    } = config.contracts;

    // create an ethers.js Contract Object to interact with the Comptroller contract
    const comptrollerAbi = getAbi(comptroller.abiFile);
    data.comptrollerContract = new ethers.Contract(
      comptroller.address,
      comptrollerAbi,
      data.provider,
    );

    data.compTokenAbi = getAbi(compToken.abiFile);
    data.compTokens = {};

    // from the Comptroller contract, get all of the cTokens
    await getCompoundTokens(
      data.provider,
      data.comptrollerContract,
      data.compTokenAbi,
      data.excludeAddresses,
      data.compTokens,
    );
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      provider,
      excludeAddresses,
      compTokens,
      compTokenAbi,
      comptrollerContract,
    } = data;
    const findings = [];

    await getCompoundTokens(
      provider,
      comptrollerContract,
      compTokenAbi,
      excludeAddresses,
      compTokens,
    );

    const transferEvents = filterLog(txEvent.logs, ERC20_TRANSFER_EVENT);

    // return findings under the following circumstances
    // - A Mint event was emitted before a Transfer event
    // - The Mint event was emitted by a Compound cToken contract
    // - The Transfer event was emitted by the underlying token contract
    //    corresponding to that Compound cToken contract and
    //    was being transferred directly to said Compound cToken contract
    transferEvents.forEach((transferEvent) => {
      Object.entries(compTokens).forEach(([compTokenAddress, compToken]) => {
        if (transferEvent.address === compToken.underlying
          && transferEvent.args.to.toLowerCase() === compTokenAddress) {
          filterLog(txEvent.logs, CERC20_MINT_EVENT, compTokenAddress)
            .forEach((mintEvent) => {
              if (transferEvent.logIndex > mintEvent.logIndex) {
                findings.push(createMarketAttackAlert(
                  protocolName,
                  protocolAbbreviation,
                  developerAbbreviation,
                  compToken.symbol,
                  transferEvent.args.to,
                  mintEvent.args.mintAmount.toString(),
                  mintEvent.args.mintTokens.toString(),
                  transferEvent.args.from,
                  transferEvent.args.amount.toString(),
                ));
              }
            });
        }
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
  createMarketAttackAlert,
};
