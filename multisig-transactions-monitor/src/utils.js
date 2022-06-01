/* eslint-disable global-require */
const { Finding, FindingType, FindingSeverity } = require('forta-agent');

const { contracts: { multisig: { address: multisigAddress } } } = require('../bot-config.json');

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
  const { owner } = log.args;

  const finding = Finding.fromObject({
    name: `${protocolName} Multisig Owner Added`,
    description: `Address ${owner} was added as an owner`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-MULTISIG-OWNER-ADDED-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      owner,
      multisigAddress,
    },
  });
  return finding;
}

function createRemoveOwnerFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const { owner } = log.args;

  const finding = Finding.fromObject({
    name: `${protocolName} Multisig Owner Removed`,
    description: `Address ${owner} was removed as an owner`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-MULTISIG-OWNER-REMOVED-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      owner,
      multisigAddress,
    },
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
  const proposalId = log.args.id.toString();

  const finding = Finding.fromObject({
    name: `${protocolName} Proposal Created`,
    description: `Governance Proposal ${proposalId} was just created by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-PROPOSAL-CREATED-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      proposalId,
      multisigAddress,
    },
  });
  return finding;
}

function createProposalExecutedFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const proposalId = log.args.id.toString();

  const finding = Finding.fromObject({
    name: `${protocolName} Proposal Executed`,
    description: `Governance Proposal ${proposalId} was just executed by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-PROPOSAL-EXECUTED-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      proposalId,
      multisigAddress,
    },
  });
  return finding;
}

function createProposalCanceledFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const proposalId = log.args.id.toString();

  const finding = Finding.fromObject({
    name: `${protocolName} Proposal Canceled`,
    description: `Governance Proposal ${proposalId} was just canceled by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-PROPOSAL-CANCELED-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      proposalId,
      multisigAddress,
    },
  });
  return finding;
}

function createVoteCastFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const proposalId = log.args.proposalId.toString();

  const finding = Finding.fromObject({
    name: `${protocolName} Proposal Vote Casted`,
    description: `Governance Proposal id ${proposalId} was voted on by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-VOTE-CAST-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      proposalId,
      multisigAddress,
    },
  });
  return finding;
}

function createProposalThresholdSetFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const oldThreshold = log.args.oldProposalThreshold.toString();
  const newThreshold = log.args.newProposalThreshold.toString();

  const finding = Finding.fromObject({
    name: `${protocolName} Proposal Threshold Set`,
    description: `Governance Proposal threshold changed from ${oldThreshold} to ${newThreshold}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-THRESHOLD-SET-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      oldThreshold,
      newThreshold,
      multisigAddress,
    },
  });
  return finding;
}

function createNewAdminFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const { oldAdmin, newAdmin } = log.args;

  const finding = Finding.fromObject({
    name: `${protocolName} New Admin`,
    description: `Governance Admin changed from ${oldAdmin} to ${newAdmin}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-GOVERNANCE-NEW-ADMIN-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      oldAdmin,
      newAdmin,
      multisigAddress,
    },
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

  if (log.name === 'ProposalThresholdSet') {
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
  const { oldPauseGuardian, newPauseGuardian } = log.args;

  const finding = Finding.fromObject({
    name: `${protocolName} New Pause Guardian`,
    description: `Pause Guardian changed from ${oldPauseGuardian} to ${newPauseGuardian}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-NEW-PAUSE-GUARDIAN-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      oldPauseGuardian,
      newPauseGuardian,
      multisigAddress,
    },
  });
  return finding;
}

function createActionPausedFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const { action } = log.args;

  const finding = Finding.fromObject({
    name: `${protocolName} Action Paused`,
    description: `Action ${action} was Paused by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-ACTION-PAUSED-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      action,
      multisigAddress,
    },
  });
  return finding;
}

function createNewBorrowCapFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const { cToken, newBorrowCap } = log.args;

  const finding = Finding.fromObject({
    name: `${protocolName} New Borrow Cap`,
    description: `New Borrow Cap for cToken ${cToken} with a borrow cap of ${newBorrowCap} was set by multisig ${multisigAddress}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-NEW-BORROW-CAP-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      cToken,
      newBorrowCap,
      multisigAddress,
    },
  });
  return finding;
}

function createNewBorrowCapGuardianFinding(
  log,
  protocolName,
  protocolAbbreviation,
  developerAbbreviation,
) {
  const { oldBorrowCapGuardian, newBorrowCapGuardian } = log.args;

  const finding = Finding.fromObject({
    name: `${protocolName} New Borrow Cap Guardian`,
    description: `Borrow Guardian changed from ${oldBorrowCapGuardian} to ${newBorrowCapGuardian}`,
    alertId: `${developerAbbreviation}-${protocolAbbreviation}-NEW-BORROW-CAP-GUARDIAN-ALERT`,
    protocol: protocolName,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    metadata: {
      oldBorrowCapGuardian,
      newBorrowCapGuardian,
      multisigAddress,
    },
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
    finding = createNewBorrowCapGuardianFinding(
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
