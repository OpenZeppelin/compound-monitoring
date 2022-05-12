const minLiquidationInUSD = 500;

// Simulated prices of:
//   BTC = $30,000
//   ETH = $3,000
//   USDC = $1
// Bot prices are tracked in ETH denomination.
// Ref: https://docs.1inch.io/docs/spot-price-aggregator/examples
let mockBtcPrice = '100000000000000000000000000000'; // 1 BTC = 10 ETH
let mockEthPrice = '1000000000000000000'; // 1 ETH = 1 ETH
let mockUsdcPrice = '330000000000000000000000000'; // 1 USDC = 0.00033 ETH
let mockCDecimals = 8;
let mockBtcDecimals = 8;
let mockEthDecimals = 18;
let mockUsdcDecimals = 6;
const mockBorrower = '0x1111';

// https://compound.finance/docs/comptroller#get-assets-in
const mockGetAssetsIn = ['0x0cbtc', '0x0ceth'];

// Ref https://compound.finance/docs/comptroller#collateral-factor
let mockBtcCollateralFactor = '700000000000000000'; // 70%
let mockEthCollateralFactor = '850000000000000000'; // 85%
let mockUsdcCollateralFactor = '800000000000000000'; // 80%

// Ref: https://compound.finance/docs/ctokens#exchange-rate
let mockBtcCTokenRate = '20000000000000000'; // 1 cBTC = 0.02 BTC
let mockEthCTokenRate = '200000000000000000000000000'; // 1 cETH = 0.02 ETH
let mockUsdcCTokenRate = '200000000000000'; // 1 cUSDC = 0.02 USDC

// In this mock, ETH Collateral Factor is 0.85 and 1 BTC = 10 ETH.
// Starting data with a user that supplied 10 ETH and borrowed 0.85 BTC.
// Therefore, 10 ETH * 0.85 Collateral Factor = 8.5 ETH Collateral Value
// and .85 BTC = 8.5 ETH Borrowed Value.
// 8.5 ETH Collateral Value / 8.5 ETH Borrowed Value = 1.0 Health Factor
// Ref: https://compound.finance/docs/api#account-service
const mockCompoundData = {
  accounts: [
    {
      address: '0x1111',
      block_updated: null,
      health: {
        value: '1.0',
      },
      tokens: [
        {
          address: '0x0cbtc',
          borrow_balance_underlying: {
            value: '0.85',
          },
        },
        {
          address: '0x0ceth',
          supply_balance_underlying: {
            value: '10.0',
          },
        },
      ],
    },
  ],
  pagination_summary: {
    total_entries: 1,
  },
};
const mockCompoundResponse = {
  data: mockCompoundData,
};

jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue(mockCompoundResponse),
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
  provideInitialize, provideHandleBlock, createAlert,
} = require('./agent');

// Convert the string numbers to ethers.BigNumber
/* eslint-disable new-cap */
mockBtcPrice = new ethers.BigNumber.from(mockBtcPrice);
mockEthPrice = new ethers.BigNumber.from(mockEthPrice);
mockUsdcPrice = new ethers.BigNumber.from(mockUsdcPrice);
mockCDecimals = new ethers.BigNumber.from(mockCDecimals);
mockBtcDecimals = new ethers.BigNumber.from(mockBtcDecimals);
mockEthDecimals = new ethers.BigNumber.from(mockEthDecimals);
mockUsdcDecimals = new ethers.BigNumber.from(mockUsdcDecimals);
mockBtcCollateralFactor = new ethers.BigNumber.from(mockBtcCollateralFactor);
mockEthCollateralFactor = new ethers.BigNumber.from(mockEthCollateralFactor);
mockUsdcCollateralFactor = new ethers.BigNumber.from(mockUsdcCollateralFactor);
mockBtcCTokenRate = new ethers.BigNumber.from(mockBtcCTokenRate);
mockEthCTokenRate = new ethers.BigNumber.from(mockEthCTokenRate);
mockUsdcCTokenRate = new ethers.BigNumber.from(mockUsdcCTokenRate);
const mockEthersZero = new ethers.BigNumber.from(0);

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
    const response = await axios.post('https://...');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(response.data.pagination_summary.total_entries).toEqual(1);

    // reset call count for next test
    axios.post.mockClear();
    expect(axios.post).toHaveBeenCalledTimes(0);
  });
});

