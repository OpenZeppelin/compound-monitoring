const ScopedSecretsProvider = function ({ autotaskId = '', autotaskName = '', secrets = [], namespace = secrets[autotaskId] || autotaskName, delim = '_' } = {}) {
  const scopes = function* () {
    const arr = namespace.split(delim);
    do {
      yield arr.join(delim);
      arr.pop();
    } while (arr.length);
  };
  const get = (target, name) => {
    if (!!target && name in target) return target[name];
  };
  const parse = (str) => {
    try {
      if (!!str) return JSON.parse(str);
    } catch { }
  };
  const order = function* (name, target) {
    for (const scope of scopes()) {
      yield get(target, scope.concat(delim, name));
      yield get(parse(get(target, scope.concat(delim))), name);
      yield get(parse(get(target, scope)), name);
    }
  };
  return new Proxy(secrets, {
    get: (target, name) => {
      for (const value of order(name, target))
        if (!!value) return value;
    }
  });
};
function getUrl(scopedSecrets, source) {
  if (!scopedSecrets || !source) return;
  const { block, transactionHash } = source;
  if (!block || !transactionHash) return;
  const { chainId } = block;
  if (!chainId) return;
  let mapping = scopedSecrets['NetworkBlockexplorerMapping'];
  if (!mapping) return;
  try {
    mapping = JSON.parse(mapping);
  } catch (e) { return; }
  const path = mapping?.[chainId]
  if (!path) return;
  return `${path}${transactionHash}`;
}
exports.handler = async function (payload) {
  const scopedSecrets = new ScopedSecretsProvider(payload);
  const matches = [];
  payload.request.body.events?.forEach(event => {
    const { alertId, source, metadata, hash } = event.alert;
    const transactionLink = getUrl(scopedSecrets, source) ?? `https://explorer.forta.network/alert/${hash}`;
    if (metadata === undefined) {
      throw new Error('metadata undefined');
    }
    const { protocolVersion } = metadata;
    let protocolVersionString = '';
    if (protocolVersion !== undefined) {
      if (protocolVersion === '2') {
        protocolVersionString = ' (Compound v2)';
      } else if (protocolVersion === '3') {
        protocolVersionString = ' (Compound v3)';
      } else if (protocolVersion === '2,3') {
        protocolVersionString = ' (Compound v2/v3)';
      }
    }
    // Start of usual modifications to the autotask script
    // extract the metadata
    const {
      multisigAddress,
    } = metadata;
    const multisigAddressFormatted = multisigAddress?.slice(0, 6);
    let oldPauseGuardian;
    let newPauseGuardian;
    let action;
    let oldAdmin;
    let newAdmin;
    let oldThreshold;
    let newThreshold;
    let oldBorrowCapGuardian;
    let newBorrowCapGuardian;
    let cToken;
    let cTokenFormatted;
    let newBorrowCap;
    let message;
    let id;
    let owner;
    switch (alertId) {
      case 'AE-COMP-MULTISIG-OWNER-ADDED-ALERT':
        ({ owner } = metadata);
        message = `🆕 **Added Owner** ${owner} to Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-APPROVED-HASH-ALERT':
        ({ owner, approvedHash } = metadata);
        message = `✅#️⃣  **Approved Hash** ${owner} approved hash ${approvedHash} to Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-CHANGED-MASTER-COPY-ALERT':
        ({ masterCopy } = metadata);
        message = `➡️ 📜 **Changed Master Copy** to ${masterCopy} to Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-CHANGED-THRESHOLD-ALERT':
        ({ threshold } = metadata);
        message = `🎚️ **Changed Threshold** to ${threshold} to Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-DISABLED-MODULE-ALERT':
        ({ module } = metadata);
        message = `🔴🧩 **Disabled Module** ${module} to Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-ENABLED-MODULE-ALERT':
        ({ module } = metadata);
        message = `🟢🧩 **Enabled Module** ${module} to Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-EXECUTION-FAILURE-ALERT':
        ({ txHash } = metadata);
        message = `❌ **Execution Failure** for transaction ${txHash} to Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-EXECUTION-FROM-MODULE-FAILURE-ALERT':
        ({ module } = metadata);
        message = `❌🧩 **Execution from Module Failure** for module ${module} to Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-EXECUTION-FROM-MODULE-SUCCESS-ALERT':
        ({ module } = metadata);
        message = `✅🧩 **Execution from Module Success** for module ${module} to Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-EXECUTION-SUCCESS-ALERT':
        ({ txHash } = metadata);
        message = `✅ **Execution Success** for transaction ${txHash} to Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-OWNER-REMOVED-ALERT':
        ({ owner } = metadata);
        message = `🙅‍♂️ **Removed Owner** ${owner} from Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-MULTISIG-SIGN-MESSAGE-ALERT':
        ({ msgHash } = metadata);
        message = `🔏 **Signed Message** hash ${msgHash} from Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-GOVERNANCE-PROPOSAL-CREATED-ALERT':
        ({ proposalId: id } = metadata);
        message = '📄 **New Proposal** created by Community Multi-Sig';
        message += `\nDetails: https://compound.finance/governance/proposals/${id}${protocolVersionString}`;
        break;
      case 'AE-COMP-GOVERNANCE-PROPOSAL-EXECUTED-ALERT':
        ({ proposalId: id } = metadata);
        message = `👏 **Executed Proposal** #${id} by Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-GOVERNANCE-PROPOSAL-CANCELED-ALERT':
        ({ proposalId: id } = metadata);
        message = `❌ **Canceled Proposal**  #${id} by Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-GOVERNANCE-VOTE-CAST-ALERT':
        ({ proposalId: id } = metadata);
        message = `🗳️ **Vote Cast** on proposal #${id} by Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-GOVERNANCE-THRESHOLD-SET-ALERT':
        ({ oldThreshold, newThreshold } = metadata);
        message = `📶 **Proposal Threshold Changed** from ${oldThreshold} to ${newThreshold} by Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-GOVERNANCE-NEW-ADMIN-ALERT':
        ({ oldAdmin, newAdmin } = metadata);
        message = `🧑‍⚖️ **Admin Changed** from ${oldAdmin} to ${newAdmin} by Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-NEW-PAUSE-GUARDIAN-ALERT':
        ({ oldPauseGuardian, newPauseGuardian } = metadata);
        message = `⏸️ **Pause Guardian Changed** from ${oldPauseGuardian} to ${newPauseGuardian} by Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-ACTION-PAUSED-ALERT':
        ({ action } = metadata);
        message = `⏯️ **Pause on Action** ${action} by Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-NEW-BORROW-CAP-ALERT':
        ({ cToken, newBorrowCap } = metadata);
        cTokenFormatted = cToken.slice(0, 6);
        message = `🧢 **New Borrow Cap** for ${cTokenFormatted} set to ${newBorrowCap} by Community Multi-Sig${protocolVersionString}`;
        break;
      case 'AE-COMP-NEW-BORROW-CAP-GUARDIAN-ALERT':
        ({ oldBorrowCapGuardian, newBorrowCapGuardian } = metadata);
        message = `👲 **New Borrow Cap Guardian** changed from ${oldBorrowCapGuardian} to ${newBorrowCapGuardian} by Community Multi-Sig${protocolVersionString}`;
        break;
      default:
        message = `📄 **Governance action** taken by **Community Multi-Sig** address **${multisigAddressFormatted}${protocolVersionString}**`;
    }
    matches.push({
      hash: event.hash,
      metadata: { message, transactionLink }
    });
  });
  return { matches };
};
