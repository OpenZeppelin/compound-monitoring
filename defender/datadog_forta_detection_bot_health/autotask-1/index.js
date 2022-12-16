const stackName = 'datadog_forta_detection_bot_health';
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
const datadogApiEndpoint = 'https://api.datadoghq.com/api/v2/series';

function camelize(str, delimiter) {
  let output = '';
  str.split(delimiter).forEach((element, index) => {
    const add = element.toLowerCase();
    if (index === 0) {
      output += add;
    } else {
      output += add[0].toUpperCase() + add.slice(1);
    }
  });
  return output;
}

function parseAgentInformationResponse(response) {
  const { data: { data: { getAgentInformation } } } = response;

  const output = {};
  Object.entries(getAgentInformation[0]).forEach(([key, value]) => {
    const newKey = camelize(key, '_');
    output[newKey] = value;
  });

  return output;
}

function parseMetricsResponse(response, currentTimestamp) {
  // const { data: { data: { getAgentMetrics: { metrics } } } } = response;
  const { data: { data: { getAgentMetrics: { chains: [{ metrics }] } } } } = response;
  const output = {};
  metrics.forEach((metric) => {
    // convert the name of the metric to lowerCamelCase
    const key = camelize(metric.key, '.');
    // create an entry in the Object for the corresponding value
    output[key] = {};
    metric.scanners.forEach((scanner) => {
      // scanner id
      const scannerId = scanner.key;
      const records = scanner.interval;

      // don't filter records
      // sum the sums and take the maximum of the maximums
      let sum = 0;
      let max = 0;
      records.forEach((record) => {
        sum += parseInt(record.sum, 10);
        const temp = parseInt(record.max, 10);
        if (temp > max) {
          max = temp;
        }
      });

      // actual data
      //   timestamp: Epoch timestamp
      //   sum: sum of metric over the interval
      //   max: maximum of metric over the interval
      if (records.length > 0) {
        output[key][scannerId] = [{
          timestamp: Math.floor(currentTimestamp / 1000),
          sum,
          max,
        }];
      }
    });

    if (Object.keys(output[key]).length === 0) {
      delete output[key];
    }
  });
  return output;
}

// this query gathers information used to populate fields on the page for the Bot
// specifically, this contains data such as the Bot ID, Image, Last Updated, Enabled, etc.
function createAgentInformationQuery(id) {
  const graphqlQuery = {
    operationName: 'Retrieve',
    query: `query Retrieve($getAgentInput: AgentInformation) {
      getAgentInformation(input: $getAgentInput) {
        id
        name
        developer
        chainIds
        projects
        created_at
        updated_at
        description
        version
        repository
        enabled
        image
        manifest_ipfs
        doc_ipfs
      }
    }`,
    variables: {
      getAgentInput: {
        id,
      },
    },
  };
  return graphqlQuery;
}

