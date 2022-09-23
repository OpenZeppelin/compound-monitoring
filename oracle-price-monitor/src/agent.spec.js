// mock definitions for UniswapAnchoredView contract
const mockTokenConfig = [];
const mockUniswapAnchoredViewContract = {
  getTokenConfigBySymbolHash: jest.fn().mockResolvedValue(mockTokenConfig),
};

// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersProvider: jest.fn(),
  ethers: {
    ...jest.requireActual('ethers'),
    Contract: jest.fn().mockReturnValue(mockUniswapAnchoredViewContract),
  },
}));

const {
  ethers,
  TransactionEvent,
  Finding,
  FindingType,
  FindingSeverity,
} = require('forta-agent');

// local definitions
const {
  UNI_ANCHORED_VIEW_ADDRESS, provideInitialize, provideHandleTransaction,
} = require('./agent');
const abi = require('../abi/UniswapAnchoredView.json');

// bot tests
describe('handleTransaction', () => {
  let initializeData;
  let handleTransaction;

  beforeEach(async () => {
    initializeData = {};
    // initialize the handler
    await (provideInitialize(initializeData))();
    handleTransaction = provideHandleTransaction(initializeData);
    // ensure that the mockTokenConfig Array is empty before running tests
    mockTokenConfig.splice(0, mockTokenConfig.length);
  });

  it('returns no findings when the PriceGuarded event is not emitted', async () => {
    // build mock receipt for mock txEvent, in this case the log event topics will not correspond to
    // the PriceGuarded event so we should not expect to see a finding
    const mockTopics = [
      ethers.utils.id('mockEvent(indexed address)'),
      ethers.utils.defaultAbiCoder.encode(
        ['address'],
        ['0x1111111111111111111111111111111111111111'],
      ),
    ];
    const mockReceipt = {
      logs: [{
        address: UNI_ANCHORED_VIEW_ADDRESS,
        topics: mockTopics,
        data: '0x',
      }],
    };

    // create the mock txEvent
    const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

    // run the bot
    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
  });

  it('returns a finding when the PriceGuarded event is emitted', async () => {
    // set the result values for the getTokenConfigBySymbolHash mocked contract call
    mockTokenConfig.push(
      '0xCTOKENADDRESS',
      '0xUNDERLYINGTOKENADDRESS',
      ethers.utils.HashZero,
      ethers.BigNumber.from(1),
      0,
      ethers.BigNumber.from(1),
      '0xUNISWAPMARKETADDRESS',
      '0xREPORTERADDRESS',
      ethers.BigNumber.from(1),
      false,
    );

    // build mock receipt for mock txEvent, this time the event logs will contain a PriceGuarded
    // event and the bot should return a finding as a result
    const iface = new ethers.utils.Interface(abi);
    const mockTopics = iface.encodeFilterTopics('PriceGuarded', [0x1]);
    const mockData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [100, 10]);
    const mockReceipt = {
      logs: [{
        address: UNI_ANCHORED_VIEW_ADDRESS,
        topics: mockTopics,
        data: mockData,
      }],
    };

    // create the mock txEvent
    const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

    // run the bot
    const findings = await handleTransaction(txEvent);
    const expectedFinding = Finding.fromObject({
      name: 'Compound Oracle Price Monitor',
      description: 'The new price reported by ValidatorProxy 0xREPORTERADDRESS was rejected '
        + 'for cToken 0xCTOKENADDRESS',
      alertId: 'AE-COMP-CTOKEN-PRICE-REJECTED',
      type: FindingType.Degraded,
      severity: FindingSeverity.High,
      metadata: {
        cTokenAddress: '0xCTOKENADDRESS',
        underlyingTokenAddress: '0xUNDERLYINGTOKENADDRESS',
        validatorProxyAddress: '0xREPORTERADDRESS',
        anchorPrice: '10',
        reporterPrice: '100',
        protocolVersion: '2',
      },
    });
    expect(findings).toStrictEqual([expectedFinding]);
  });

  it('returns no findings when the UniAnchoredView contract address is not involved', async () => {
    // build mock receipt for mock txEvent
    // the event logs will contain a PriceGuarded event but the address will not match, so no
    // findings should be generated
    const iface = new ethers.utils.Interface(abi);
    const mockTopics = iface.encodeFilterTopics('PriceGuarded', [0x1]);
    const mockData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [100, 10]);
    const mockReceipt = {
      logs: [{
        address: '0xMOCKADDRESS',
        topics: mockTopics,
        data: mockData,
      }],
    };

    // create the mock txEvent
    const txEvent = new TransactionEvent(null, null, null, mockReceipt, [], [], null);

    // run the bot
    const findings = await handleTransaction(txEvent);
    expect(findings).toStrictEqual([]);
  });
});
