const { Finding, FindingType, FindingSeverity } = require('forta-agent');

function createAddOwnerFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Multisig Owner Added`,
    description: `Address ${log.address} was added as an owner`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-MULTISIG-OWNER-ADDED-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createRemoveOwnerFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Multisig Owner Removed`,
    description: `Address ${log.address} was removed as an owner`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-MULTISIG-OWNER-REMOVED-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createGnosisFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  let finding;

  if (log.name === 'AddedOwner') {
    finding = createAddOwnerFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }

  if (log.name === 'RemovedOwner') {
    finding = createRemoveOwnerFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }

  return finding;
}

function getAbi(abiFile) {
  // eslint-disable-next-line import/no-dynamic-require
  const abi = require(`../abi/${abiFile}`);
  return abi;
}

module.exports = {
  createAddOwnerFinding,
  createRemoveOwnerFinding,
  getAbi,
  createGnosisFinding,
};
