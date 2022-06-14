// Set the name of the Secret set in Autotask
const discordSecretName = 'SecurityAlertsDiscordUrl';
// Name of the Secret in the .env file
const discordEnvSecretName = 'discordUrl';

// Mock the data from the Bot finding
const mockTxHash = '0x1110890564dbd87ca848b7107487ae5a7d28da1b16707bccd3ba37381ae33419';
const mockBlockHash = '0x1110890564dbd87ca848b7107487ae5a7d28da1b16707bccd3ba37381ae33419';

// Mock for each event type
const mockAddedId = 'AE-COMP-MULTISIG-OWNER-ADDED-ALERT';
const mockAddedMetadata = {
  owner: '0xNEW',
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockRemovedId = 'AE-COMP-MULTISIG-OWNER-REMOVED-ALERT';
const mockRemovedMetadata = {
  owner: '0xREMOVED',
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockCreatedId = 'AE-COMP-GOVERNANCE-PROPOSAL-CREATED-ALERT';
const mockCreatedMetadata = {
  proposalId: 101,
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockExecutedId = 'AE-COMP-GOVERNANCE-PROPOSAL-EXECUTED-ALERT';
const mockExecutedMetadata = {
  proposalId: 101,
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockCanceledId = 'AE-COMP-GOVERNANCE-PROPOSAL-CANCELED-ALERT';
const mockCanceledMetadata = {
  proposalId: 101,
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockCastId = 'AE-COMP-GOVERNANCE-VOTE-CAST-ALERT';
const mockCastMetadata = {
  proposalId: 101,
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockThresholdSetId = 'AE-COMP-GOVERNANCE-THRESHOLD-SET-ALERT';
const mockThresholdSetMetadata = {
  oldThreshold: 100,
  newThreshold: 200,
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockNewAdminId = 'AE-COMP-GOVERNANCE-NEW-ADMIN-ALERT';
const mockNewAdminMetadata = {
  oldAdmin: '0xME',
  newAdmin: '0xYOU',
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockNewPauseId = 'AE-COMP-NEW-PAUSE-GUARDIAN-ALERT';
const mockNewPausedMetadata = {
  oldPauseGuardian: '0xME',
  newPauseGuardian: '0xYOU',
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockPausedId = 'AE-COMP-ACTION-PAUSED-ALERT';
const mockPausedMetadata = {
  action: 'PAUSED',
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockNewCapId = 'AE-COMP-NEW-BORROW-CAP-ALERT';
const mockNewCapMetadata = {
  cToken: '0x0cBTC',
  newBorrowCap: 10000000,
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};
const mockCapGuardId = 'AE-COMP-NEW-BORROW-CAP-GUARDIAN-ALERT';
const mockCapGuardMetadata = {
  oldBorrowCapGuardian: '0xME',
  newBorrowCapGuardian: '0xYOU',
  multisigAddress: '0xbbf3f1421D886E9b2c5D716B5192aC998af2012c',
};

const {
  Finding, FindingType, FindingSeverity,
} = require('forta-agent');

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

// Map the Env name to the Secret variable name
if (discordSecretName !== discordEnvSecretName) {
  secrets[discordSecretName] = secrets[discordEnvSecretName];
  delete secrets[discordEnvSecretName];
}

// eslint-disable-next-line import/no-useless-path-segments
const { handler } = require('../downloaded/Forta_Multi-Sig');

function createFortaSentinelEvent(metadata, alertId, blockHash, txHash) {
  // Generally findings go from the Bot, to Scan Node, to Sentinel, to Autotasks
  //  with some metadata being added and removed along the way. This function will mimic
  // the Sentinel output with only Finding, block and transaction data.

  // Note: Much of the extra data here is superfluous but is left here just in case future bots
  // want to reference any of the Sentinel data in the Discord output. It also mimics sentinel
  // output more accurately.

  const finding = Finding.fromObject({
    name: 'Placeholder Alert',
    description: 'Placeholder description',
    alertId: 'AE-ALERT-ID',
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    protocol: 'Protocol',
    metadata,
  });

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
          alertId,
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
  it('Runs autotask against mocked OWNER-ADDED data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockAddedMetadata,
      mockAddedId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked OWNER-REMOVED data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockRemovedMetadata,
      mockRemovedId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked PROPOSAL-CREATED data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockCreatedMetadata,
      mockCreatedId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked PROPOSAL-EXECUTED data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockExecutedMetadata,
      mockExecutedId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked PROPOSAL-CANCELED data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockCanceledMetadata,
      mockCanceledId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked VOTE-CAST data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockCastMetadata,
      mockCastId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked THRESHOLD-SET data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockThresholdSetMetadata,
      mockThresholdSetId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked NEW-ADMIN data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockNewAdminMetadata,
      mockNewAdminId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked NEW-PAUSE-GUARDIAN data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockNewPausedMetadata,
      mockNewPauseId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked ACTION-PAUSED data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockPausedMetadata,
      mockPausedId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked NEW-BORROW-CAP data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockNewCapMetadata,
      mockNewCapId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mocked NEW-BORROW-CAP-GUARDIAN data and posts in Discord (manual-check)', async () => {
    const autotaskEvent = createFortaSentinelEvent(
      mockCapGuardMetadata,
      mockCapGuardId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('throws error if discordUrl is not valid', async () => {
    // Use an invalid discord URL
    secrets[discordSecretName] = 'http//zzzz';
    const autotaskEvent = createFortaSentinelEvent(
      mockAddedMetadata,
      mockAddedId,
      mockBlockHash,
      mockTxHash,
    );
    // run the autotask on the events
    await expect(handler(autotaskEvent)).rejects.toThrow('discordUrl is not a valid URL');
  });
});
