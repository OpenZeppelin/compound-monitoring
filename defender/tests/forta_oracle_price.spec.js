// Set the name of the Secret set in Autotask
const stackName = 'forta_oracle_price';
const discordSecretName = `${stackName}_discordWebhook`;

// Setup input for the handler
const discordWebhook = 'http://localhost/';
const secrets = {};
secrets[discordSecretName] = discordWebhook;

// Mock the data from the Bot finding
const mockTxHash = '0x1110890564dbd87ca848b7107487ae5a7d28da1b16707bccd3ba37381ae33419';
const mockBlockHash = '0x1110890564dbd87ca848b7107487ae5a7d28da1b16707bccd3ba37381ae33419';
const mockMetadata = {
  cTokenAddress: '0xCTOKENADDRESS',
  underlyingTokenAddress: '0xUNDERLYINGTOKENADDRESS',
  validatorProxyAddress: '0xREPORTERADDRESS',
  anchorPrice: '10',
  reporterPrice: '100',
  protocolVersion: '2',
};

const {
  Finding, FindingType, FindingSeverity,
} = require('forta-agent');

const mockFinding = Finding.fromObject({
  name: 'Placeholder Alert',
  description: 'Placeholder description',
  alertId: 'AE-ALERT-ID',
  type: FindingType.Info,
  severity: FindingSeverity.Info,
  protocol: 'Protocol',
  metadata: mockMetadata,
});

// mock the axios package
const acceptedPost = {
  status: 204,
  statusText: 'No Content',
};
jest.mock('axios', () => jest.fn().mockResolvedValue(acceptedPost));
// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');

// eslint-disable-next-line import/no-useless-path-segments
const { handler } = require('../forta_oracle_price/autotask-1/index');

function createFortaSentinelEvent(finding, blockHash, txHash) {
  // Generally findings go from the Bot, to Scan Node, to Sentinel, to Autotasks
  //  with some metadata being added and removed along the way. This function will mimic
  // the Sentinel output with only Finding, block and transaction data.

  // Note: Much of the extra data here is superfluous but is left here just in case future bots
  // want to reference any of the Sentinel data in the Discord output. It also mimics sentinel
  // output more accurately.

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
  const sentinel = {
    id: '8fe3d50b-9b52-44ff-b3fd-a304c66e1e56',
    name: 'Sentinel Name Placeholder',
    addresses: [],
    agents: [],
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
        hash: '0xAGENT-HASH', // forta Agent hash
        alert: {
          metadata: finding.metadata,
        },
        source: {
          transactionHash: txHash,
          block: {
            hash: blockHash,
          },
        },
        matchReasons,
        sentinel,
        type: 'FORTA',
      },
    },
  };
  return autotaskEvent;
}

describe('check autotask', () => {
  const url = secrets[discordSecretName];
  const headers = { 'Content-Type': 'application/json' };
  const method = 'post';

  beforeEach(async () => {
    axios.mockClear();
  });

  it('Runs autotask against mock data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(mockFinding, mockBlockHash, mockTxHash);
    // run the autotask on the events
    await handler(autotaskEvent);

    const data = '{"content":"[TX](<https://etherscan.io/tx/0x1110890564dbd87ca848b7107487ae5a7d28da1b16707bccd3ba37381ae33419>) 🚫 Reported price of **0xUNDE** was **rejected** (Compound v2)"}';
    const expectedLastCall = {
      url, headers, method, data,
    };
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('throws error if discordUrl is not valid', async () => {
    // Use an invalid discord URL
    secrets[discordSecretName] = 'http//zzzz';
    const autotaskEvent = createFortaSentinelEvent(mockFinding, mockBlockHash, mockTxHash);
    // run the autotask on the events
    await expect(handler(autotaskEvent)).rejects.toThrow('discordUrl is not a valid URL');

    expect(axios).toBeCalledTimes(0);
  });
});
