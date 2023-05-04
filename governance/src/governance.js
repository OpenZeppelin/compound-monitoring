const { Finding, FindingType, FindingSeverity } = require('forta-agent');
const delegatesList = require('./delegatesList.json');

function createProposalFromLog(log) {
  const proposal = {
    id: log.args.id.toString(),
    proposer: log.args.proposer,
    targets: log.args.targets.join(','),
    // the 'values' key has to be parsed differently because `values` is a named method on Objects
    // in JavaScript.  Also, this is why the key is prefixed with an underscore, to avoid
    // overwriting the `values` method.
    _values: (log.args[3].map((v) => v.toString())).join(','),
    signatures: log.args.signatures.join(','),
    calldatas: log.args.calldatas.join(','),
    startBlock: log.args.startBlock.toString(),
    endBlock: log.args.endBlock.toString(),
    description: log.args.description,
  };
  return proposal;
}

// alert for when a new governance proposal is created
function proposalCreatedFinding(proposal, address, config) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Created`,
    description: `Governance Proposal ${proposal.id} was just created`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-CREATED`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    protocol: config.protocolName,
    metadata: {
      address,
      ...proposal,
    },
  });
}

function getProposalName(config, id) {
  // look up proposal description from config Object
  const proposal = config.proposals[id.toString()];
  if (proposal === undefined) {
    return '(unknown proposal name)';
  }
  const lines = proposal.description.split('\n');
  const [proposalName] = lines;
  // remove markdown heading symbol and then leading and trailing spaces
  proposalName.replaceAll('#', '').trim();
  return proposalName;
}

async function getAccountDisplayName(voteInfo) {
  let displayName;
  try {
    const accountObj = delegatesList.delegates.find((a) => a.account.address === voteInfo.voter);
    displayName = accountObj.account.name;
    if (displayName === null) {
      displayName = '';
    }
  } catch {
    displayName = '';
  }
  return displayName;
}

async function voteCastFinding(voteInfo, address, config) {
  const displayName = await getAccountDisplayName(voteInfo);

  let description = `Vote cast with ${voteInfo.votes.toString()} votes`;
  switch (voteInfo.support) {
    case 0:
      description += ' against';
      break;
    case 1:
      description += ' in support of';
      break;
    case 2:
      description += ' abstaining from';
      break;
    default:
      description += ` with unknown support "${voteInfo.support}" for`;
  }
  description += ` proposal ${voteInfo.proposalId}`;

  const proposalName = getProposalName(config, voteInfo.proposalId);

  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Vote Cast`,
    description,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-VOTE-CAST`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    protocol: config.protocolName,
    metadata: {
      address,
      voter: voteInfo.voter,
      votes: voteInfo.votes.toString(),
      reason: voteInfo.reason,
      id: voteInfo.proposalId.toString(),
      proposalName,
      displayName,
    },
  });
}

function proposalCanceledFinding(id, address, config) {
  const proposalName = getProposalName(config, id);

  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Canceled`,
    description: `Governance proposal ${id} has been canceled`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-CANCELED`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    protocol: config.protocolName,
    metadata: {
      address,
      id,
      state: 'canceled',
      proposalName,
    },
  });
}

function proposalExecutedFinding(id, address, config) {
  const proposalName = getProposalName(config, id);
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Executed`,
    description: `Governance proposal ${id} has been executed`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-EXECUTED`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    protocol: config.protocolName,
    metadata: {
      address,
      id,
      state: 'executed',
      proposalName,
    },
  });
}

function proposalQueuedFinding(id, address, config, eta) {
  const proposalName = getProposalName(config, id);
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Queued`,
    description: `Governance Proposal ${id} has been queued`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-QUEUED`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    protocol: config.protocolName,
    metadata: {
      address,
      eta,
      id,
      state: 'queued',
      proposalName,
    },
  });
}

function proposalThresholdSetFinding(address, config, oldThresh, newThresh) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Threshold Set`,
    description: `Proposal threshold change from ${oldThresh} to ${newThresh}`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-THRESHOLD-SET`,
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    protocol: config.protocolName,
    metadata: {
      address,
      oldThreshold: oldThresh,
      newThreshold: newThresh,
    },
  });
}

async function createGovernanceFindings(logs, address, config) {
  // iterate over all logs to determine what governance actions were taken
  const promises = logs.map(async (log) => {
    let proposal;
    let voteInfo;
    let finding;
    switch (log.name) {
      case 'ProposalCreated':
        // create a finding for a new proposal
        proposal = createProposalFromLog(log);

        // store the proposal information in the config Object for later use
        // eslint-disable-next-line no-param-reassign
        config.proposals[proposal.id] = proposal;

        return proposalCreatedFinding(
          proposal,
          address,
          config,
        );
      case 'VoteCast':
        // add the vote to the corresponding proposal object
        voteInfo = {
          voter: log.args.voter,
          proposalId: log.args.proposalId.toString(),
          support: log.args.support,
          votes: log.args.votes,
          reason: log.args.reason,
        };
        // create a finding indicating that the vote was cast
        finding = await voteCastFinding(voteInfo, address, config);
        return finding;
      case 'ProposalCanceled':
        // create a finding indicating that the proposal has been canceled,
        return proposalCanceledFinding(log.args.id.toString(), address, config);
      case 'ProposalExecuted':
        // create a finding indicating that the proposal has been executed,
        return proposalExecutedFinding(log.args.id.toString(), address, config);
      case 'ProposalQueued':
        return proposalQueuedFinding(
          log.args.id.toString(),
          address,
          config,
          log.args.eta.toString(),
        );
      case 'ProposalThresholdSet':
        return proposalThresholdSetFinding(
          address,
          config,
          log.args.oldProposalThreshold.toString(),
          log.args.newProposalThreshold.toString(),
        );
      default:
        return undefined;
    }
  });

  let results = await Promise.all(promises);

  // filter out empty results
  results = results.filter((result) => result !== undefined);

  return results;
}

module.exports = {
  createGovernanceFindings,
};
