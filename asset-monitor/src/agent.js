const {
  Finding, FindingSeverity, FindingType, ethers, getEthersBatchProvider,
} = require('forta-agent');

const BigNumber = require('bignumber.js');
const axios = require('axios');

const {
  getAbi,
} = require('./utils');

// load any agent configuration parameters
const config = require('../agent-config.json');

// set up a variable to hold initialization data used in the handler
const initializeData = {};

const DECIMALS_ABI = ['function decimals() view returns (uint8)'];

// helper function to create cToken alerts
async function createCTokenAlert(
  eventName,
  cTokenSymbol,
  contractAddress,
  eventType,
  eventSeverity,
  args,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
  emojiString,
) {
  const eventArgs = extractEventArgs(args);
  const finding = Finding.fromObject({
    name: `${protocolName} cToken Event`,
    description: `${emojiString} - The ${eventName} event was emitted by the ${cTokenSymbol} cToken contract`,
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
      amountKey: entry.amountKey,
    };
  });
  return result;
}

function isUpgradeableProxy(asset, proxyPatterns) {
  return proxyPatterns.every((pattern) => {
    let isPattern = pattern.functionHashes.every((functionHash) => {
      if ( asset.code.indexOf(functionHash) !== -1) {
        return true;
      } else {
        return false;
      }
    });
    if ( isPattern ) {
      return true;
    }
    else {
      return false;
    }
  });  
}

async function getUnderlyingAsset(address, abi, provider, proxyPatterns) {
  let underlyingTokenAddress;
  let symbol;

  const underlyingAsset = {};
  const contract = new ethers.Contract(address, abi, provider);

  try {
    symbol = await contract.symbol();
    underlyingTokenAddress = await contract.underlying();
  } catch(e) {
    console.log(e);
  }

  if ( underlyingTokenAddress ) {
    underlyingAsset.symbol = symbol;
    underlyingAsset.cToken = address;
    underlyingAsset.address = underlyingTokenAddress;
    underlyingAsset.code = await provider.getCode(underlyingTokenAddress);;
    underlyingAsset.isProxy = isUpgradeableProxy(underlyingAsset, proxyPatterns);
  }

  return underlyingAsset;
}

async function getCompoundTokens(contract, excludeAddresses) {
  let cTokenAddresses = await contract.getAllMarkets();
  cTokenAddresses = cTokenAddresses.map((addr) => addr.toLowerCase());
  cTokenAddresses = cTokenAddresses.filter((addr) => excludeAddresses.indexOf(addr) === -1);

  return cTokenAddresses;
}

function provideInitialize(data) {
  return async function initialize() {
    // assign configurable fields
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    let excludeAddresses = config.excludeAddresses;
    excludeAddresses.map((addr) => addr.toLowerCase());
    data.excludeAddresses = excludeAddresses;

    data.proxyPatterns = config.proxyPatterns;

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

    data.cTokenAddresses = await getCompoundTokens(data.comptrollerContract, data.excludeAddresses);

    // cToken contracts
    // gather the underlying asset contracts for every cToken
    data.cTokenAbi = getAbi(cTokens.abiFile);

    data.underlyingAssets = [];
    const promises = data.cTokenAddresses.map(async (address) => {
      data.underlyingAssets.push(await getUnderlyingAsset(address, data.cTokenAbi, data.provider, data.proxyPatterns));
    });
    await Promise.all(promises);
  };
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      cTokenAddresses,
      cTokenAbi,
      underlyingAssets,
      comptrollerContract,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      excludeAddresses,
      proxyPatterns
    } = data;

    const findings = [];

    // first check that no additional cTokens have been added
    const currentCTokenAddresses = await getCompoundTokens(data.comptrollerContract, data.excludeAddresses);
    const unique = currentCTokenAddresses.filter((addr) => cTokenAddresses.indexOf(addr) === -1);

    cTokenAddresses.push(...unique);

    if (unique.length > 0) {
      // create ethers.js Contract Objects and add them to the Object of other Contract Objects
      const promises = unique.map(async (address) => {
        underlyingAssets.push(await getUnderlyingAsset(address, cTokenAbi, data.provider, data.proxyPatterns));
      });
      await Promise.all(promises);
    }

    const upgradeableProxyAssets = underlyingAssets.filter((asset) => asset.isProxy === true);

    console.log("number of proxies: ", upgradeableProxyAssets.length);

    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};