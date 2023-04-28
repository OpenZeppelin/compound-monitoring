const axios = require('axios');

const tallyApiKey = 'f38a52dd428c9893d63862b60ebf94f3c0f1f93b117f35b9d0f48a0dd8fae616';
// const baseTallyUrl = 'https://api.tally.xyz/query';
const ethereumMainnetChainId = 'eip155:1';
const v2GovernorAddress = '0xc0da02939e1441f497fd74f78ce7decb17b66529';
const proposalId = 139;

async function main() {
  const tallyRes = await axios.post(
    'https://api.tally.xyz/query',
    {
      query: 'query Proposals($chainId: ChainID!,\n$governors: [Address!],\n$proposalIds: [ID!]) {\nproposals(\nchainId: $chainId,\ngovernors: $governors,\nproposalIds: $proposalIds,\n) {\nid\ntitle\ndescription\n},}',
      variables: {
        chainId: ethereumMainnetChainId,
        governors: [v2GovernorAddress],
        proposalIds: [proposalId],
      }
    },
    {
      headers: {
        'Api-Key': tallyApiKey,
      },
    },
  );
  console.log(tallyRes.status);
  console.log('\n\n\nRESULT: %s', tallyRes.data.data.proposals[0].title);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
