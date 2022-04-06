const { Finding, FindingType, FindingSeverity } = require('forta-agent');

const config = require('../agent-config.json');

const multisigAddress = config.contracts.multisig.address;

/// CREATE FINDINGS FOR GNOSIS SAFE INTERACTIONS ///
function createAddOwnerFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Multisig Owner Added`,
    description: `Address ${log.address} was added as an owner`, // found in args and not here?
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

  // iterate over logs to see which action occured
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

/// CREATE FINDINGS FOR GOVERNOR BRAVO INTERACTIONS ///

/*
        "ProposalCreated",
        "ProposalExecuted",
        "ProposalCanceled",
        "VoteCast",
        "ProposalThresholdSet",
        "NewAdmin"
*/

function createProposalCreatedFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Proposal Created`,
    description: `Governance Proposal was just created by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-COMPOUND-PROPOSAL-CREATED-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createProposalExecutedFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Proposal Executed`,
    description: `Governance Proposal was just executed by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-COMPOUND-PROPOSAL-EXECUTED-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createProposalCanceledFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Proposal Canceled`,
    description: `Governance Proposal was just canceled by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-COMPOUND-PROPOSAL-CANCELED-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createVoteCastFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Proposal Vote Casted`,
    description: `Governance Proposal vote was casted by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-COMPOUND-VOTE-CAST-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createProposalThresholdSetFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Proposal Threshold Set`,
    description: `Governance Proposal threshold was set by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-COMPOUND-THRESHOLD-SET-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createNewAdminFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Proposal New Adimn`,
    description: `Governance New Admin was set by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-COMPOUND-NEW-ADMIN-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createGovernanceFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  let finding;

  if (log.name === 'ProposalCreated') {
    finding = createProposalCreatedFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }

  if (log.name === 'ProposalExecuted') {
    finding = createProposalExecutedFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }

  if (log.name === 'ProposalCanceled') {
    finding = createProposalCanceledFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }


  if (log.name === 'VoteCast') {
    finding = createVoteCastFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }

  if (log.name === 'ProposalThresHoldSet') {
    finding = createProposalThresholdSetFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }

  if (log.name === 'NewAdmin') {
    finding = createNewAdminFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }

  return finding;
}

/// CREATE FINDINGS FOR COMPTROLLER INTERACTIONS ///

/*
        "NewPauseGuardian",
        "ActionPaused",
        "NewBorrowCap",
        "NewBorrowCapGuardian",
        "NewPauseGuardian"
*/

function createNewPauseGaurdianFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} New Pause Guardian`,
    description: `Governance New Pause Guardian was set by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-COMPOUND-NEW-PAUSE-GUARDIAN-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createActionPausedFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Action Paused`,
    description: `Governance Action Paused by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-COMPOUND-ACTION-PAUSED-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createNewBorrowCapFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} New Borrow Cap`,
    description: `Governance New Borrow Cap was set by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-COMPOUND-NEW-BORROW-CAP-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createNewBorrowCapGaurdianFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} New Borrow Cap Guardian`,
    description: `Governance New Borrow Guardian was set by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-COMPOUND-NEW-BORROW-CAP-GUARDIAN-ALERT`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
  });
  return finding;
}

function createComptrollerFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  let finding;

  if (log.name === 'NewBorrowCapGuardian') {
    finding = createNewBorrowCapGaurdianFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }

  if (log.name === 'NewBorrowCap') {
    finding = createNewBorrowCapFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }

  if (log.name === 'ActionPaused') {
    finding = createActionPausedFinding(
      log,
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
    );
  }

  if (log.name === 'NewPauseGuardian') {
    finding = createNewPauseGaurdianFinding(
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
  createGovernanceFinding,
  createComptrollerFinding,
};
