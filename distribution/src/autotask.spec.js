// DEFENDER FORTA SENTINEL AUTOTASK TESTING //

const ethers = require('ethers');
const axios = require('axios');

// grab the existing keys before loading new content from the .env file
const existingKeys = Object.keys(process.env);
require('dotenv').config();

// now filter out all of the existing keys from what is currently in the process.env Object
const newKeys = Object.keys(process.env).filter((key) => existingKeys.indexOf(key) === -1);
const secrets = {};
newKeys.forEach((key) => {
  secrets[key] = process.env[key];
});

const autotaskConfig = require('../autotask-config.json');

const { jsonRpcUrl } = autotaskConfig;

// create a provider that will be injected as the Defender Relayer provider
const mockProvider = new ethers.providers.JsonRpcBatchProvider(jsonRpcUrl);
jest.mock('defender-relay-client/lib/ethers', () => ({
  DefenderRelayProvider: jest.fn().mockReturnValue(mockProvider),
}));

const { handler } = require('./autotask');

const fortaApiEndpoint = 'https://api.forta.network/graphql';

async function getFortaAlerts(agentId, startBlockNumber, endBlockNumber) {
  const headers = {
    'content-type': 'application/json',
  };

  const graphqlQuery = {
    operationName: 'recentAlerts',
    query: `query recentAlerts($input: AlertsInput) {
        alerts(input: $input) {
          pageInfo {
            hasNextPage
            endCursor {
              alertId
              blockNumber
            }
          }
          alerts {
            addresses
            alertId
            description
            hash
            name
            protocol
            scanNodeCount
            severity
            source {
                transactionHash
                agent {
                    id
                }
                block {
                    chainId
                    hash
                }
            }
            findingType
          }
        }
      }`,
    variables: {
      input: {
        first: 100,
        agents: [agentId],
        blockNumberRange: {
          startBlockNumber,
          endBlockNumber,
        },
        createdSince: 0,
        chainId: 1,
      },
    },
  };

  // perform the POST request
  const response = await axios({
    url: fortaApiEndpoint,
    method: 'post',
    headers,
    data: graphqlQuery,
  });

  const { data } = response;
  if (data === undefined) {
    return undefined;
  }

  const { data: { alerts: { alerts } } } = data;
  return alerts;
}

async function createFortaSentinelEvents(agentId, startBlockNumber, endBlockNumber) {
  const alerts = await getFortaAlerts(agentId, startBlockNumber, endBlockNumber);
  const autotaskEvents = alerts.map((alert) => {
    // augment the alert Object with additional fields
    // admittedly, there is some hand-waving here because we have to mock some of the Sentinel
    // fields that don't originate from the Forta Public API
    // e.g. We have to specify the alertId in the Sentinel to perform filtering on what we get from
    // the Forta Agent in the first place.
    /* eslint-disable no-param-reassign */
    alert.source.agent.name = 'N/A';
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
      agents: [agentId],
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
          hash: alert.hash, // forta Agent hash
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
  // get the development configuration values
  const { agentId, startBlockNumber, endBlockNumber } = autotaskConfig;

  // grab Forta Agent alerts from the Forta Public API and create autotaskEvents
  const autotaskEvents = await createFortaSentinelEvents(agentId, startBlockNumber, endBlockNumber);

  // run the autotask on the events
  const promises = autotaskEvents.map((autotaskEvent) => handler(autotaskEvent));

  await Promise.all(promises);
});
