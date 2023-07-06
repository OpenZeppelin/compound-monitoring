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
    // Start of usual modifications to the autotask script
    // extract the metadata
    const {
      underlyingTokenAddress,
      protocolVersion,
    } = metadata;
    if (underlyingTokenAddress === undefined) {
      throw new Error('underlyingTokenAddress undefined');
    }

    // Handle older alerts which don't specify the protocol version
    let versionString = '';
    if (protocolVersion !== undefined) {
      versionString = ` (Compound v${protocolVersion})`;
    }
    const underlyingAddressFormatted = underlyingTokenAddress.slice(0, 6);
    const message = `🚫 Reported price of **${underlyingAddressFormatted}** was **rejected**${versionString}`;
    matches.push({
      hash: event.hash,
      metadata: { message, transactionLink }
    });
  });
  return { matches };
};
