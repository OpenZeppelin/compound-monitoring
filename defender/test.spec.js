require('dotenv').config({ path: `${__dirname}/.env` });

const SecurityAlertsDiscordUrl = process.env.TESTING_DISCORD_SECURITY_ALERTS;

// mock the defender-relay-client package
jest.mock('defender-relay-client/lib/ethers', () => ({
  DefenderRelayProvider: jest.fn(),
}));

const mockContract = {
  symbol: jest.fn(),
};

// mock the ethers package
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn().mockReturnValue(mockContract),
}));

// mock the axios package
jest.mock('axios', () => jest.fn());
// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');

// eslint-disable-next-line no-unused-vars
const axiosReal = jest.requireActual('axios');

// low liquidity Bot Autotask
// eslint-disable-next-line no-unused-vars
const { ethers } = require('ethers');
const { handler: fortaLowLiquidityHandler } = require('./downloaded/Forta_Low_Liquidity');
const { createMarketAttackAlert } = require('../low-liquidity-market-attack-monitor/src/agent');

// multi-sig Bot Autotask
const { handler: fortaMultiSigHandler } = require('./downloaded/Forta_Multi-Sig');
const {
  createAddOwnerFinding,
  createRemoveOwnerFinding,
  createGovernanceFinding,
  createComptrollerFinding,
} = require('../multisig-transactions-monitor/src/utils');

const hash = '0xFAKEHASH';
const transactionHash = '0xFAKETRANSACTIONHASH';
const id = '0xFAKEAGENTID';

function createMockResponse(sampleAlert) {
  // mock the return value from the axios POST request
  const mockAlerts = [
    {
      hash,
      ...sampleAlert,
    },
  ];

  const mockResponse = {
    data: {
      data: {
        alerts: {
          alerts: mockAlerts,
        },
      },
    },
  };

  return mockResponse;
}

function createAutotaskEvent() {
  const autotaskEvent = {
    secrets: {
      SecurityAlertsDiscordUrl,
    },
    request: {
      body: {
        alert: {
          hash,
          source: {
            transactionHash,
            bot: {
              id,
            },
          },
        },
      },
    },
  };
  return autotaskEvent;
}

describe('test the Forta Low Liquidity bot alert', () => {
  it('invokes the Forta Low Liquidity Autotask to create an alert in a Discord channel', async () => {
    // create an example alert to populate the mock alert
    const sampleAlert = createMarketAttackAlert(
      'Compound',
      'COMP',
      'AE',
      'cUSDC',
      '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
      '1000777',
      '100',
      '0xMALICIOUSATTACKERADDRESS',
      '1000',
    );

    const mockResponse = createMockResponse(sampleAlert);
    axios.mockResolvedValueOnce(mockResponse); // .mockImplementationOnce(axiosReal);
    const autotaskEvent = createAutotaskEvent();
    await fortaLowLiquidityHandler(autotaskEvent);
  });
});

describe('test the Forta Multi-Sig bot alerts', () => {
  it('invokes the Forta Multi-Sig Autotask to create an Added Owner alert in a Discord channel', async () => {
    // create an example alert to populate the mock alert
    const log = { args: { owner: '0xFAKEOWNERADDRESS' } };
    const sampleAlert = createAddOwnerFinding(log, 'Compound', 'COMP', 'AE');
    const mockResponse = createMockResponse(sampleAlert);
    axios.mockResolvedValueOnce(mockResponse); // .mockImplementationOnce(axiosReal);
    const autotaskEvent = createAutotaskEvent();
    await fortaMultiSigHandler(autotaskEvent);
  });

  it('invokes the Forta Multi-Sig Autotask to create a Removed Owner alert in a Discord channel', async () => {
    // create an example alert to populate the mock alert
    const log = { args: { owner: '0xFAKEOWNERADDRESS' } };
    const sampleAlert = createRemoveOwnerFinding(log, 'Compound', 'COMP', 'AE');
    const mockResponse = createMockResponse(sampleAlert);
    axios.mockResolvedValueOnce(mockResponse); // .mockImplementationOnce(axiosReal);
    const autotaskEvent = createAutotaskEvent();
    await fortaMultiSigHandler(autotaskEvent);
  });

  it('invokes the Forta Multi-Sig Autotask to create a Proposal Created alert in a Discord channel', async () => {
    const eventNames = [
      'ProposalCreated',
      'ProposalExecuted',
      'ProposalCanceled',
      'VoteCast',
      'ProposalThresholdSet',
      'NewAdmin',
    ];

    let name;
    for (let i = 0; i < eventNames.length; i++) {
      name = eventNames[i];
      // create an example alert to populate the mock alert
      const log = {
        name,
        args: {
          id: 77, // for ProposalCreated, ProposalExecuted, and ProposalCanceled
          proposalId: 77, // for VoteCast
          oldProposalThreshold: 10, // for ProposalThresholdSet
          newProposalThreshold: 20, // for ProposalThresholdSet
          oldAdmin: '0xOLDADMINADDRESS', // for NewAdmin
          newAdmin: '0xNEWADMINADDRESS', // for NewAdmin
        },
      };
      const sampleAlert = createGovernanceFinding(log, 'Compound', 'COMP', 'AE');
      const mockResponse = createMockResponse(sampleAlert);
      axios.mockResolvedValueOnce(mockResponse); // .mockImplementationOnce(axiosReal);
      const autotaskEvent = createAutotaskEvent();
      // eslint-disable-next-line no-await-in-loop
      await fortaMultiSigHandler(autotaskEvent);
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, 300));
      // eslint-disable-next-line no-await-in-loop
      await promise;
    }
  });

  it('invokes the Forta Multi-Sig Autotask to create a Gnosis alert in a Discord channel', async () => {
    const eventNames = [
      'NewBorrowCapGuardian',
      'NewBorrowCap',
      'ActionPaused',
      'NewPauseGuardian',
    ];
    let name;
    for (let i = 0; i < eventNames.length; i++) {
      name = eventNames[i];

      if (name === 'NewBorrowCap') {
        mockContract.symbol.mockResolvedValueOnce('cSYMBOL');
      }

      // create an example alert to populate the mock alert
      const log = {
        name,
        args: {
          oldBorrowCapGuardian: '0xOLDBORROWCAPGUARDIAN', // for NewBorrowCapGuardian
          newBorrowCapGuardian: '0xNEWBORROWCAPGUARDIAN', // for NewBorrowCapGuardian
          cToken: '0xCTOKENADDRESS', // for NewBorrowCap
          newBorrowCap: 10, // for NewBorrowCap
          action: 'contractAction', // for ActionPaused
          oldPauseGuardian: '0xOLDPAUSEGUARDIAN', // for NewPauseGuardian
          newPauseGuardian: '0xNEWPAUSEGUARDIAN', // for NewPauseGuardian
        },
      };
      const sampleAlert = createComptrollerFinding(log, 'Compound', 'COMP', 'AE');
      const mockResponse = createMockResponse(sampleAlert);
      axios.mockResolvedValueOnce(mockResponse); // .mockImplementationOnce(axiosReal);
      const autotaskEvent = createAutotaskEvent();
      // eslint-disable-next-line no-await-in-loop
      await fortaMultiSigHandler(autotaskEvent);
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, 300));
      // eslint-disable-next-line no-await-in-loop
      await promise;
    }
  });
});
