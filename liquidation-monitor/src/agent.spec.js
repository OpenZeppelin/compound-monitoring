const BigNumber = require('bignumber.js');

// All prices are in ETH
const mockBtcPrice = 12;
const mockEthPrice = 1;
const mockUsdcPrice = 0.00033;
// Same decimals for all tokens
const mockDecimals = 18;
const minLiquidationInUSD = 500;
const mockBorrower = '0x1111';
const mockCTokenRate = '225999372641152';

const mockCompoundData = {
  test: 0,
};
const mockCompoundResponse = {
  data: mockCompoundData,
};

jest.mock('axios', () => ({
  post: jest.fn(),
}));
const axios = require('axios');

const mockContract = {
  // Comptroller
  getAssetsIn: jest.fn(),
  markets: jest.fn(), // returns collateral factor
  getAccountLiquidity: jest.fn(),
  // OneInch
  getRateToEth: jest.fn(),
  // ERC20
  decimals: jest.fn(),
  getAccountSnapshot: jest.fn(),
  symbol: jest.fn(),
  underlying: jest.fn(),
  exchangeRateStored: jest.fn(),
};

// combine the mocked provider and contracts into the ethers import mock
jest.mock('forta-agent', () => ({
  ...jest.requireActual('forta-agent'),
  getEthersProvider: jest.fn(),
  ethers: {
    ...jest.requireActual('ethers'),
    Contract: jest.fn().mockReturnValue(mockContract),
  },
}));

const {
  ethers, Finding, FindingType, FindingSeverity,
} = require('forta-agent');
const config = require('../bot-config.json');

const {
  provideInitialize, createAlert,
} = require('./agent');

// check the configuration file to verify the values
describe('check agent configuration file', () => {
  it('developerAbbreviation key required', () => {
    const { developerAbbreviation } = config;
    expect(typeof (developerAbbreviation)).toBe('string');
    expect(developerAbbreviation).not.toBe('');
  });

  it('protocolName key required', () => {
    const { protocolName } = config;
    expect(typeof (protocolName)).toBe('string');
    expect(protocolName).not.toBe('');
  });

  it('protocolAbbreviation key required', () => {
    const { protocolAbbreviation } = config;
    expect(typeof (protocolAbbreviation)).toBe('string');
    expect(protocolAbbreviation).not.toBe('');
  });

  it('liquidationMonitor key required', () => {
    const { liquidationMonitor } = config;
    expect(typeof (liquidationMonitor)).toBe('object');
    expect(liquidationMonitor).not.toBe({});
  });

  it('comptrollerAddress key required', () => {
    const { liquidationMonitor: { comptrollerAddress } } = config;
    expect(typeof (comptrollerAddress)).toBe('string');
    expect(comptrollerAddress).not.toBe('');
  });

  it('comptrollerABI key required', () => {
    const { liquidationMonitor: { comptrollerABI } } = config;
    expect(typeof (comptrollerABI)).toBe('string');
    expect(comptrollerABI).not.toBe('');
  });

  it('oneInchAddress key required', () => {
    const { liquidationMonitor: { oneInchAddress } } = config;
    expect(typeof (oneInchAddress)).toBe('string');
    expect(oneInchAddress).not.toBe('');
  });

  it('comptrollerAddress key required', () => {
    const { liquidationMonitor: { comptrollerAddress } } = config;
    expect(typeof (comptrollerAddress)).toBe('string');
    expect(comptrollerAddress).not.toBe('');
  });

  it('triggerLevels key required', () => {
    const { liquidationMonitor: { triggerLevels } } = config;
    expect(typeof (triggerLevels)).toBe('object');
    expect(triggerLevels).not.toBe({});
  });

  it('maximumHealth key required', () => {
    const { liquidationMonitor: { triggerLevels: { maximumHealth } } } = config;
    expect(typeof (maximumHealth)).toBe('number');
    expect(maximumHealth).not.toBe('');
  });

  it('minimumBorrowInETH key required', () => {
    const { liquidationMonitor: { triggerLevels: { minimumBorrowInETH } } } = config;
    expect(typeof (minimumBorrowInETH)).toBe('number');
    expect(minimumBorrowInETH).not.toBe('');
  });

  it('minimumLiquidationInUSD key required', () => {
    const { liquidationMonitor: { triggerLevels: { minimumLiquidationInUSD } } } = config;
    expect(typeof (minimumLiquidationInUSD)).toBe('number');
    expect(minimumLiquidationInUSD).not.toBe('');
  });

  it('lowHealthThreshold key required', () => {
    const { liquidationMonitor: { triggerLevels: { lowHealthThreshold } } } = config;
    expect(typeof (lowHealthThreshold)).toBe('number');
    expect(lowHealthThreshold).not.toBe('');
  });

  it('alert key required', () => {
    const { liquidationMonitor: { alert } } = config;
    expect(typeof (alert)).toBe('object');
    expect(alert).not.toBe({});
  });

  it('alert type value must be valid', () => {
    const { liquidationMonitor: { alert: { type } } } = config;
    expect(typeof (type)).toBe('string');
    expect(type).not.toBe('');
    // check type, this will fail if the value of type is not valid
    expect(Object.prototype.hasOwnProperty.call(FindingType, type)).toBe(true);
  });

  it('alert severity value must be valid', () => {
    const { liquidationMonitor: { alert: { severity } } } = config;
    expect(typeof (severity)).toBe('string');
    expect(severity).not.toBe('');
    // check severity, this will fail if the value of severity is not valid
    expect(Object.prototype.hasOwnProperty.call(FindingSeverity, severity)).toBe(true);
  });
});

