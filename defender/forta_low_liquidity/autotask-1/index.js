
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
  const path = mapping?.[chainId];
  if (!path) return;
  return `${path}${transactionHash}`;
}

// eslint-disable-next-line func-names
exports.handler = async function (payload) {
  const scopedSecrets = new ScopedSecretsProvider(payload);
  const matches = [];

  // Safety boilerplate:
  if (payload === undefined) {
    throw new Error('autotaskEvent undefined');
  }
  const { secrets } = payload;
  if (secrets === undefined) {
    throw new Error('secrets undefined');
  }
  // ensure that the request key exists within the autotaskEvent Object
  const { request } = payload;
  if (request === undefined) {
    throw new Error('request undefined');
  }

  // ensure that the body key exists within the request Object
  const { body } = request;
  if (body === undefined) {
    throw new Error('body undefined');
  }

  // ensure that the alert key exists within the body Object
  const { alert } = body;
  if (alert === undefined) {
    throw new Error('alert undefined');
  }

  // ensure that the alert key exists within the body Object
  const { source } = body;
  if (source === undefined) {
    throw new Error('source undefined');
  }

  // extract the metadata from the alert Object
  const { metadata } = alert;
  if (metadata === undefined) {
    throw new Error('metadata undefined');
  }

  payload.request.body.events?.forEach((event) => {
    const { hash } = event.alert;
    const transactionLink = getUrl(scopedSecrets, source) ?? `https://explorer.forta.network/alert/${hash}`;
    if (metadata === undefined) {
      throw new Error('metadata undefined');
    }

    let protocolVersionString = metadata.protocolVersion;
    if (protocolVersionString === undefined) {
      protocolVersionString = 'undefined';
    }

    const {
      compTokenSymbol,
      maliciousAddress,
    } = metadata;
    if (maliciousAddress === undefined) {
      throw new Error('maliciousAddress undefined');
    }

    const maliciousAddressFormatted = maliciousAddress.slice(0, 6);

    const message = `${transactionLink} The address ${maliciousAddressFormatted} is potentially manipulating the cToken ${compTokenSymbol} market on protocolVersion ${protocolVersionString}`;

    console.log(message);
    matches.push({
      hash: event.hash,
      metadata: { message, transactionLink },
    });
  });

  return { matches };
};
