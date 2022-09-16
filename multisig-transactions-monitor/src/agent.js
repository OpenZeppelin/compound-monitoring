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

    // get contracts' abi and monitored event signatures
    const { contracts } = config;
    data.contractsInfo = Object.entries(contracts).map(([name, entry]) => {
      const { events: eventNames, address, abiFile } = entry;
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
      };

      return contract;
    });

    // get contract address of multisig wallet
    data.multisigAddress = config.contracts.multisig.address.toLowerCase();
  };
}
// TODO: Get these addresses dynamically
const compoundV2Contracts = {
  comptroller: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
  comp: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
};

// TODO: Get these addresses dynamically
const compoundV3Contracts = {
  comet: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
  configurator: '0x316f9708bB98af7dA9c68C1C3b5e79039cD336E3',
  rewards: '0x1B0e765F6224C21223AeA2af16c1C46E38885a40',
  bulker: '0x74a81F84268744a40FEBc48f8b812a1f188D80C3',
};

async function parseCreateProposalLog(contractInfo, log) {
  let proposalId;
  if (log.args.id !== undefined) {
    proposalId = log.args.id.toString();
  } else if (log.args.proposalId !== undefined) {
    proposalId = log.args.proposalId.toString();
  } else {
    console.debug('Could not locate proposal id in event arguments');
    return;
  }

  let targetList;
  if (log.name === 'ProposalCreated') {
    targetList = log.args.targets;
  } else {
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
    (item) => Object.values(compoundV2Contracts).includes(item),
  );
  const v3Addresses = targetList.filter(
    (item) => Object.values(compoundV3Contracts).includes(item),
  );

  console.debug(`v2Addresses ${v2Addresses}`);
  console.debug(`v3Addresses ${v3Addresses}`);

  // Set protocol version based on which addresses were found in the proposal
  let protocolVersion;
  if (v2Addresses.length > 0 && v3Addresses.length > 0) {
    protocolVersion = '2,3';
  } else if (v3Addresses.length > 0) {
    protocolVersion = '3';
  } else if (v2Addresses.length > 0) {
    protocolVersion = '2';
  } else {
    console.debug(`No known contract addresses found in proposal, ${log.args.targets.join(',')}`);
  }

  return protocolVersion;
}

async function getProtocolVersion(contractInfo, log) {
  let protocolVersion;

  switch (contractInfo.name) {
    case 'governance':
      protocolVersion = await parseCreateProposalLog(contractInfo, log);
      break;
    case 'comptroller':
      protocolVersion = '2';
      break;
    case 'comet_usdc':
      protocolVersion = '3';
      break;
    default:
      protocolVersion = null;
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
    //if (true) {
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
    return findings;
  };
}

module.exports = {
  provideInitialize,
  initialize: provideInitialize(initializeData),
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(initializeData),
};
