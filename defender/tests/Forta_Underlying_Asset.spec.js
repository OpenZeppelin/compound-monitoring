jest.mock('axios', () => jest.fn());
const axios = require('axios');

const { handler } = require('../downloaded/Forta_Underlying_Asset');

// grab the existing keys before loading new content from the .env file
const existingKeys = Object.keys(process.env);
require('dotenv').config();

// now filter out all of the existing keys from what is currently in the process.env Object
const newKeys = Object.keys(process.env).filter((key) => existingKeys.indexOf(key) === -1);
const secrets = {};
newKeys.forEach((key) => {
  secrets[key] = process.env[key];
});

const cTokenSymbol = 'AAVE';

const transactionHash = '0xaaec8f4fcb423b5190b8d78b9595376ca34aee8a50c7e3250b3a9e79688b734b';

const mockFortaAlert = {
  data: {
    data: {
      alerts: {
        pageInfo: {
          hasNextPage: false,
          endCursor: {
            alertId: 'AE-COMP-CTOKEN-ASSET-UPGRADED',
            blockNumber: 0,
          },
        },
        alerts: [
          {
            createdAt: '2022-03-31T22:02:20.812799122Z',
            name: 'Compound cToken Asset Upgraded',
            protocol: 'Compound',
            findingType: 'INFORMATION',
            hash: '0xcee8d4bd1c065260acdcfa51c955fc29c984145de2769b685f29701b6edf318f',
            alertId: 'AE-COMP-CTOKEN-ASSET-UPGRADED',
            source: {
              transactionHash,
              block: {
                number: 14496506,
                chainId: 1,
              },
              bot: {
                id: '0x3f02bee8b17edc945c5c1438015aede79225ac69c46e9cd6cff679bb71f35576',
              },
            },
            severity: 'INFO',
            metadata: {
              cTokenSymbol: 'AAVE',
              cTokenAddress: '0xAC6A6388691F564Cb69e4082E2bd4e347A978bF9',
              underlyingAssetAddress: '0xAC6A6388691F564Cb69e4082E2bd4e347A978bF6',
            },
            description: `The underlying asset for the ${cTokenSymbol} cToken contract was upgraded`,
          },
        ],
      },
    },
  },
};

// create a provider that will be injected as the Defender Relayer provider
const mockProvider = jest.fn();
jest.mock('defender-relay-client/lib/ethers', () => ({
  DefenderRelayProvider: jest.fn().mockReturnValue(mockProvider),
}));

function createFortaSentinelEvents(botId) {
  const { alerts } = mockFortaAlert.data.data.alerts;
  const autotaskEvents = alerts.map((alert) => {
    // augment the alert Object with additional fields
    // admittedly, there is some hand-waving here because we have to mock some of the Sentinel
    // fields that don't originate from the Forta Public API
    // e.g. We have to specify the alertId in the Sentinel to perform filtering on what we get from
    // the Forta Bot in the first place.
    /* eslint-disable no-param-reassign */
    alert.source.bot.name = 'N/A';
    alert.source.block.chain_id = alert.source.block.chainId;
    alert.source.tx_hash = alert.source.transactionHash;
    alert.alertType = 'TX';
    alert.alert_id = 'ALERT_ID_PLACEHOLDER';
    alert.type = 'INFORMATION';
    alert.scanner_count = 1;
    /* eslint-enable no-param-reassign */

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
    // none of these are currently checked by any Autotasks in use
    const sentinel = {
      id: '8fe3d50b-9b52-44ff-b3fd-a304c66e1e56',
      name: 'Sentinel Name Placeholder',
      addresses: [],
      bots: [botId],
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
          hash: alert.hash, // forta Bot hash
          alert,
          matchReasons,
          sentinel,
          type: 'FORTA',
        },
      },
    };
    return autotaskEvent;
  });

  return autotaskEvents;
}

it('Runs autotask against blocks in configuration file', async () => {
  const results = [];
  const mockBotId = '0x12345';
  const autotaskEvents = createFortaSentinelEvents(mockBotId);

  // pass the mocked Forta Bot alert into the function that will emulate a Forta Sentinel alert
  // update the axios mock in preparation for capturing the Discord POST request
  axios.post = jest.fn().mockResolvedValue(mockFortaAlert);
  axios.mockImplementation((arg0) => { results.push(arg0); });

  // run the autotask on the events
  const promises = autotaskEvents.map((autotaskEvent) => handler(autotaskEvent));

  await Promise.all(promises);

  const expectedResults = [{
    url: secrets.SecurityAlertsDiscordUrl,
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      content: `[TX](<https://etherscan.io/tx/${transactionHash}>) 🆙 Underlying asset for the **AAVE** cToken contract was upgraded`,
    },
  }];

  expect(results).toStrictEqual(expectedResults);
});
