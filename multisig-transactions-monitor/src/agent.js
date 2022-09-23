const { ethers, getEthersProvider } = require('forta-agent');

// load bot configuration parameters
const config = require('../bot-config.json');

// require utilities
const utils = require('./utils');

// set up variable to hold initialization data for use in the handler
const initializeData = {};

function provideInitialize(data) {
  return async function initialize() {
    /* eslint-disable no-param-reassign */

    // get protocol and developer info
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;

    const sigTypeFull = ethers.utils.FormatTypes.full;

    const { v2Addresses, v3Addresses } = config;

    // get contracts' abi and monitored event signatures
    const { contracts } = config;
    data.contractsInfo = Object.entries(contracts).map(([name, entry]) => {
      const {
        events: eventNames, address, abiFile, protocolVersion,
      } = entry;
      const file = utils.getAbi(abiFile);
      const contractInterface = new ethers.utils.Interface(file.abi);
      const eventSignatures = eventNames.map((eventName) => {
        const signature = contractInterface.getEvent(eventName).format(sigTypeFull);
        return signature;
      });

      // determine which create finding function to use
      let createFinding;

      if (address === contracts.multisig.address) {
        createFinding = utils.createGnosisFinding;
      } else if (address === contracts.governance.address) {
        createFinding = utils.createGovernanceFinding;
      } else if (address === contracts.comptroller.address) {
        createFinding = utils.createComptrollerFinding;
      } else if (address === contracts.comet_usdc.address) {
        createFinding = utils.createCometFinding;
      }

      // create object to store and return necessary contract information
      const contract = {
        createFinding,
        address,
        name,
        eventSignatures,
        eventNames,
        interface: contractInterface,
        v2Addresses,
        v3Addresses,
        protocolVersion,
      };

      return contract;
    });

    // get contract address of multisig wallet
    data.multisigAddress = config.contracts.multisig.address.toLowerCase();
  };
}

async function getGovernanceProtocolVersion(contractInfo, log) {
  // Identify protocol versions effected by governance proposal

  // Get the list of affected targets(contract addresses)
  let targetList;
  if (log.args.targets !== undefined) {
    // targets defined in event arguments
    targetList = log.args.targets;
  } else {
    // Get proposal id from event arguments
    let proposalId;
    if (log.args.id !== undefined) {
      proposalId = log.args.id.toString();
    } else if (log.args.proposalId !== undefined) {
      proposalId = log.args.proposalId.toString();
    } else {
      console.debug('Could not locate proposal id in event arguments');
      return undefined;
    }

    // use the proposal id to query the governance contract for a list of targets
    const provider = getEthersProvider();
    const governanceContract = new ethers.Contract(
      contractInfo.address,
      contractInfo.interface,
      provider,
    );
    ({ targets: targetList } = await governanceContract.getActions(proposalId));
  }

  // Locate proposal addresses which map to known v2/v3 addresses
  const v2Addresses = targetList.filter(
    (item) => Object.values(contractInfo.v2Addresses).includes(item),
  );
  // ref: https://github.com/compound-finance/comet/blob/main/deployments/mainnet/usdc/roots.json
  const v3Addresses = targetList.filter(
    (item) => Object.values(contractInfo.v3Addresses).includes(item),
  );

  // Set protocol version based on which addresses were found in the proposal
  let protocolVersion;
  if (v2Addresses.length > 0 && v3Addresses.length > 0) {
    // Compound V2 and V3
    protocolVersion = '2,3';
  } else if (v3Addresses.length > 0) {
    // Compound V3
    protocolVersion = '3';
  } else if (v2Addresses.length > 0) {
    // Compound V2
    protocolVersion = '2';
  } else {
    console.debug(`No known contract addresses found in proposal, ${log.args.targets.join(',')}`);
  }

  return protocolVersion;
}

async function getProtocolVersion(contractInfo, log) {
  let { protocolVersion } = contractInfo;

  if (protocolVersion === undefined) {
    if (contractInfo.name === 'governance') {
      protocolVersion = await getGovernanceProtocolVersion(contractInfo, log);
    } else {
      console.debug(`No protocol version defined for '${contractInfo.name}'`);
    }
  }

  return protocolVersion;
}

function provideHandleTransaction(data) {
  return async function handleTransaction(txEvent) {
    const {
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      contractsInfo,
      multisigAddress,
    } = data;

    const findings = [];

    // filter for transactions involving the multisig address
    const txAddrs = Object.keys(txEvent.addresses).map((address) => address.toLowerCase());

    // if the multisig was involved in a transaction, find out specifically which one
    if (txAddrs.indexOf(multisigAddress) !== -1) {
      await Promise.all(contractsInfo.map(async (contract) => {
        // filter for which event and address the multisig transaction was involved in
        const parsedLogs = await txEvent.filterLog(contract.eventSignatures, contract.address);

        await Promise.all(parsedLogs.map(async (log) => {
          const protocolVersion = await getProtocolVersion(contract, log);
          const finding = contract.createFinding(
            log,
            protocolName,
            protocolAbbreviation,
            developerAbbreviation,
            protocolVersion,
          );
          findings.push(finding);
        }));
      }));
    }
    console.log(JSON.stringify(findings, null, 2));
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};
