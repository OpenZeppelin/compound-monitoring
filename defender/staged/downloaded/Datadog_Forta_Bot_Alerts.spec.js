jest.mock('axios', () => jest.fn());
const axios = require('axios');

// this will allow us to override values returned by Date Class methods
jest.useFakeTimers();
jest.setSystemTime(8675309);

const mockKeyValueStore = {
  get: jest.fn(),
  put: jest.fn(),
};

const botIds = [
  '0x5a00b44b2db933d4c797e6bd3049abdeb89cc9ec1b2eaee7bdbaff911794f714', // Forta Low Liquidity Attack
  '0xb6bdedbae67cc82e60aad02a8ffab3ccbefeaa876ca7e4f291c07c798a95e339', // Forta Large Borrows Governance
  '0x916603512086fcad84c35858d2fc5356c512f72b19c80e52e8f9c04d8122e2ba', // Forta Multi-Sig Monitor
  '0x0d3cdcc2757cd7837e3b302a9889c854044a80835562dc8060d7c163fbb69d53', // Forta Large Delegations Monitor
  '0xe200d890a67d51c3610520dd9fdfa9e2bd6dd341d41e32fa457601e73c4c6685', // Forta Oracle Price Monitor
  '0xf836bda7810aa2dd9df5bb7ac748f173b945863e922a15bb7c57da7b0e6dab05', // Forta Underlying Asset Monitor
  '0xdb6d5f9cc2ee545d42b873dba9679ecfca8d81991592179b93a78e2953c47713', // Forta Airdrop Monitor
  '0x77687a1f255c73f4008167d036c9717469f1a9a91fc2782236f33d91a76e4680', // Forta Agent Registry Monitor
  '0x0071a23a322c4dbd306037a086275c15a384afa67c7a76ecdf03e54c3350cdbe', // big-tx-agent
  '0x77281ae942ee1fe141d0652e9dad7d001761552f906fb1684b2812603de31049', // oz-gnosis-events
];

// override the key-value store Class
jest.mock('defender-kvstore-client', () => ({
  KeyValueStoreClient: jest.fn().mockReturnValue(mockKeyValueStore),
}));

const { handler } = require('./Datadog_Forta_Bot_Alerts');

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
        DatadogApiKey: 'fakeApiKey',
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
    botIds.forEach((botId) => {
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
          date_happened: dateHappened,
        },
      } = inputObject;

      if (query !== undefined && query.includes('alert_id')) {
        return mockAlertResponse;
      }

      if (dateHappened !== undefined) {
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
      url: 'https://api.datadoghq.com/api/v1/events',
      data: {
        date_happened: new Date(mockTimestamp).valueOf() / 1000,
        tags: [
          'botid:0xMOCKBOTID',
          `protocol:${mockProtocolName}`,
          `severity:${mockSeverity}`,
        ],
        text: mockDescription,
        aggregation_key: mockAlertId,
        title: mockName,
      },
    });
    expect(outputObject.lastUpdateTimestampAlerts).toStrictEqual('8675309');
  });
});
