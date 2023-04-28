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
      query: `query ($chainId: ChainID!, 
              $governors: [Address!],
              $proposalIds: [ID!]) {
                proposals(
                             chainId: $chainId,
                             governors: $governors,
                             proposalIds: $proposalIds,
                           ) {
                                      id
                                      title
                                      description
                                      }
            }
          }`,
      variables: {
        chainId: ethereumMainnetChainId,
        governors: [v2GovernorAddress],
        proposalIds: [proposalId],
      },
    },
    {
      headers: {
        'Api-Key': tallyApiKey,
      },
    },
  );
  await Promise.all(tallyRes);
  console.log(tallyRes.data.error);
  // const result = await axios.post(
  //   baseTallyUrl,
  //   {
  //     query: `query ProposalTitle(
  //       $chainId: ChainID!, 
  //       $governors: [Address!],
  //       $proposalIds: [ID!]) {
  //       proposals(
  //           chainId: $chainId,
  //           governors: $governors,
  //           proposalIds: $proposalIds,
  //         ) {
  //           id
  //           title
  //           description
  //           }
  //         }
  //       }`,
  //     variables: {
  //       chainIds: ethereumMainnetChainId,
  //       governors: [v2GovernorAddress],
  //       proposalIds: [proposalId],
  //     },
  //   },
  //   {
  //     headers: {
  //       'Api-Key': tallyApiKey,
  //     },
  //   },
  // );
  // console.log(result.data);
  //   const { title } = result.data.proposals[0];

//   console.log(result);
//   console.log(title);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