describe('mock axios POST request', () => {
  it('should call axios.post and return a response', async () => {
    axios.post.mockResolvedValue('test');
    const response = await axios.post('https://...');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(response).toEqual('test');

    // reset call count for next test
    axios.post.mockClear();
    expect(axios.post).toHaveBeenCalledTimes(0);
  });
});

// agent tests
describe('handleBlock', () => {
  let data;
  const initializeData = {};

  function handleMockBlockEvent() {
    // Check all account healths
    const findings = [];
    Object.keys(data.accounts).forEach((currentAccount) => {
      let supplied = BigNumber(0);
      let borrowed = BigNumber(0);
      Object.keys(data.tokens).forEach((token) => {
        try {
          borrowed = borrowed.plus(data.borrow[token][currentAccount] * data.tokens[token].price);
        } catch (err) { /* pass */ }
        try {
          supplied = supplied.plus(data.supply[token][currentAccount] * data.tokens[token].price);
        } catch (err) { /* pass */ }
      });

      const health = supplied.dividedBy(borrowed);
      // Convert to from ETH price to USD.
      supplied = supplied.dividedBy(mockUsdcPrice);
      borrowed = borrowed.dividedBy(mockUsdcPrice);
      // Calculate actual shortfalls and liquidationAmounts
      const shortfallUSD = borrowed.minus(supplied);
      const liquidationAmount = shortfallUSD.times(health);

      // Create a finding if the liquidatable amount is below the threshold
      // Shorten metadata to 2 decimal places
      if (liquidationAmount.gte(minLiquidationInUSD)) {
        const newFinding = createAlert(
          data.developerAbbreviation,
          data.protocolName,
          data.protocolAbbreviation,
          data.alert.type,
          data.alert.severity,
          currentAccount,
          liquidationAmount.dp(2).toString(),
          shortfallUSD.dp(2).toString(),
          health.dp(2).toString(),
        );
        findings.push(newFinding);
      }
    });
    return findings;
  }

  beforeEach(async () => {
    axios.post.mockResolvedValue(mockCompoundResponse);
    provideInitialize(initializeData);
    // console.log(axios.post());
    // mockContract.exchangeRateStored.mockReturnValue(ethers.BigNumber.from(mockCTokenRate));
    // console.log('forta-agent'.ethers.Contract.exchangeRateStored());
    data = {};

    // initialize the handler
    // axois mocking wasn't working as anticipated, so manually configure the settings here.
    data.protocolName = config.protocolName;
    data.protocolAbbreviation = config.protocolAbbreviation;
    data.developerAbbreviation = config.developerAbbreviation;
    data.alert = config.liquidationMonitor.alert;
    data.minimumLiquidationInUSD = config.liquidationMonitor.triggerLevels.minimumLiquidationInUSD;
    data.accounts = { [mockBorrower]: {} };
    // Borrow inverse to the price so that the health factor is 1.0 for the tests
    // Ex prices: ETH = 1 and BTC = 11, so 11 ETH = 1 BTC
    data.supply = { '0xETH': { [mockBorrower]: mockBtcPrice } }; // qty of tokens supplied
    data.borrow = { '0xBTC': { [mockBorrower]: mockEthPrice } }; // qty of tokens borrowed
    // Prices are in ETH
    data.tokens = {
      '0xETH': { price: mockEthPrice },
      '0xBTC': { price: mockBtcPrice },
      '0xUSDC': { price: mockUsdcPrice },
    };
  });

  it('returns should use AXIOS 1 time}', async () => {
    axios.post.mockReset();
    axios.post.mockResolvedValue(mockCompoundResponse);
    // Initialize data and use Axios Post
    provideInitialize(initializeData);
    console.log(axios.post.mock);
    expect(axios.post).toBeCalledTimes(1);
  });

  it('returns no findings if borrowed asset increases and remains below minimumLiquidation threshold', async () => {
    // Borrowed BTC increases 1% in value
    data.tokens['0xBTC'] = { price: mockBtcPrice * 1.01 };
    const findings = handleMockBlockEvent();
    expect(findings).toStrictEqual([]);
  });

  it('returns findings if borrowed asset increases and account exceeds the minimumLiquidation threshold', async () => {
    // Borrowed BTC increases 2% in value
    data.tokens['0xBTC'] = { price: mockBtcPrice * 1.02 };
    const borrowerAddress = mockBorrower;
    const liquidationAmount = '713.01';
    const shortfallAmount = '727.27';
    const healthFactor = '0.98';

    const expectedFinding = Finding.fromObject({
      name: `${data.protocolName} Liquidation Threshold Alert`,
      description: `The address ${mockBorrower} has dropped below the liquidation threshold. `
        + `The account may be liquidated for: $${liquidationAmount} USD`,
      alertId: `${data.developerAbbreviation}-${data.protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
      type: FindingType[data.alert.type],
      severity: FindingSeverity[data.alert.severity],
      protocol: data.protocolName,
      metadata: {
        borrowerAddress,
        liquidationAmount,
        shortfallAmount,
        healthFactor,
      },
    });

    // Process Block
    const findings = handleMockBlockEvent();
    expect(findings).toStrictEqual([expectedFinding]);
  });

  it('returns no findings if borrowed asset decreases and remains below minimumLiquidation threshold', async () => {
    // Borrowed BTC decreases 1% in value
    data.tokens['0xBTC'] = { price: mockBtcPrice * 0.99 };
    const findings = handleMockBlockEvent();
    expect(findings).toStrictEqual([]);
  });

  it('returns no findings if supplied asset decreases and remains below minimumLiquidation threshold', async () => {
    // Supplied ETH decreases 1% in value
    data.tokens['0xETH'] = { price: mockEthPrice * 0.99 };
    const findings = handleMockBlockEvent();
    expect(findings).toStrictEqual([]);
  });

  it('returns findings if supplied asset decreases and account exceeds the minimumLiquidation threshold', async () => {
    // Supplied ETH decreases 2% in value
    data.tokens['0xETH'] = { price: mockEthPrice * 0.98 };
    const borrowerAddress = mockBorrower;
    const liquidationAmount = '712.73';
    const shortfallAmount = '727.27';
    const healthFactor = '0.98';

    const expectedFinding = Finding.fromObject({
      name: `${data.protocolName} Liquidation Threshold Alert`,
      description: `The address ${mockBorrower} has dropped below the liquidation threshold. `
        + `The account may be liquidated for: $${liquidationAmount} USD`,
      alertId: `${data.developerAbbreviation}-${data.protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
      type: FindingType[data.alert.type],
      severity: FindingSeverity[data.alert.severity],
      protocol: data.protocolName,
      metadata: {
        borrowerAddress,
        liquidationAmount,
        shortfallAmount,
        healthFactor,
      },
    });

    const findings = handleMockBlockEvent();
    expect(findings).toStrictEqual([expectedFinding]);
  });

  it('returns no findings if supplied asset decreases and remains below minimumLiquidation threshold', async () => {
    // Supplied ETH decreases 1% in value
    data.tokens['0xBTC'] = { price: mockEthPrice * 1.01 };
    const findings = handleMockBlockEvent();
    expect(findings).toStrictEqual([]);
  });
});
