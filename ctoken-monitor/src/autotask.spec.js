const {
  Finding, FindingType, FindingSeverity,
} = require('forta-agent');

// Mock the data from the Bot finding
const mockRedeemMeta = {
  cTokenSymbol: "cDAI",
  contractAddress: "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643",
  eventName: "Redeem",
  redeemAmount: "229055296840622222476",
  redeemTokens: "1040572823132",
  redeemer: "0xb65Ca07fD529f891A14d5Df72CCCD915A59AafF9"
};

const mockBlockHash = '0x1110890564dbd87ca848b7107487ae5a7d28da1b16707bccd3ba37381ae33419';
const mockTxHash = '0xb85bbcdfd06edf6bcaa3271e49a339cc878daa30ec5f987a43a4d11d925ba751';

// grab the existing keys before loading new content from the .env file
const existingKeys = Object.keys(process.env);
// eslint-disable-next-line import/no-unresolved
require('dotenv').config();

// now filter out all of the existing keys from what is currently in the process.env Object
const newKeys = Object.keys(process.env).filter((key) => existingKeys.indexOf(key) === -1);
const secrets = {};
newKeys.forEach((key) => {
  secrets[key] = process.env[key];
});

const { handler } = require('./autotask');


function createFinding(metadata) {
  return Finding.fromObject({
    name: 'Placeholder Alert',
    description: 'Placeholder description',
    alertId: 'AE-ALERT-ID',
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    protocol: 'Protocol',
    metadata,
  });
}

function createFortaSentinelEvent(finding, blockHash, tryTxHash) {
  // Generally findings go from the Bot, to Scan Node, to Sentinel, to Autotasks
  //  with some metadata being added and removed along the way. This function will mimic
  // the Sentinel output with only Finding, block and transaction data.

  // Note: Much of the extra data here is superfluous but is left here just in case future bots
  // want to reference any of the Sentinel data in the Discord output. It also mimics sentinel
  // output more accurately.

  // On block events, the txHash does not exist
  let txHash;
  if (tryTxHash === undefined || tryTxHash === null) {
    txHash = '';
  } else {
    txHash = tryTxHash;
  }

  // populate the matchReasons Array with placeholders
  const matchReasons = [
    {
      type: 'alert-id',
      value: 'ALERT_ID_PLACEHOLDER',
    },
    {
      type: 'severity',
      value: 'INFO',
    },
  ];

  // populate the sentinel Object with placeholders
  const sentinel = {
    id: '8fe3d50b-9b52-44ff-b3fd-a304c66e1e56',
    name: 'Sentinel Name Placeholder',
    addresses: [],
    agents: [],
    network: 'mainnet',
    chainId: 1,
  };

  const autotaskEvent = {
    relayerARN: undefined,
    kvstoreARN: undefined,
    credentials: undefined,
    tenantId: undefined,
    secrets,
    request: {
      body: {
        hash: '0xAGENT-HASH', // forta Agent hash
        alert: {
          metadata: finding.metadata,
        },
        source: {
          transactionHash: txHash,
          block: {
            hash: blockHash,
          },
        },
        matchReasons,
        sentinel,
        type: 'FORTA',
      },
    },
  };
  return autotaskEvent;
}

describe('check autotask', () => {
  it('Runs autotask against mock data and posts in Discord (manual-check)', async () => {
    const mockFinding = createFinding(mockRedeemMeta);
    const autotaskEvent = createFortaSentinelEvent(mockFinding, mockBlockHash, mockTxHash);

    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('throws error if discordUrl is not valid', async () => {
    // Use an invalid discord URL
    secrets.discordUrl = 'http//zzzz';
    const autotaskEvent = createFortaSentinelEvent(mockFinding, mockBlockHash, mockTxHash);

    // run the autotask on the events
    await expect(handler(autotaskEvent)).rejects.toThrow('discordUrl is not a valid URL');
  });
});
