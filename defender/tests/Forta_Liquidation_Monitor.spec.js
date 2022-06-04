jest.mock('axios', () => jest.fn());
const axios = require('axios');

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

const { handler } = require('../downloaded/Forta_Liquidation_Monitor');

const blockHash = '0xFAKEBLOCKHASH';
const transactionHash = '0xb85bbcdfd06edf6bcaa3271e49a339cc878daa30ec5f987a43a4d11d925ba751';
const borrowerAddress = '0x0000000000000000000000000000000000000000';

const mockFortaAlert = {
  data: {
    data: {
      alerts: {
        pageInfo: {
          hasNextPage: false,
          endCursor: {
            alertId: 'AE-COMP-LIQUIDATION-THRESHOLD',
            blockNumber: 0,
          },
        },
        alerts: [
          {
            createdAt: '2022-03-31T22:02:20.812799122Z',
            name: 'Compound Liquidation Threshold Alert',
            protocol: 'Compound',
            findingType: 'Info',
            hash: '0xcee8d4bd1c065260acdcfa51c955fc29c984145de2769b685f29701b6edf318f',
            alertId: 'AE-COMP-LIQUIDATION-THRESHOLD',
            source: {
              transactionHash,
              block: {
                number: 14496506,
                chainId: 1,
                hash: blockHash,
              },
              bot: {
                id: '0x3f02bee8b17edc945c5c1438015aede79225ac69c46e9cd6cff679bb71f35576',
              },
            },
            severity: 'Info',
            metadata: {
              borrowerAddress,
              liquidationAmount: '1000.00',
              shortfallAmount: '1000.00',
              healthFactor: '0.80',
            },
            description: 'The address 0x1111 has dropped below the liquidation threshold. The account may be liquidated for: $515.15 USD',
          },
        ],
      },
    },
  },
};

function createFortaSentinelEvents(botId) {
  // Generally findings go from the Bot, to Scan Node, to Sentinel, to Autotasks
  //  with some metadata being added and removed along the way. This function will mimic
  // the Sentinel output with only Finding, block and transaction data.

  // Note: Much of the extra data here is superfluous but is left here just in case future bots
  // want to reference any of the Sentinel data in the Discord output. It also mimics sentinel
  // output more accurately.
  const { alerts } = mockFortaAlert.data.data.alerts;
  const autotaskEvents = alerts.map((alert) => {
    // augment the alert Object with additional fields
    // admittedly, there is some hand-waving here because we have to mock some of the Sentinel
    // fields that don't originate from the Forta Public API
    // e.g. We have to specify the alertId in the Sentinel to perform filtering on what we get from
    // the Forta Bot in the first place.
    /* eslint-disable no-param-reassign */
    alert.source.bot.name = 'N/A';
    alert.alert_id = alert.alertId;
    alert.alertType = 'TX';
    alert.type = 'INFORMATION';
    alert.scanNodeCount = 1;
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

describe('check autotask', () => {
  it('Runs autotask against mock data and posts in Discord (manual-check)', async () => {
    const results = [];
    const mockBotId = '0x12345';
    const autotaskEvents = createFortaSentinelEvents(mockBotId);

    // pass the mocked Forta Bot alert into the function that will emulate a Forta Sentinel alert
    // update the axios mock in preparation for capturing the Discord POST request
    axios.mockImplementationOnce((arg0) => results.push(arg0));

    // run the autotask on the events
    const promises = autotaskEvents.map((autotaskEvent) => handler(autotaskEvent));

    await Promise.all(promises);

    const expectedResults = [
      {
        url: 'https://discord.com/api/webhooks/963891500897423360/Zx8MzPcEfFPDoqpOjGXoBu3303FPvj0NAX4pHUsOll3G5N2TlaThiQUOUDfyQm0tWhiP',
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: `[BLOCK](<https://etherscan.io/block/${blockHash}>) - [ACCT](<https://etherscan.io/address/${borrowerAddress}>) 📉💵🔥 **Liquidatable account detected** account 0x0000 is liquidatable for $1000.00`,
        },
      },
    ];

    expect(results).toStrictEqual(expectedResults);
  });

  it('throws error if discordUrl is not valid', async () => {
    // Use an invalid discord URL
    secrets.discordUrl = 'http//zzzz';
    const mockBotId = '0x12345';
    const autotaskEvents = createFortaSentinelEvents(mockBotId);

    // run the autotask on the events
    await expect(handler(autotaskEvents[0])).rejects.toEqual(new Error('discordUrl is not a valid URL'));
  });
});
