// Set the name of the Secret set in Autotask
const stackName = 'datadog_alerts_heat_map';
const datadogSecretName = `${stackName}_datadogApiKey`;

jest.mock('axios', () => jest.fn());
const axios = require('axios');

// this will allow us to override values returned by Date Class methods
jest.useFakeTimers();
jest.setSystemTime(8675309);

const mockKeyValueStore = {
  get: jest.fn(),
  put: jest.fn(),
};

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

// override the key-value store Class
jest.mock('defender-kvstore-client', () => ({
  KeyValueStoreClient: jest.fn().mockReturnValue(mockKeyValueStore),
}));

const { handler } = require('../datadog_alerts_heat_map/autotask-1/index');

describe('Run the Autotask', () => {
  let outputObject;
  let mockAutotaskEvent;

  beforeEach(() => {
    // set up a capture of any put() calls to the kvstore
    outputObject = {};
    mockKeyValueStore.put.mockImplementation((inputKey, value) => {
      outputObject[inputKey] = value;
    });

    mockAutotaskEvent = {
      secrets: {
        [datadogSecretName]: 'fakeApiKey',
      },
    };
  });

  it('updates the kvstore values when the Autotask is first executed', async () => {
    // the first time the Autotask is executed, nothing is stored in the kvstore
    mockKeyValueStore.get
      .mockResolvedValueOnce(undefined); // lastUpdateTimestampAlerts

    const alerts = [];
    const mockAlertResponse = { data: { data: { getList: { alerts } } } };
    axios.mockImplementation((inputObject) => {
      const { data: { query } } = inputObject;
      if (query.includes('alert_id')) {
        return mockAlertResponse;
      }
      return undefined;
    });

    // execute the Autotask
    const result = await handler(mockAutotaskEvent);
    expect(result).toStrictEqual({});
    expect(outputObject.lastUpdateTimestampAlerts).toStrictEqual('8675309');
  });

  it('sends alert information to Datadog when alerts are updated', async () => {
    const mockLastUpdateTimestamp = '8675308';
    const agentInformationStored = {};
    Object.keys(botIdsToNames).forEach((botId) => {
      agentInformationStored[botId] = {};
    });

    // the second time the Autotask is executed, something is stored in the kvstore
    mockKeyValueStore.get
      .mockResolvedValueOnce(mockLastUpdateTimestamp); // lastUpdateTimestampAlerts

    const mockTimestamp = '2022-05-21T16:24:58Z';

    const mockProtocolName = 'Mock Protocol';
    const mockSeverity = 'Mock Severity';
    const mockName = 'Mock Alert Name';
    const mockAlertId = 'MOCK-ALERT-ID';
    const mockDescription = 'Mock description of a Forta Bot alert';
    const alerts = [
      {
        hash: '0xFAKEHASH',
        description: mockDescription,
        severity: mockSeverity,
        protocol: mockProtocolName,
        name: mockName,
        alertId: mockAlertId,
        scannerCount: 1,
        source: {
          txHash: '0xMOCKTRANSACTIONHASH',
          agent: {
            id: '0xMOCKBOTID',
            name: null,
          },
          block: {
            chainId: 1,
            number: 14818293,
            timestamp: mockTimestamp,
          },
        },
      },
    ];

    let capturedDatadogRequest;
    const mockAlertResponse = { data: { data: { getList: { alerts } } } };
    axios.mockImplementation((inputObject) => {
      const {
        data: {
          query,
          series,
        },
      } = inputObject;

      if (query !== undefined && query.includes('alert_id')) {
        return mockAlertResponse;
      }

      if (series !== undefined) {
        capturedDatadogRequest = inputObject;
      }

      return undefined;
    });

    // execute the Autotask
    const result = await handler(mockAutotaskEvent);

    // construct the Object that we expect to receive from the handler
    expect(result).toStrictEqual({});
    expect(capturedDatadogRequest).toStrictEqual({
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': 'fakeApiKey',
      },
      method: 'post',
      url: 'https://api.datadoghq.com/api/v2/series',
      data: {
        series: [
          {
            metric: 'alertHeatMap',
            points: [
              {
                timestamp: 1653150298,
                value: 7,
              },
            ],
            tags: [
              'botid:0xMOCKBOTID',
              `protocol:${mockProtocolName}`,
              `severity:${mockSeverity}`,
              'dayofweek:7',
              'weekselapsed:23',
              'botname:undefined',
            ],
            type: 0,
          },
        ],
      },
    });
    expect(outputObject.lastUpdateTimestampAlerts).toStrictEqual('8675309');
  });
});
