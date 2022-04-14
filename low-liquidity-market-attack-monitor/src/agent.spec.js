const mockedGetContract = jest.fn();
const mockedGetProvider = jest.fn();

// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersBatchProvider: mockedGetProvider,
  ethers: {
    ...jest.requireActual('ethers'),
    Contract: mockedGetContract,
  },
}));

const {
  TransactionEvent, ethers, FindingType, FindingSeverity, Finding,
} = require('forta-agent');

const { provideHandleTransaction, provideInitialize, createMarketAttackAlert } = require('./agent');
const { createMockEventLogs } = require('./test-utils');
const { getAbi } = require('./utils');
const config = require('../agent-config.json');

// utility function specific for this test module
// we are intentionally not using the Forta SDK function due to issues with
// jest mocking the module and interfering with default function values
function createTransactionEvent(txObject) {
  const txEvent = new TransactionEvent(
    null,
    null,
    txObject.transaction,
    txObject.receipt,
    [],
    txObject.addresses,
    txObject.block,
  );
  return txEvent;
}

// check the configuration file to verify the values
describe('check agent configuration file', () => {
  it('protocolName key required', () => {
    const { protocolName } = config;
    expect(typeof protocolName).toBe('string');
    expect(protocolName).not.toBe('');
  });

  it('protocolAbbreviation key required', () => {
    const { protocolAbbreviation } = config;
    expect(typeof protocolAbbreviation).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  it('developerAbbreviation key required', () => {
    const { developerAbbreviation } = config;
    expect(typeof developerAbbreviation).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  it('contracts key required', () => {
    const { contracts } = config;
    expect(typeof contracts).toBe('object');
    expect(contracts).not.toBe({});
  });

  it('contracts key values must be valid', () => {
    const { contracts } = config;

    const { Comptroller, CompoundToken } = contracts;
    expect(typeof Comptroller).toBe('object');
    expect(Comptroller).not.toBe({});

    expect(typeof CompoundToken).toBe('object');
    expect(CompoundToken).not.toBe({});

    const { abiFile: ComptrollerAbiFile, address: ComptrollerAddress } = Comptroller;
    const { abiFile: cTokenAbiFile, address: compTokenAddress } = CompoundToken;

    // check that the comptroller address is a valid address
    expect(ethers.utils.isHexString(ComptrollerAddress, 20)).toBe(true);

    // check that the compound token address is a valid address
    expect(ethers.utils.isHexString(compTokenAddress, 20)).toBe(true);

    // load the ABI from the specified file
    // the call to getAbi will fail if the file does not exist
    const ComptrollerAbi = getAbi(ComptrollerAbiFile);
    expect(typeof ComptrollerAbi).toBe('object');
    const cTokenAbi = getAbi(cTokenAbiFile);
    expect(typeof cTokenAbi).toBe('object');
  });

  it('excludeAddresses key required', () => {
    const { excludeAddresses } = config;
    expect(Array.isArray(excludeAddresses)).toBe(true);
    excludeAddresses.forEach((address) => {
      // check that the address is a valid address
      expect(ethers.utils.isHexString(address, 20)).toBe(true);
    });
  });
});

describe('test createMarketAttackAlert', () => {
  let protocolName;
  let protocolAbbreviation;
  let developerAbbreviation;
  let compTokenSymbol;
  let compTokenAddress;
  let mintAmount;
  let mintTokens;
  let maliciousAddress;
  let maliciousAmount;

  beforeAll(async () => {
    protocolName = config.protocolName;
    protocolAbbreviation = config.protocolAbbreviation;
    developerAbbreviation = config.developerAbbreviation;
  });

  it('returns a proper finding', () => {
    compTokenSymbol = 'TEST';
    compTokenAddress = '0x1234';

    const expectedFinding = Finding.fromObject({
      name: `${protocolName} cToken Market Attack Event`,
      description: `The address ${maliciousAddress} is potentially manipulating the cToken ${compTokenSymbol} market`,
      alertId: `${developerAbbreviation}-${protocolAbbreviation}-MARKET-ATTACK-EVENT`,
      type: FindingType.Suspicious,
      severity: FindingSeverity.Info,
      protocol: protocolName,
      metadata: {
        compTokenSymbol,
        compTokenAddress,
        mintAmount,
        mintTokens,
        maliciousAddress,
        maliciousAmount,
      },
    });

    const finding = createMarketAttackAlert(
      protocolName,
      protocolAbbreviation,
      developerAbbreviation,
      compTokenSymbol,
      compTokenAddress,
      mintAmount,
      mintTokens,
      maliciousAddress,
      maliciousAmount,
    );

    expect(finding).toStrictEqual(expectedFinding);
  });
});

// tests
describe('monitor compound for attacks on cToken markets', () => {
  describe('handleTransaction', () => {
    let initializeData;
    let protocolName;
    let protocolAbbreviation;
    let developerAbbreviation;
    let override;
    let handleTransaction;
    let mockedCompTokenContract;
    let mockComptrollerContract;
    let mockTxEvent;
    let compTokenAbi;
    let compTokenInterface;

    /* eslint-disable prefer-const */
    let validCompTokenAddress = `0x1${'0'.repeat(39)}`;
    let validCompTokenSymbol = 'TEST';
    let validAttackAddress = `0x9${'0'.repeat(39)}`;
    /* eslint-enable prefer-const */

    beforeEach(async () => {
      initializeData = {};

      mockComptrollerContract = {
        getAllMarkets: jest.fn().mockReturnValueOnce([validCompTokenAddress]),
      };

      mockedGetContract.mockReturnValueOnce(mockComptrollerContract);

      mockedCompTokenContract = {
        symbol: jest.fn().mockReturnValueOnce(validCompTokenSymbol),
      };

      mockedGetContract.mockReturnValueOnce(mockedCompTokenContract);

      // initialize the handler
      await (provideInitialize(initializeData))();
      handleTransaction = provideHandleTransaction(initializeData);

      protocolName = initializeData.protocolName;
      protocolAbbreviation = initializeData.protocolAbbreviation;
      developerAbbreviation = initializeData.developerAbbreviation;

      compTokenAbi = initializeData.compTokenAbi;
      compTokenInterface = new ethers.utils.Interface(compTokenAbi);

      mockTxEvent = createTransactionEvent({
        receipt: {
          logs: [],
        },
      });
    });

    it('returns empty findings if no direct transfer events were emitted in the transaction', async () => {
      mockComptrollerContract.getAllMarkets.mockReturnValueOnce([]);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns empty findings if no mint events were emitted in the transaction', async () => {
      mockComptrollerContract.getAllMarkets.mockReturnValueOnce([]);

      override = {
        from: validAttackAddress,
        to: validCompTokenAddress,
        amount: 0,
      };

      const transferEventAbi = compTokenInterface.getEvent('Transfer');
      const transferEvent = createMockEventLogs(transferEventAbi, compTokenInterface, override);

      const transferLog = {
        address: validAttackAddress,
        topics: transferEvent.mockTopics,
        args: transferEvent.mockArgs,
        data: transferEvent.data,
        signature: transferEventAbi.format(ethers.utils.FormatTypes.minimal).substring(6),
      };

      mockTxEvent.receipt.logs.push(transferLog);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
    });

    it('returns finding if attacker minted cTokens and made a direct transfer in the transaction', async () => {
      mockComptrollerContract.getAllMarkets.mockReturnValueOnce([]);

      const maliciousAmount = '10000';

      override = {
        from: validAttackAddress,
        to: validCompTokenAddress,
        amount: maliciousAmount.toString(),
      };

      const transferEventAbi = compTokenInterface.getEvent('Transfer');
      const transferEvent = createMockEventLogs(transferEventAbi, compTokenInterface, override);

      const transferLog = {
        address: validAttackAddress,
        topics: transferEvent.mockTopics,
        args: transferEvent.mockArgs,
        data: transferEvent.data,
        signature: transferEventAbi.format(ethers.utils.FormatTypes.minimal).substring(6),
      };

      mockTxEvent.receipt.logs.push(transferLog);

      const mintAmount = '1';
      const mintTokens = '100';

      override = {
        minter: validAttackAddress,
        mintAmount,
        mintTokens,
      };

      const mintEventAbi = compTokenInterface.getEvent('Mint');
      const mintEvent = createMockEventLogs(mintEventAbi, compTokenInterface, override);

      const mintLog = {
        address: validCompTokenAddress,
        topics: mintEvent.mockTopics,
        args: mintEvent.mockArgs,
        data: mintEvent.data,
        signature: mintEventAbi.format(ethers.utils.FormatTypes.minimal).substring(6),
      };

      mockTxEvent.receipt.logs.push(mintLog);

      const findings = await handleTransaction(mockTxEvent);

      const expectedFinding = createMarketAttackAlert(
        protocolName,
        protocolAbbreviation,
        developerAbbreviation,
        validCompTokenSymbol,
        validCompTokenAddress,
        mintAmount,
        mintTokens,
        validAttackAddress,
        maliciousAmount,
      );

      expect(findings).toStrictEqual([expectedFinding]);
    });

    it('returns finding if new market was added and attacked', async () => {
      const newCompTokenAddress = `0x2${'0'.repeat(39)}`;
      const newCompSymbol = 'NEWTEST';

      mockComptrollerContract.getAllMarkets.mockReturnValueOnce([newCompTokenAddress]);

      mockedCompTokenContract = {
        symbol: jest.fn().mockReturnValueOnce(newCompSymbol),
      };

      mockedGetContract.mockReturnValueOnce(mockedCompTokenContract);

      const maliciousAmount = '10000';

      override = {
        from: validAttackAddress,
        to: newCompTokenAddress,
        amount: maliciousAmount.toString(),
      };

      const transferEventAbi = compTokenInterface.getEvent('Transfer');
      const transferEvent = createMockEventLogs(transferEventAbi, compTokenInterface, override);

      const transferLog = {
        address: validAttackAddress,
        topics: transferEvent.mockTopics,
        args: transferEvent.mockArgs,
        data: transferEvent.data,
        signature: transferEventAbi.format(ethers.utils.FormatTypes.minimal).substring(6),
      };

      mockTxEvent.receipt.logs.push(transferLog);

      const mintAmount = '1';
      const mintTokens = '100';

      override = {
        minter: validAttackAddress,
        mintAmount,
        mintTokens,
      };

      const mintEventAbi = compTokenInterface.getEvent('Mint');
      const mintEvent = createMockEventLogs(mintEventAbi, compTokenInterface, override);

      const mintLog = {
        address: newCompTokenAddress,
        topics: mintEvent.mockTopics,
        args: mintEvent.mockArgs,
        data: mintEvent.data,
        signature: mintEventAbi.format(ethers.utils.FormatTypes.minimal).substring(6),
      };

      mockTxEvent.receipt.logs.push(mintLog);

      const findings = await handleTransaction(mockTxEvent);

      const expectedFinding = createMarketAttackAlert(
        protocolName,
        protocolAbbreviation,
        developerAbbreviation,
        newCompSymbol,
        newCompTokenAddress,
        mintAmount,
        mintTokens,
        validAttackAddress,
        maliciousAmount,
      );

      expect(findings).toStrictEqual([expectedFinding]);
    });
  });
});
