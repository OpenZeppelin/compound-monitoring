const stackName = 'datadog_forta_bot_alerts';
const datadogSecretName = `${stackName}_datadogApiKey`;

/* eslint-disable import/no-unresolved,import/no-extraneous-dependencies */
const axios = require('axios');
const { KeyValueStoreClient } = require('defender-kvstore-client');
/* eslint-enable import/no-unresolved,import/no-extraneous-dependencies */

// this value was retrieved from the Forta Explorer front-end
// it corresponds to 05-DEC-2021, presumably the launch date of Forta Explorer
const fortaExplorerEarliestTimestamp = 1638721490212;

const botIdsToNames = {
  '0xe49ab07879658c258d5007ac6b88428a2b88cc5cfef206222ad94690840be87a': 'Low Liquidity Attack',
  '0xb6bdedbae67cc82e60aad02a8ffab3ccbefeaa876ca7e4f291c07c798a95e339': 'Large Borrows Governance',
  '0x2e7f036f3495fec41a3eabae03b3efd378f6834bbb2976b99dfed6d3c7de7458': 'Community Multi-Sig',
  '0x0d3cdcc2757cd7837e3b302a9889c854044a80835562dc8060d7c163fbb69d53': 'Large Delegations',
  '0x32facccd163300ad76c7fe88b559b812dca9050a569417b42fced95594dda08e': 'Oracle Price',
  '0xfa3044aa08927163ff8578fb5c108978dfde3a12e0b21834e53111e2859f3a59': 'Underlying Asset',
  '0xab39733ddf86340b8e7940ebb933bb48506a341485c7f8c77da17bc1400fe028': 'Market Activity',
  '0xa0424dfee87cc34b9ff6a1dfa2cb22dbf1b20a238698ae0eeffbf07f869e5b39': 'Governance Activity',
};

const botIds = Object.keys(botIdsToNames);

const fortaExplorerApiEndpoint = 'https://explorer-api.forta.network/graphql';
const datadogEventsApiEndpoint = 'https://api.datadoghq.com/api/v1/events';

// extract relevant information from the Forta Explorer response and create an Object that can
// be submitted to the Datadog Events API endpoint
function parseAlertsResponse(response) {
  const { data: { data: { getList: { alerts } } } } = response;
  const newAlerts = alerts.map((alert) => {
    const {
      protocol,
      alertId: aggregationKey,
      description: text,
      severity,
      source: {
        agent: {
          id: botId,
        },
        block: {
          timestamp,
        },
      },
    } = alert;

    const title = botIdsToNames[botId];

    const output = {
      date_happened: (new Date(timestamp).valueOf()) / 1000,
      host: title,
      tags: [
        `botid:${botId}`,
        `protocol:${protocol}`,
        `severity:${severity}`,
        'version:4',
      ],
      text,
      aggregation_key: aggregationKey,
      title,
    };
    return output;
  });
  return newAlerts;
}

// this appears to query for previous alerts emitted by a Bot
// this data is then displayed in a table view titled 'Alerts' on the bottom of the Forta Explorer
// page for the Bot
function createAlertsQuery(botId, currentTimestamp, lastUpdateTimestamp) {
  const graphqlQuery = {
    query: `query ($getListInput: GetAlertsInput) {
      getList(input: $getListInput) {
        alerts {
          hash
          description
          severity
          protocol
          name
          everest_id
          alert_id
          scanner_count
          source {
            tx_hash
            agent {
              id
              name
            }
            block {
              chain_id
              number
              timestamp
            }
          }
          projects {
            id
            name
          }
        }
        nextPageValues {
          timestamp
          id
        }
        currentPageValues {
          timestamp
          id
        }
      }
    }`,
    variables: {
      getListInput: {
        severity: [],
        startDate: (lastUpdateTimestamp + 1).toString(),
        endDate: currentTimestamp.toString(),
        txHash: '',
        text: '',
        muted: [],
        sort: 'desc',
        agents: [botId],
        addresses: [],
        project: '',
      },
    },
  };
  return graphqlQuery;
}

async function postQuery(graphqlQuery) {
  const headers = {
    'content-type': 'application/json',
  };

  // perform the POST request
  const response = await axios({
    url: fortaExplorerApiEndpoint,
    method: 'post',
    headers,
    data: graphqlQuery,
  });

  return response;
}

async function postToDatadog(data, apiKey, url) {
  const headers = {
    'Content-Type': 'application/json',
    'DD-API-KEY': apiKey,
  };

  // perform the POST request
  const response = await axios({
    url,
    method: 'post',
    headers,
    data,
  });

  return response;
}

// entry point for autotask
// eslint-disable-next-line func-names
exports.handler = async function (autotaskEvent) {
  // get the current timestamp once
  // this value will be used across all queries to determine how much data to
  // retrieve
  const currentTimestamp = (new Date()).getTime();
  console.debug(`currentTimestamp: ${currentTimestamp.toString()}`);

  console.debug(JSON.stringify(autotaskEvent, null, 2));

  const { secrets } = autotaskEvent;
  if (secrets === undefined) {
    throw new Error('secrets undefined');
  }

  // ensure that there is a datadogApiKey secret
  const datadogApiKey = secrets[datadogSecretName];
  if (datadogApiKey === undefined) {
    throw new Error('datadogApiKey undefined');
  }

  const store = new KeyValueStoreClient(autotaskEvent);

  // load the latest timestamp that was stored
  let lastUpdateTimestamp = await store.get('lastUpdateTimestampAlerts');

  // the first time this Autotask is executed, we will need to manually set the value
  // of the last timestamp
  if (lastUpdateTimestamp === undefined || lastUpdateTimestamp === null) {
    console.debug('Autotask run for the first time, initializing lastUpdateTimestamp');
    lastUpdateTimestamp = fortaExplorerEarliestTimestamp;
  } else {
    console.debug('Retrieving existing value for lastUpdateTimestamp');
    lastUpdateTimestamp = parseInt(lastUpdateTimestamp, 10);
    console.debug(lastUpdateTimestamp);
  }
  console.debug(`lastUpdateTimestamp: ${lastUpdateTimestamp.toString()}`);

  const promises = botIds.map(async (botId) => {
    const output = { botId };
    const alertsQuery = createAlertsQuery(botId, currentTimestamp, lastUpdateTimestamp);
    const alertsResponse = await postQuery(alertsQuery);
    const alerts = parseAlertsResponse(alertsResponse);
    // if there weren't any alerts, don't forward anything
    if (alerts.length !== 0) {
      console.debug(`Alerts found for botId ${botId}: ${alerts.length}`);
      output.alerts = alerts;
    } else {
      console.debug(`NO alerts found for botId ${botId}`);
    }
    return output;
  });

  const results = await Promise.all(promises);

  // store the updated timestamp
  console.debug(`Storing new value for lastUpdateTimestamp: ${currentTimestamp.toString()}`);
  await store.put('lastUpdateTimestampAlerts', currentTimestamp.toString());

  const data = results.filter((result) => Object.keys(result).length > 1);

  // check for available metrics
  const alertsPromises = data.map(async (output) => {
    const { alerts } = output;
    if (alerts !== undefined) {
      const innerPromises = alerts.map(async (alert) => {
        console.debug(JSON.stringify(alert, null, 2));
        // post to Datadog
        return postToDatadog(alert, datadogApiKey, datadogEventsApiEndpoint);
      });
      await Promise.all(innerPromises);
    } else {
      console.debug('alerts is undefined');
    }
  });

  await Promise.all(alertsPromises);

  return {};
};
