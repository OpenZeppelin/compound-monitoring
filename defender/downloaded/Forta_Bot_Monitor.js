/* eslint-disable import/no-unresolved,import/no-extraneous-dependencies */
const axios = require('axios');
/* eslint-enable import/no-unresolved,import/no-extraneous-dependencies */

const botIds = [
  '0x5a00b44b2db933d4c797e6bd3049abdeb89cc9ec1b2eaee7bdbaff911794f714', // Forta Low Liquidity Attack
  '0xb6bdedbae67cc82e60aad02a8ffab3ccbefeaa876ca7e4f291c07c798a95e339', // Forta Large Borrows Governance
  '0x916603512086fcad84c35858d2fc5356c512f72b19c80e52e8f9c04d8122e2ba', // Forta Multi-Sig Monitor
  '0x0d3cdcc2757cd7837e3b302a9889c854044a80835562dc8060d7c163fbb69d53', // Forta Large Delegations Monitor
  '0xe200d890a67d51c3610520dd9fdfa9e2bd6dd341d41e32fa457601e73c4c6685', // Forta Oracle Price Monitor
  '0xf836bda7810aa2dd9df5bb7ac748f173b945863e922a15bb7c57da7b0e6dab05', // Forta Underlying Asset Monitor
];

const fortaExplorerApiEndpoint = 'https://explorer-api.forta.network/graphql';

function convertEpochToDateTime(epochTimestamp) {
  // desired format - YYYY-MM-DD HH:MM
  const dateObject = new Date(epochTimestamp);

  const year = dateObject.getUTCFullYear();
  const month = dateObject.getUTCMonth().toString().padStart(2, '0');
  const day = dateObject.getUTCDay().toString().padStart(2, '0');
  const hours = dateObject.getUTCHours().toString().padStart(2, '0');
  const minutes = dateObject.getUTCMinutes().toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function camelize(str, delimiter) {
  let output = '';
  str.split(delimiter).forEach((element, index) => {
    let add = element.toLowerCase();
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
    if (key !== '__typename') {
      const newKey = camelize(key, '_');
      output[newKey] = value;
    }
  });

  return output;
}

function parseAlertSeverities(response) {
  const { data: { data: { getList: { aggregations } } } } = response;

  const {
    severity,
    alerts,
    interval,
    cardinalities,
  } = aggregations;

  const newSeverity = severity.map((entry) => ({ severity: entry.key, count: entry.doc_count }));
  const newAlerts = alerts.map((entry) => ({ name: entry.key, count: entry.doc_count }));
  const newInterval = interval.map((entry) => {
    const timestamp = convertEpochToDateTime(parseInt(entry.key, 10));
    return { timestamp, count: entry.doc_count };
  });

  const newCardinalities = {
    agents: cardinalities.agents,
    alerts: cardinalities.alerts,
  };

  return {
    severity: newSeverity,
    alerts: newAlerts,
    interval: newInterval,
    cardinalities: newCardinalities,
  };
}

function parseAlertsResponse(response) {
  function getBlock(block) {
    return {
      chainId: block.chain_id,
      number: block.number,
      timestamp: block.timestamp,
    };
  }

  function getAgent(agent) {
    return {
      id: agent.id,
      name: agent.name,
    };
  }

  function getSource(value) {
    return {
      txHash: value.tx_hash,
      agent: getAgent(value.agent),
      block: getBlock(value.block),
    };
  }

  function getProject(project) {
    return {
      id: project.id,
      name: project.name,
    };
  }

  const { data: { data: { getList: { alerts } } } } = response;
  const newAlerts = alerts.map((alert) => {
    const output = {};
    Object.entries(alert).forEach(([key, value]) => {
      switch (key) {
        case 'source':
          output.source = getSource(value);
          break;
        case 'projects':
          output.projects = value.map((project) => getProject(project));
          break;
        case '__typename':
          break;
        default:
          output[camelize(key, '_')] = value;
      }
    });
    return output;
  });
  return newAlerts;
}

function parseMetricsResponse(response) {
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
      output[key][scannerId] = [];
      const records = scanner.interval;

      // actual data
      //   key: Epoch timestamp, in milliseconds
      //   sum: sum of metric over the interval
      //   max: maximum of metric over the interval
      records.forEach((record) => {
        const timestamp = convertEpochToDateTime(parseInt(record.key, 10));
        output[key][scannerId].push({
          timestamp,
          sum: parseInt(record.sum, 10),
          max: parseInt(record.max, 10),
        });
      });
    });
  });

  return output;
}

