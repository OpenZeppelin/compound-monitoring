const { Finding, FindingType, FindingSeverity } = require('forta-agent');

const config = require('../agent-config.json');

const multisigAddress = config.contracts.multisig.address;

/// CREATE FINDINGS FOR GNOSIS SAFE INTERACTIONS ///
/*
        "AddedOwner",
        "RemovedOwner",
*/
function createAddOwnerFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} Multisig Owner Added`,
    description: `Address ${log.args.owner} was added as an owner`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-MULTISIG-OWNER-ADDED-ALERT`,
    protocol: config.protocolName,
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
    description: `Address ${log.args.owner} was removed as an owner`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-MULTISIG-OWNER-REMOVED-ALERT`,
    protocol: config.protocolName,
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
    description: `Governance Proposal ${log.args.id.toString()} was just created by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-PROPOSAL-CREATED-ALERT`,
    protocol: config.protocolName,
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
    description: `Governance Proposal ${log.args.id.toString()} was just executed by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-PROPOSAL-EXECUTED-ALERT`,
    protocol: config.protocolName,
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
    description: `Governance Proposal ${log.args.id.toString()} was just canceled by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-PROPOSAL-CANCELED-ALERT`,
    protocol: config.protocolName,
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
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-VOTE-CAST-ALERT`,
    protocol: config.protocolName,
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
    description: `Governance Proposal threshold changed from ${log.args.oldProposalThreshold.toString()} to ${log.args.newProposalThreshold.toString()}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-THRESHOLD-SET-ALERT`,
    protocol: config.protocolName,
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
    name: `${protocolName} New Adimn`,
    description: `Governance Admin changed from ${log.args.oldAdmin} to ${log.args.newAdmin}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-NEW-ADMIN-ALERT`,
    protocol: config.protocolName,
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

function createNewPauseGuardianFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const finding = Finding.fromObject({
    name: `${protocolName} New Pause Guardian`,
    description: `Governance Pause Guardian changed from ${log.args.oldPauseGuardian} to ${log.args.newPauseGuardian}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-NEW-PAUSE-GUARDIAN-ALERT`,
    protocol: config.protocolName,
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
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-ACTION-PAUSED-ALERT`,
    protocol: config.protocolName,
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
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-NEW-BORROW-CAP-ALERT`,
    protocol: config.protocolName,
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
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-NEW-BORROW-CAP-GUARDIAN-ALERT`,
    protocol: config.protocolName,
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
    finding = createNewPauseGuardianFinding(
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
