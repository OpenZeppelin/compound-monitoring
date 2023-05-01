const axios = require('axios');

const tallyApiKey = 'f38a52dd428c9893d63862b60ebf94f3c0f1f93b117f35b9d0f48a0dd8fae616';
// const baseTallyUrl = 'https://api.tally.xyz/query';
const ethereumMainnetChainId = 'eip155:1';
const v2GovernorAddress = '0xc0da02939e1441f497fd74f78ce7decb17b66529';
const proposalId = 139;
const testVoter = '0x88fb3d509fc49b515bfeb04e23f53ba339563981';
async function main() {

  let displayName;

  const result = await axios.post(
    'https://api.tally.xyz/query',
    {"query":"query Accounts(\n$ids: [AccountID!],\n$addresses:[Address!]\n) {\naccounts(\nids: $ids,\naddresses: $addresses\n ) {\nid\naddress\nname}}",
      variables: {
        ids: [`${ethereumMainnetChainId  }:${  testVoter}`],
        addresses: ["0x88fb3d509fc49b515bfeb04e23f53ba339563981"],
      },
    },
    {
      headers: {
        'Api-Key': tallyApiKey,
      },
    },
  );
  // eslint-disable-next-line prefer-const
  displayName = result.data.data.accounts[0].name;
  
  console.log(`DISP: ${  displayName}`);
  // const tallyRes = await axios.post(
  //   'https://api.tally.xyz/query',
  //   {
  //     query: 'query Proposals($chainId: ChainID!,\n$governors: [Address!],\n$proposalIds: [ID!]) {\nproposals(\nchainId: $chainId,\ngovernors: $governors,\nproposalIds: $proposalIds,\n) {\nid\ntitle\ndescription\n},}',
  //     variables: {
  //       chainId: ethereumMainnetChainId,
  //       governors: [v2GovernorAddress],
  //       proposalIds: [proposalId],
  //     }
  //   },
  //   {
  //     headers: {
  //       'Api-Key': tallyApiKey,
  //     },
  //   },
  // );
  // console.log(tallyRes.status);
  // console.log('\n\n\nRESULT: %s', tallyRes.data.data.proposals[0].title);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
