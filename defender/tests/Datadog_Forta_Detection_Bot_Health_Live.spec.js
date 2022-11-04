// this will allow us to override values returned by Date Class methods
jest.useFakeTimers();
jest.setSystemTime(8675309);

const mockKeyValueStore = {
  get: jest.fn(),
  put: jest.fn(),
};

const botIds = [
  '0xb6bdedbae67cc82e60aad02a8ffab3ccbefeaa876ca7e4f291c07c798a95e339', // Forta Low Liquidity Attack
];

// override the key-value store Class
jest.mock('defender-kvstore-client', () => ({
  KeyValueStoreClient: jest.fn().mockReturnValue(mockKeyValueStore),
}));

const { handler } = require('../downloaded/Datadog_Forta_Detection_Bot_Health');

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
        DatadogApiKey: 'mockApiKey',
      },
    };
  });

  it('Send a query', async () => {
    // the first time the Autotask is executed, nothing is stored in the kvstore
    mockKeyValueStore.get
      .mockResolvedValueOnce(undefined) // agentInformationDD
      .mockResolvedValueOnce(undefined); // lastUpdateTimestampDD

    // execute the Autotask
    // TODO: mock post to datadog
    const result = await handler(mockAutotaskEvent);
    console.log(result);

    // construct the Object that will be stringified and stored in the kvstore
    const agentInformationStored = {};
    botIds.forEach((botId) => {
      agentInformationStored[botId] = {};
    });
  });

});
