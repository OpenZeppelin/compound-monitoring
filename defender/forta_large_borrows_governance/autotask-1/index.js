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
    throw new Error('Autotask payload undefined');
  }

  const { secrets } = payload;
  if (secrets === undefined) {
    throw new Error('secrets undefined');
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
      borrowerAddress,
      governanceLevel,
      protocolVersion,
    } = metadata;
    if (borrowerAddress === undefined) {
      throw new Error('borrowerAddress undefined');
    }
    const borrowerFormatted = borrowerAddress.slice(0, 6);

    // Handle older alerts which don't specify the protocol version
    let versionString = '';
    if (protocolVersion !== undefined) {
      versionString = ` (Compound v${protocolVersion})`;
    }
    const message = `${transactionLink} 💸 **${borrowerFormatted}** has borrowed enough **COMP** tokens to pass min threshold for the governance event: **${governanceLevel}**${versionString} `;
    console.log(message);

    matches.push({
      hash: event.hash,
      metadata: { message, transactionLink },
    });
  });

  return { matches };
};