// this appears to query for previous alerts emitted by a Bot
// this data is then displayed in a table view titled 'Alerts' on the bottom of the Forta Explorer
// page for the Bot
function createAlertsQuery(botId) {
  const graphqlQuery = {
    operationName: 'Retrive',
    query: `query Retrive($getListInput: GetAlertsInput) {
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
              __typename
            }
            block {
              chain_id
              number
              timestamp
              __typename
            }
            __typename
          }
          projects {
            id
            name
            __typename
          }
          __typename
        }
        nextPageValues {
          blocknumber
          id
          __typename
        }
        currentPageValues {
          blocknumber
          id
          __typename
        }
        __typename
      }
    }`,
    variables: {
      getListInput: {
        severity: [],
        startDate: '',
        endDate: '',
        txHash: '',
        text: '',
        muted: [],
        limit: 50,
        sort: 'desc',
        agents: [botId],
        addresses: [],
        project: '',
      },
    },
  };
  return graphqlQuery;
}

// this query gathers data for the Alert Severities pie chart on the Forta Explorer page for a Bot
function createAlertSeveritiesQuery(timeFrame) {
  const currentTimestamp = (new Date()).getTime();
  const graphqlQuery = {
    operationName: 'Retrive',
    query: `query Retrive($getListInput: GetAlertsInput) {
      getList(input: $getListInput) {
        aggregations {
          severity {
            key
            doc_count
            __typename
          }
          alerts {
            key
            doc_count
            __typename
          }
          agents {
            key
            doc_count
            __typename
          }
          interval {
            key
            doc_count
            __typename
          }
          cardinalities {
            agents
            alerts
            __typename
          }
          __typename
        }
        __typename
      }
    }`,
    variables: {
      getListInput: {
        severity: [],
        agents: [],
        txHash: '',
        text: '',
        muted: [],
        sort: '',
        limit: 0,
        project: '',
        startDate: '1638721490212',
        endDate: currentTimestamp.toString(),
        aggregations: {
          severity: true,
          interval: timeFrame,
          alerts: 6,
          cardinalities: true,
        },
      },
    },
  };
  return graphqlQuery;
}

// this query gathers information used to populate fields on the page for the Bot
// specifically, this contains data such as the Bot ID, Image, Last Updated, Enabled, etc.
function createAgentInformationQuery(id) {
  const graphqlQuery = {
    operationName: 'Retrive',
    query: `query Retrive($getAgentInput: AgentInformation) {
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
        __typename
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

// timeFrame values: 'day', 'week', 'month'
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
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
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

// entry point for autotask
// eslint-disable-next-line func-names
exports.handler = async function () {
  const timeFrame = 'day';

  const promises = botIds.map(async (botId) => {
    const alertsQuery = createAlertsQuery(botId);
    const alertsResponse = await postQuery(alertsQuery);
    const alerts = parseAlertsResponse(alertsResponse);

    const alertSeveritiesQuery = createAlertSeveritiesQuery(timeFrame);
    const alertSeveritiesResponse = await postQuery(alertSeveritiesQuery);
    const alertSeverities = parseAlertSeverities(alertSeveritiesResponse);

    const agentInformationQuery = createAgentInformationQuery(botId);
    const agentInformationResponse = await postQuery(agentInformationQuery);
    const agentInformation = parseAgentInformationResponse(agentInformationResponse);

    const metricsQuery = createMetricsQuery(botId, timeFrame);
    const metricsResponse = await postQuery(metricsQuery);
    const metrics = parseMetricsResponse(metricsResponse);

    const output = {
      botId,
      alerts,
      alertSeverities,
      agentInformation,
      metrics,
    };
    return output;
  });

  const results = await Promise.all(promises);

  return results;
};
