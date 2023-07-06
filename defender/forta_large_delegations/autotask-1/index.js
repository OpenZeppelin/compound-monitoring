function getUrl(scopedSecrets, source) {
  if (!scopedSecrets || !source) return;
  const { block, transactionHash } = source;
  if (!block || !transactionHash) return;
  const { chainId } = block;
  if (!chainId) return;
  // eslint-disable-next-line dot-notation
  let mapping = scopedSecrets['NetworkBlockexplorerMapping'];
  if (!mapping) return;
  try {
    mapping = JSON.parse(mapping);
  } catch (e) { return; }
  const path = mapping?.[chainId];
  if (!path) return;
  // eslint-disable-next-line consistent-return
  return `${path}${transactionHash}`;
}

// eslint-disable-next-line func-names
exports.handler = async function (payload) {
  const matches = [];
  payload.request.body.events?.forEach((event) => {
    const { source, metadata, hash } = event.alert;
    const transactionLink = getUrl(payload.secrets, source) ?? `https://explorer.forta.network/alert/${hash}`;    
    if (metadata === undefined) {
      throw new Error('metadata undefined');
    }

    // Start of usual modifications to the autotask script
    // extract the metadata
    const {
      delegateAddress,
      levelName,
    } = metadata;
    if (delegateAddress === undefined) {
      throw new Error('delegateAddress undefined');
    }
    const delegateFormatted = delegateAddress.slice(0, 6);

    const message = `${transactionLink} 💸 **${delegateFormatted}** has been delegated  enough **COMP** tokens to pass min threshold for the governance event: **${levelName}**`;
    matches.push({
      hash: event.hash,
      metadata: { message, transactionLink },
    });
  });
  return { matches };
};