const {
  Finding, FindingSeverity, FindingType, ethers, getEthersBatchProvider,
} = require('forta-agent');

const CERC20_MINT_EVENT = 'event Mint(address minter, uint256 mintAmount, uint256 mintTokens)';
const ERC20_TRANSFER_EVENT = 'event Transfer(address indexed from, address indexed to, uint256 amount)';

const { getAbi } = require('./utils');

// load any bot configuration parameters
const config = require('../bot-config.json');

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
  protocolVersion,
  compTokenSymbol,
  cTokenAddress,
  mintAmount,
  mintTokens,
  maliciousAddress,
  maliciousAmount,
  totalSupply,
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
      cTokenAddress,
      mintAmount,
      mintTokens,
      maliciousAddress,
      maliciousAmount,
      totalSupply,
      protocolVersion,
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
  let cTokenAddresses = await comptrollerContract.getAllMarkets();
  cTokenAddresses = cTokenAddresses
    .map((addr) => addr.toLowerCase())
    .filter((addr) => excludeAddresses.indexOf(addr) === -1)
    .filter((addr) => !Object.keys(compTokens).includes(addr));

  await Promise.all(cTokenAddresses.map(async (tokenAddress) => {
    const contract = new ethers.Contract(tokenAddress, compTokenAbi, provider);
    const symbol = await contract.symbol();
    const underlying = await contract.underlying();

    // eslint-disable-next-line no-param-reassign
    compTokens[tokenAddress] = {
      symbol,
      underlying: underlying.toLowerCase(),
      contract,
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
    // Comptroller and cToken contracts are only available in Compound V2
    data.protocolVersion = '2';

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
      protocolVersion,
      provider,
      excludeAddresses,
      compTokens,
      compTokenAbi,
      comptrollerContract,
    } = data;

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
    // - The amount being minted is significant compared to the current total supply
    const transferPromises = transferEvents.map(async (transferEvent) => {
      const tokenPromises = Object.entries(compTokens).map(async ([cTokenAddress, compToken]) => {
        const { symbol, underlying, contract } = compToken;

        if (transferEvent.address.toLowerCase() !== underlying.toLowerCase()) {
          return [];
        }

        if (transferEvent.args.to.toLowerCase() !== cTokenAddress.toLowerCase()) {
          return [];
        }

        const mintEvents = txEvent.filterLog(CERC20_MINT_EVENT, cTokenAddress);
        const mintPromises = mintEvents.map(async (mintEvent) => {
          if (transferEvent.logIndex < mintEvent.logIndex) {
            return [];
          }

          // check that the amount being minted is significant compared to the current total supply
          // total supply is the number of tokens in circulation for the market
          const totalSupply = await contract.totalSupply();
          const { mintTokens } = mintEvent.args;

          // if the market has a significant amount of liquidity, the attacker would need to
          // mint a considerable number of cTokens to make the attack worthwhile
          // threshold: if the number of minted tokens is greater than 10% of the total supply
          if (mintTokens.mul(10).gt(totalSupply)) {
            // create finding
            return [
              createMarketAttackAlert(
                protocolName,
                protocolAbbreviation,
                developerAbbreviation,
                protocolVersion,
                symbol,
                transferEvent.args.to,
                mintEvent.args.mintAmount.toString(),
                mintEvent.args.mintTokens.toString(),
                transferEvent.args.from,
                transferEvent.args.amount.toString(),
                totalSupply.toString(),
              ),
            ];
          }
          return [];
        });

        const mintResults = await Promise.all(mintPromises);
        return mintResults.flat();
      });

      const tokenResults = await Promise.all(tokenPromises);
      return tokenResults.flat();
    });

    const transferResults = await Promise.all(transferPromises);
    console.log(JSON.stringify(transferResults.flat(), null, 2));
    return transferResults.flat();
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
  createMarketAttackAlert,
};