// Mock helper functions
function setDefaultMocks() {
  // Set all default mocks

  // Compound API
  axios.post.mockResolvedValue(mockCompoundResponse);

  const {
    getAssetsIn,
    markets,
    getAccountLiquidity,
    getRateToEth,
    decimals,
    getAccountSnapshot,
    symbol,
    underlying,
    exchangeRateStored,
  } = mockContract;

  // Comptroller
  /* eslint-disable new-cap */
  getAssetsIn.mockResolvedValue(mockGetAssetsIn);
  markets.mockResolvedValue([true, mockBtcCollateralFactor, true]);
  getAccountLiquidity.mockResolvedValue([mockEthersZero, mockEthersZero, mockEthersZero]);
  // OneInch
  getRateToEth.mockResolvedValue(mockBtcPrice);
  // ERC20
  decimals.mockResolvedValue(mockBtcDecimals);
  getAccountSnapshot.mockResolvedValue(
    [mockEthersZero, mockEthersZero, mockEthersZero, mockEthersZero],
  );
  symbol.mockResolvedValue('TOKEN');
  underlying.mockResolvedValue('0x0');
  exchangeRateStored.mockResolvedValue(mockBtcCTokenRate);

  // Clear Mock counters before calling initialize
  axios.post.mockClear();
  symbol.mockClear();
  underlying.mockClear();
  exchangeRateStored.mockClear();
  decimals.mockClear();
}

function setVerifyTokenMocks(setSymbol, setUnderlying, setExchange, setDecimals) {
  // Verify token MockOnce - BTC then ETH
  const {
    decimals,
    symbol,
    underlying,
    exchangeRateStored,
  } = mockContract;

  symbol.mockResolvedValueOnce(setSymbol);
  underlying.mockResolvedValueOnce(setUnderlying);
  exchangeRateStored.mockResolvedValueOnce(setExchange);
  decimals.mockResolvedValueOnce(mockCDecimals)
    .mockResolvedValueOnce(setDecimals);
}

// agent tests
describe('initializeData', () => {
  let initializeData = {};

  beforeEach(async () => {
    // Initialize
    initializeData = {};
    setDefaultMocks();
    setVerifyTokenMocks('cBTC', '0x0wbtc', mockBtcCTokenRate, mockBtcDecimals);
    setVerifyTokenMocks('cETH', '0x0weth', mockEthCTokenRate, mockEthDecimals);

    // When calling the verifyToken function, Contract.decimals gets called twice per
    // token. One time for the cToken and then one time for the Token.
    // The token calls seem to be overlapping. Call 1 and 2 don't show up anywhere,
    // but call 3 is applied twice for cBTC and BTC decimals.  Call 4 is applied twice to
    // cETH and ETH decimals... Odd behavior.

    // cBTC and BTC have 8 decimals, so this is no issue but cETH (8) and ETH (18) are differently
    // Changing the 4th call either breaks.

    mockContract.decimals.mockReset();
    mockContract.decimals.mockResolvedValue(new ethers.BigNumber.from(9));
    mockContract.decimals.mockResolvedValueOnce(new ethers.BigNumber.from(1));
    mockContract.decimals.mockResolvedValueOnce(new ethers.BigNumber.from(2));
    mockContract.decimals.mockResolvedValueOnce(new ethers.BigNumber.from(8)); // cBTC and BTC Decimals?
    // mockContract.decimals.mockResolvedValueOnce(new ethers.BigNumber.from(18)); // cETH  and ETH Decimals?
    // mockContract.decimals.mockResolvedValueOnce(new ethers.BigNumber.from(5));
    await (provideInitialize(initializeData))();
  });

  it('should use axios 2 times}', async () => {
    // Check counter from the initialize step.
    expect(axios.post).toBeCalledTimes(2);
  });

  it('should use contract calls}', async () => {
    // Check counters from the initialize step.
    expect(mockContract.symbol).toBeCalledTimes(2);
    expect(mockContract.underlying).toBeCalledTimes(2);
    expect(mockContract.exchangeRateStored).toBeCalledTimes(2);
    expect(mockContract.decimals).toBeCalledTimes(4);
  });

  it('should set user data', async () => {
    // In the compound API mock, the user supplied 0.85 BTC, and borrowed 10 ETH.
    //  to account for interest earned on supplied tokens, this is stored as cTokens.
    // "When a market is launched, the cToken exchange rate (how much ETH one cETH is worth) begins
    //  at 0.020000 — and increases at a rate equal to the compounding market interest rate"
    // Ref: https://compound.finance/docs/ctokens#introduction - Calculate Exchange Rate
    // In this example 10 ETH * (1 cWETH / 0.02 ETH) = 500 cETH.
    const actualSupply = initializeData.supply['0x0ceth']['0x1111'].toString();
    const expectedSupply = '500';
    const actualBorrow = initializeData.borrow['0x0cbtc']['0x1111'].toString();
    const expectedBorrow = '0.85';
    expect(actualSupply).toBe(expectedSupply);
    expect(actualBorrow).toBe(expectedBorrow);
  });

  it('should set BTC token data', async () => {
    // Check BTC stats
    const actualBtcDecimals = initializeData.tokens['0x0cbtc'].tokenDecimals.toString();
    const expectedBtcDecimals = mockBtcDecimals.toString();
    const actualBtcCDecimals = initializeData.tokens['0x0cbtc'].tokenDecimals.toString();
    const expectedBtcCDecimals = mockCDecimals.toString();
    expect(actualBtcDecimals).toBe(expectedBtcDecimals);
    expect(actualBtcCDecimals).toBe(expectedBtcCDecimals);
  });

  it('should set ETH token data', async () => {
    // Check ETH stats
    const actualEthDecimals = initializeData.tokens['0x0ceth'].tokenDecimals.toString();
    const expectedEthDecimals = mockEthDecimals.toString();
    const actualEthCDecimals = initializeData.tokens['0x0ceth'].tokenDecimals.toString();
    const expectedEthCDecimals = mockCDecimals.toString();
    console.log(mockContract.decimals.mock.results);
    console.log(JSON.stringify(mockContract.decimals.mock.results));
    expect(actualEthDecimals).toBe(expectedEthDecimals);
    expect(actualEthCDecimals).toBe(expectedEthCDecimals);
  });
});

