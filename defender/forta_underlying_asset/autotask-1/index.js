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
// eslint-disable-next-line func-names
exports.handler = async function (payload) {
  // ensure that the autotaskEvent Object exists
  if (payload === undefined) {
    throw new Error('Payload undefined');
  }

  const { secrets } = autotaskEvent;
  if (secrets === undefined) {
    throw new Error('Secrets undefined');
  }

  const matches = [];
  payload.request.body.events?.forEach((event) => {
    const { alertId, source, metadata, hash } = event.alert;
    const transactionLink = getUrl(payload.secrets, source) ?? `https://explorer.forta.network/alert/${hash}`;
    if (metadata === undefined) {
      throw new Error('metadata undefined');
    }

    // Start of usual modifications to the autotask script
    // extract the metadata
    const {
      cTokenSymbol,
      protocolVersion,
    } = metadata;
    if (cTokenSymbol === undefined) {
      throw new Error('cTokenSymbol undefined');
    }

    if (cTokenSymbol === undefined) {
      throw new Error('cTokenSymbol undefined');
    }

    // Handle older alerts which don't specify the protocol version
    let versionString = '';
    if (protocolVersion !== undefined) {
      versionString = ` (Compound v${protocolVersion})`;
    }

    const message = `${transactionLink} 🆙 Underlying asset for the **${cTokenSymbol}** cToken contract was upgraded${versionString}`;

    // create promises for posting messages to Discord webhook
    // with Log Forwarding enabled, this console.log will forward the text string to Dune Analytics
    console.log(message);
    matches.push({
      hash: event.hash,
      metadata: { message, transactionLink },
    });
  });
  return { matches };
};
