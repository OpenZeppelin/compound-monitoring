/* eslint-disable import/no-unresolved,import/no-extraneous-dependencies */
const axios = require('axios');
const { KeyValueStoreClient } = require('defender-kvstore-client');
/* eslint-enable import/no-unresolved,import/no-extraneous-dependencies */

// this value was retrieved from the Forta Explorer front-end
// it corresponds to 05-DEC-2021, presumably the launch date of Forta Explorer
const fortaExplorerEarliestTimestamp = 1638721490212;

const botIds = [
  '0x5a00b44b2db933d4c797e6bd3049abdeb89cc9ec1b2eaee7bdbaff911794f714', // Forta Low Liquidity Attack
  '0xb6bdedbae67cc82e60aad02a8ffab3ccbefeaa876ca7e4f291c07c798a95e339', // Forta Large Borrows Governance
  '0x916603512086fcad84c35858d2fc5356c512f72b19c80e52e8f9c04d8122e2ba', // Forta Multi-Sig Monitor
  '0x0d3cdcc2757cd7837e3b302a9889c854044a80835562dc8060d7c163fbb69d53', // Forta Large Delegations Monitor
  '0xe200d890a67d51c3610520dd9fdfa9e2bd6dd341d41e32fa457601e73c4c6685', // Forta Oracle Price Monitor
  '0xf836bda7810aa2dd9df5bb7ac748f173b945863e922a15bb7c57da7b0e6dab05', // Forta Underlying Asset Monitor
];

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

// this function is a bit odd, because it will not keep the most recent
// value, but the one BEFORE the most recent value
// this approach is necessary because requesting data from the last
// 'hour' will return results since the previous hour marker in the
// GraphQL database, NOT over the last 60 minutes
// for example, if we make a request at 1241 for the last hour, we
// will expect to receive two results, one for the hour of 1100-1200 and
// one for the range of 1200-1241 (now)
// the second result will only reflect a portion of the metrics, as
// the entire hour time range has not yet occurred.
// Therefore, we will always go back one time frame and retrieve that
// data value, NOT the current one
function parseMetricsResponse(response, currentTimestamp, timeFrame) {
  const { data: { data: { getAgentMetrics: { metrics } } } } = response;
  const output = {};
  metrics.forEach((metric) => {
    // convert the name of the metric to lowerCamelCase
    const key = camelize(metric.key, '.');
    // create an entry in the Object for the corresponding value
    output[key] = {};
    metric.scanners.forEach((scanner) => {
      // scanner id
      const scannerId = scanner.key;
      let records = scanner.interval;

      records = records.filter((record) => {
        const compValue = parseInt(record.key, 10);
        let timeOffsetMilliseconds;
        switch (timeFrame) {
          case 'hour':
            timeOffsetMilliseconds = 60 * 60 * 1000;
            break;
          case 'day':
            timeOffsetMilliseconds = 24 * 60 * 60 * 1000;
            break;
          case 'week':
            timeOffsetMilliseconds = 7 * 24 * 60 * 60 * 1000;
            break;
          case 'month':
            timeOffsetMilliseconds = 30 * 24 * 60 * 60 * 1000;
            break;
          default:
            timeOffsetMilliseconds = 0;
        }
        // do not keep any records that have a timestamp within
        // the timeframe compared to the last update timestamp
        if (currentTimestamp - compValue >= timeOffsetMilliseconds) {
          return true;
        }
        return false;
      });

      if (records.length > 0) {
        output[key][scannerId] = [];
      }

      // actual data
      //   key: Epoch timestamp, in milliseconds
      //   sum: sum of metric over the interval
      //   max: maximum of metric over the interval
      records.forEach((record) => {
        output[key][scannerId].push({
          timestamp: parseInt(record.key, 10),
          sum: parseInt(record.sum, 10),
          max: parseInt(record.max, 10),
        });
      });
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

function calculateTimeFrame(currentTimestamp, lastUpdateTimestamp) {
  // if this is the first time the Autotask has executed, gather data for the last month
  // on subsequent runs, set the time frame based on the previous timestamp and the current
  // timestamp
  const millisecondsPerHour = 60 * 60 * 1000;
  const millisecondsPerDay = millisecondsPerHour * 24;
  const millisecondsPerWeek = millisecondsPerDay * 7;

  // set the time frame based on the previous timestamp and the current timestamp
  const deltaTimestamp = currentTimestamp - lastUpdateTimestamp;
  if (deltaTimestamp <= millisecondsPerHour) {
    return 'hour';
  } if (deltaTimestamp <= millisecondsPerDay) {
    return 'day';
  } if (deltaTimestamp <= millisecondsPerWeek) {
    return 'week';
  }
  return 'month';
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

  const { DatadogApiKey: datadogApiKey } = secrets;
  if (datadogApiKey === undefined) {
    throw new Error('Datadog API key undefined');
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

  // set the time frame based upon when this Autotask was last executed
  const timeFrame = calculateTimeFrame(currentTimestamp, lastUpdateTimestamp);
  console.debug(`Calculated timeFrame for queries: ${timeFrame}`);

  const promises = botIds.map(async (botId) => {
    const output = { botId };

    const agentInformationQuery = createAgentInformationQuery(botId);
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
    const metricsResponse = await postQuery(metricsQuery);
    const metrics = parseMetricsResponse(
      metricsResponse,
      currentTimestamp,
      timeFrame,
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
            return { timestamp: timestamp / 1000, value: sum };
          });

          if (points.length > 0) {
            series.push({
              metric: metricName,
              tags: [
                `botid:${botId}`,
                `scannerid:${scannerId}`,
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