// Mock helper function
function setPriceMocks(setPrice, setCollateralFactor, setCTokenRate) {
  const {
    markets,
    getRateToEth,
    exchangeRateStored,
  } = mockContract;

  // Set the once mocks
  getRateToEth.mockResolvedValueOnce(setPrice);
  markets.mockResolvedValueOnce([true, setCollateralFactor, true]);
  exchangeRateStored.mockResolvedValueOnce(setCTokenRate);

  // Clear the counters
  getRateToEth.mockClear();
  markets.mockClear();
  exchangeRateStored.mockClear();
}

describe('handleBlock', () => {
  let initializeData = {};

  beforeEach(async () => {
    // Initialize
    initializeData = {};
    setDefaultMocks();
    setVerifyTokenMocks('cBTC', '0x0wbtc', mockBtcCTokenRate, mockBtcDecimals);
    setVerifyTokenMocks('cETH', '0x0weth', mockEthCTokenRate, mockEthDecimals);
    await (provideInitialize(initializeData))();

    setPriceMocks(mockBtcPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);

    await (provideHandleBlock(initializeData))();

    /*
    // Process the first block to establish prices and health
    // Set block mocks
    // If zero health accounts, getAssets in
    mockContract.getAssetsIn.mockResolvedValueOnce('');
    // VerifyToken if new token
    // setVerifyTokenMocks('cBTC', '0x0wbtc', mockBtcCTokenRate, mockBtcDecimals);
    // Get account snapshots for new accounts / tokens
    mockContract.getAccountSnapshot.mockResolvedValueOnce('');

    // Price/Health update ALL
    mockContract.getRateToEth.mockResolvedValueOnce('');
    // Collateral factor All
    mockContract.markets.mockResolvedValueOnce('');
    // cToken rate
    mockContract.exchangeRateStored.mockResolvedValueOnce('');

    // Low health Mock
    mockContract.getAccountLiquidity.mockResolvedValueOnce('');
    */
  });
  it('should use contract calls', async () => {
    // Check counters from the block / price update step.
    expect(mockContract.getRateToEth).toBeCalledTimes(2);
    expect(mockContract.markets).toBeCalledTimes(2);
    expect(mockContract.exchangeRateStored).toBeCalledTimes(2);
    expect(mockContract.getAccountLiquidity).toBeCalledTimes(1);
  });

  it('returns no findings if borrowed asset increases and remains below minimumLiquidation threshold', async () => {
    // Borrowed BTC increases 1% in value
    // 101% to Decimal since ethers.BigNumber does not like floating point numbers.
    const multiplier = new ethers.BigNumber.from(101).div(100); // "101 / 100 = 1.01"
    const newBTCPrice = mockBtcPrice.mul(multiplier);
    // Calculate shortfall amount
    // JS bigNumber Math, then convert to ethers.BigNumber
    let supplied = initializeData.accounts['0x1111'].supplyBalance.times(100).toString();
    supplied = new ethers.BigNumber.from(supplied).div(100);
    let borrowed = initializeData.accounts['0x1111'].borrowBalance.times(100).toString();
    borrowed = new ethers.BigNumber.from(borrowed).div(100);

    setPriceMocks(newBTCPrice, mockBtcCollateralFactor, mockBtcCTokenRate);
    setPriceMocks(mockEthPrice, mockEthCollateralFactor, mockEthCTokenRate);

    const findings = await (provideHandleBlock(initializeData))();
    expect(findings).toStrictEqual([]);
  });

  // it('returns findings if borrowed asset increases and account exceeds the minimumLiquidation threshold', async () => {
  //   // Borrowed BTC increases 2% in value
  //   data.tokens['0xBTC'] = { price: mockBtcPrice * 1.02 };
  //   const borrowerAddress = mockBorrower;
  //   const liquidationAmount = '713.01';
  //   const shortfallAmount = '727.27';
  //   const healthFactor = '0.98';

  //   const expectedFinding = Finding.fromObject({
  //     name: `${data.protocolName} Liquidation Threshold Alert`,
  //     description: `The address ${mockBorrower} has dropped below the liquidation threshold. `
  //       + `The account may be liquidated for: $${liquidationAmount} USD`,
  //     alertId: `${data.developerAbbreviation}-${data.protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
  //     type: FindingType[data.alert.type],
  //     severity: FindingSeverity[data.alert.severity],
  //     protocol: data.protocolName,
  //     metadata: {
  //       borrowerAddress,
  //       liquidationAmount,
  //       shortfallAmount,
  //       healthFactor,
  //     },
  //   });

  //   // Process Block
  //   const findings = handleMockBlockEvent();
  //   expect(findings).toStrictEqual([expectedFinding]);
  // });

  // it('returns no findings if borrowed asset decreases and remains below minimumLiquidation threshold', async () => {
  //   // Borrowed BTC decreases 1% in value
  //   data.tokens['0xBTC'] = { price: mockBtcPrice * 0.99 };
  //   const findings = handleMockBlockEvent();
  //   expect(findings).toStrictEqual([]);
  // });

  // it('returns no findings if supplied asset decreases and remains below minimumLiquidation threshold', async () => {
  //   // Supplied ETH decreases 1% in value
  //   data.tokens['0xETH'] = { price: mockEthPrice * 0.99 };
  //   const findings = handleMockBlockEvent();
  //   expect(findings).toStrictEqual([]);
  // });

  // it('returns findings if supplied asset decreases and account exceeds the minimumLiquidation threshold', async () => {
  //   // Supplied ETH decreases 2% in value
  //   data.tokens['0xETH'] = { price: mockEthPrice * 0.98 };
  //   const borrowerAddress = mockBorrower;
  //   const liquidationAmount = '712.73';
  //   const shortfallAmount = '727.27';
  //   const healthFactor = '0.98';

  //   const expectedFinding = Finding.fromObject({
  //     name: `${data.protocolName} Liquidation Threshold Alert`,
  //     description: `The address ${mockBorrower} has dropped below the liquidation threshold. `
  //       + `The account may be liquidated for: $${liquidationAmount} USD`,
  //     alertId: `${data.developerAbbreviation}-${data.protocolAbbreviation}-LIQUIDATION-THRESHOLD`,
  //     type: FindingType[data.alert.type],
  //     severity: FindingSeverity[data.alert.severity],
  //     protocol: data.protocolName,
  //     metadata: {
  //       borrowerAddress,
  //       liquidationAmount,
  //       shortfallAmount,
  //       healthFactor,
  //     },
  //   });

  //   const findings = handleMockBlockEvent();
  //   expect(findings).toStrictEqual([expectedFinding]);
  // });

  // it('returns no findings if supplied asset decreases and remains below minimumLiquidation threshold', async () => {
  //   // Supplied ETH decreases 1% in value
  //   data.tokens['0xBTC'] = { price: mockEthPrice * 1.01 };
  //   const findings = handleMockBlockEvent();
  //   expect(findings).toStrictEqual([]);
  // });

});