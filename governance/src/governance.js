const { Finding } = require('forta-agent');

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
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-PROPOSAL-CREATED`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      ...proposal,
    },
  });
}

function voteCastFinding(voteInfo, address, config) {
  console.log(voteInfo);
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

  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Vote Cast`,
    description,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-VOTE-CAST`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      voter: voteInfo.voter,
      votes: voteInfo.votes.toString(),
      reason: voteInfo.reason,
    },
  });
}

function proposalCanceledFinding(id, address, config) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Canceled`,
    description: `Governance proposal ${id} has been canceled`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-CANCELED`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      id,
      state: 'canceled',
    },
  });
}

function proposalExecutedFinding(id, address, config) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Executed`,
    description: `Governance proposal ${id} has been executed`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-EXECUTED`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      id,
      state: 'executed',
    },
  });
}

function proposalQueuedFinding(id, address, config, eta) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Queued`,
    description: `Governance Proposal ${id} has been queued`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-QUEUED`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      eta,
      id,
      state: 'queued',
    },
  });
}

function proposalThresholdSetFinding(address, config, oldThresh, newThresh) {
  return Finding.fromObject({
    name: `${config.protocolName} Governance Proposal Threshold Set`,
    description: `Proposal threshold change from ${oldThresh} to ${newThresh}`,
    alertId: `${config.developerAbbreviation}-${config.protocolAbbreviation}-GOVERNANCE-PROPOSAL-THRESHOLD-SET`,
    type: 'Info',
    severity: 'Info',
    protocol: config.protocolName,
    metadata: {
      address,
      oldThreshold: oldThresh,
      newThreshold: newThresh,
    },
  });
}

function createGovernanceFindings(logs, address, config) {
  // iterate over all logs to determine what governance actions were taken
  let results = logs.map((log) => {
    let proposal;
    let voteInfo;
    switch (log.name) {
      case 'ProposalCreated':
        // create a finding for a new proposal
        proposal = createProposalFromLog(log);
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
        return voteCastFinding(voteInfo, address, config);
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

  // filter out empty results
  results = results.filter((result) => result !== undefined);

  return results;
}

module.exports = {
  createGovernanceFindings,
};
