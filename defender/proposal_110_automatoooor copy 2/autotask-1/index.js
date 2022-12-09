const { ethers } = require('ethers');
const {
  DefenderRelayProvider,
  DefenderRelaySigner,
} = require('defender-relay-client/lib/ethers');
const { KeyValueStoreClient } = require('defender-kvstore-client');

const GovernorBravo = {
  address: '0xc0Da02939E1441F497fd74F78cE7Decb17B66529', // Compound governor address (replace if needed)
  ABI: [
    {
      constant: true,
      inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      name: 'proposals',
      outputs: [
        { internalType: 'uint256', name: 'id', type: 'uint256' },
        { internalType: 'address', name: 'proposer', type: 'address' },
        { internalType: 'uint256', name: 'eta', type: 'uint256' },
        { internalType: 'uint256', name: 'startBlock', type: 'uint256' },
        { internalType: 'uint256', name: 'endBlock', type: 'uint256' },
        { internalType: 'uint256', name: 'forVotes', type: 'uint256' },
        { internalType: 'uint256', name: 'againstVotes', type: 'uint256' },
        { internalType: 'uint256', name: 'abstainVotes', type: 'uint256' },
        { internalType: 'bool', name: 'canceled', type: 'bool' },
        { internalType: 'bool', name: 'executed', type: 'bool' },
      ],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [
        { internalType: 'uint256', name: 'proposalId', type: 'uint256' },
      ],
      name: 'state',
      outputs: [
        {
          internalType: 'enum GovernorBravoDelegateStorageV1.ProposalState',
          name: '',
          type: 'uint8',
        },
      ],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: false,
      inputs: [
        { internalType: 'uint256', name: 'proposalId', type: 'uint256' },
      ],
      name: 'queue',
      outputs: [],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: false,
      inputs: [
        { internalType: 'uint256', name: 'proposalId', type: 'uint256' },
      ],
      name: 'execute',
      outputs: [],
      payable: true,
      stateMutability: 'payable',
      type: 'function',
    },
  ],
};

const ProposalStates = {
  Pending: 0,
  Active: 1,
  Canceled: 2,
  Defeated: 3,
  Succeeded: 4,
  Queued: 5,
  Expired: 6,
  Executed: 7,
};

const QueueTxSentPrefix = 'QueueTxSent';
const ExecuteTxSentPrefix = 'ExecuteTxSent';

// Don't update manually, it's automatically updated when creating via API
const proposalId = '110';

// eslint-disable-next-line func-names
exports.handler = async function (event) {
  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: 'fastest' });
  const store = new KeyValueStoreClient(event);

  const GovernorContract = new ethers.Contract(
    GovernorBravo.address,
    GovernorBravo.ABI,
    signer,
  );

  // Check proposal state, if proposalId doesn't exist yet, just skip
  let state;
  try {
    state = await GovernorContract.state(proposalId);
  } catch (err) {
    return {
      message: `proposalId: ${proposalId} does not exist`,
    };
  }

  /* eslint-disable default-case */
  switch (state) {
    case ProposalStates.Succeeded: {
      const wasPreviouslyQueued = await store.get(
        `${QueueTxSentPrefix}-${proposalId}`,
      );

      if (!wasPreviouslyQueued) {
        await GovernorContract.queue(proposalId);
        await store.put(`${QueueTxSentPrefix}-${proposalId}`, true);
        return {
          message: 'Queue tx sent',
        };
      }
      break;
    }
    case ProposalStates.Queued: {
      const { eta } = await GovernorContract.proposals(proposalId);
      const etaDate = new Date(eta.toNumber() * 1000); // Unix timestamp
      const currentDate = new Date();
      if (currentDate > etaDate) {
        // Only execute when `eta` has passed
        const wasPreviouslyExecuted = await store.get(
          `${ExecuteTxSentPrefix}-${proposalId}`,
        );
        if (!wasPreviouslyExecuted) {
          await GovernorContract.execute(proposalId);
          await store.put(`${ExecuteTxSentPrefix}-${proposalId}`, true);
        }
        return {
          message: 'Execution tx sent',
        };
      }
      break;
    }
    case ProposalStates.Executed: {
      // TODO: Pause Autotask (?)
      break;
    }
    // Default just skip
  }

  return {
    message: 'Executed with no operation',
  };
};
