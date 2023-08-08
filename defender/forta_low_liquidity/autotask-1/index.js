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
exports.handler = async function (payload) {
  const matches = [];
  payload.request.body.events?.forEach(event => {
    const { alertId, source, metadata, hash } = event.alert;
    const transactionLink = getUrl(payload.secrets, source) ?? `https://explorer.forta.network/alert/${hash}`;
    if (metadata === undefined) {
      throw new Error('metadata undefined');
    }
    // Start of usual modifications to the autotask script
    // extract the metadata
    const {
      compTokenSymbol,
      maliciousAddress,
      protocolVersion,
    } = metadata;
    if (maliciousAddress === undefined) {
      throw new Error('maliciousAddress undefined');
    }
    // Handle older alerts which don't specify the protocol version
    let versionString = '';
    if (protocolVersion !== undefined) {
      versionString = ` (Compound v${protocolVersion})`;
    }
    const maliciousAddressFormatted = maliciousAddress.slice(0, 6);
    const message = `The address ${maliciousAddressFormatted} is potentially manipulating the cToken ${compTokenSymbol} market${versionString}`;
    matches.push({
      hash: event.hash,
      metadata: { message, transactionLink }
    });
  });
  return { matches };
};