// timeFrame values: 'hour', 'day', 'week', 'month'
function createMetricsQuery(agentId, timeFrame) {
  const graphqlQuery = {
    query: `query ($getAgentMetricsInput: GetAgentMetricsInput) {
      getAgentMetrics(input: $getAgentMetricsInput) {
        chains {
          chain_id
          metrics {
            key
            scanners {
              key
              interval {
                key
                sum
                max
              }
            }
          }
        }
      }
    }`,
    variables: {
      getAgentMetricsInput: {
        agentId,
        timeFrame,
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

  console.debug('Forta Explorer API Endpoint Response Received');
  return response;
}

async function postToDatadog(data, apiKey) {
  const headers = {
    'Content-Type': 'application/json',
    'DD-API-KEY': apiKey,
  };

  // perform the POST request
  const response = await axios({
    url: datadogApiEndpoint,
    method: 'post',
    headers,
    data,
  });

  return response;
}

function botChanged(information, agentInformation, botId) {
  // if a new botId was added to the Array of values
  if (agentInformation[botId] === undefined) {
    return true;
  }
  // if an entry exists in both but the updatedAt field value is different
  return (information.updatedAt !== agentInformation[botId].updatedAt);
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

  let firstRun = false;
  let agentInformationUpdated = false;

  const store = new KeyValueStoreClient(autotaskEvent);

  // this is an Object containing all information about all of the Bots
  // load the agent information from the previous Autotask execution
  let agentInformation = await store.get('agentInformationDD');
  if (agentInformation === undefined || agentInformation === null) {
    console.debug('Autotask run for the first time, initializing agentInformation');
    agentInformation = {};
  } else {
    agentInformation = JSON.parse(agentInformation);
    console.debug('Retrieved existing Bot information');
    console.debug(JSON.stringify(agentInformation, null, 2));
  }

  // load the latest timestamp that was stored
  let lastUpdateTimestamp = await store.get('lastUpdateTimestampDD');

  // the first time this Autotask is executed, we will need to manually set the value
  // of the last timestamp
  if (lastUpdateTimestamp === undefined || lastUpdateTimestamp === null) {
    console.debug('Autotask run for the first time, initializing lastUpdateTimestamp');
    firstRun = true;
    lastUpdateTimestamp = fortaExplorerEarliestTimestamp;
  } else {
    console.debug('Retrieving existing value for lastUpdateTimestamp');
    lastUpdateTimestamp = parseInt(lastUpdateTimestamp, 10);
    console.debug(lastUpdateTimestamp);
  }
  console.debug(`lastUpdateTimestamp: ${lastUpdateTimestamp.toString()}`);

  const timeFrame = 'hour';

  const promises = botIds.map(async (botId) => {
    const output = { botId };

    const agentInformationQuery = createAgentInformationQuery(botId);
    console.debug(JSON.stringify(agentInformationQuery, null, 2));
    const agentInformationResponse = await postQuery(agentInformationQuery);
    const information = parseAgentInformationResponse(agentInformationResponse);
    // only add the bot information if this is the first time we have executed the Autotask
    // or if the bot information has changed from what is stored
    if (firstRun === true || botChanged(information, agentInformation, botId)) {
      console.debug(`Updating Bot information for botId ${botId}`);
      // copy the new information to the output Object
      output.agentInformation = information;

      // also copy the new information for storing later
      agentInformation[botId] = information;

      // set the flag to true so that we will store the updated information
      agentInformationUpdated = true;
    }

    // this will likely be updated every time
    const metricsQuery = createMetricsQuery(botId, timeFrame);
    console.debug('Metrics query:');
    console.debug(JSON.stringify(metricsQuery, null, 2));
    const metricsResponse = await postQuery(metricsQuery);
    const metrics = parseMetricsResponse(
      metricsResponse,
      currentTimestamp,
    );
    if (Object.keys(metrics).length > 0) {
      console.debug(`Metrics found for botId ${botId}`);
      output.metrics = metrics;
    }

    return output;
  });

  const results = await Promise.all(promises);

  // if we made an update to the agentInformation Object, we need to store the updated Object
  if (agentInformationUpdated === true) {
    // values stored must be strings
    console.debug('agentInformation updated');
    console.debug(JSON.stringify(agentInformation, null, 2));
    await store.put('agentInformationDD', JSON.stringify(agentInformation));
  }

  // store the updated timestamp
  console.debug(`Storing new value for lastUpdateTimestamp: ${currentTimestamp.toString()}`);
  await store.put('lastUpdateTimestampDD', currentTimestamp.toString());

  const data = results.filter((result) => Object.keys(result).length > 1);

  // check for available metrics
  let metricsPromises = data.map(async (output) => {
    const { metrics, botId } = output;
    if (metrics !== undefined) {
      const series = [];
      Object.entries(metrics).map(([metricName, metricObject]) => {
        Object.entries(metricObject).map(([scannerId, scannerArray]) => {
          // scannerArray is an Array of Objects
          const points = scannerArray.map((dataObject) => {
            // extract the relevant data
            const { timestamp, sum } = dataObject;

            // create the Object that will be submitted to Datadog
            return { timestamp, value: sum };
          });

          if (points.length > 0) {
            series.push({
              metric: metricName,
              tags: [
                `botid:${botId}`,
                `scannerid:${scannerId}`,
                `botname:${botIdsToNames[botId]}`,
              ],
              type: 0,
              points,
            });
          }
          return undefined;
        });
        return undefined;
      });
      console.debug(JSON.stringify(series, null, 2));

      // post to Datadog
      return postToDatadog({ series }, datadogApiKey);
    }
    return undefined;
  });

  metricsPromises = metricsPromises.filter((value) => value !== undefined);

  await Promise.all(metricsPromises);

  return {};
};
