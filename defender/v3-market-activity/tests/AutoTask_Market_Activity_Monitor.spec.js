const { ethers } = require('ethers');

const ASSET_DATA = {
  COMP: {
    assetDecimals: '18',
    assetSymbol: 'COMP',
    assetPrice: ethers.BigNumber.from('5477543887'),
    contractInfo: {
      offset: 0,
      asset: '0xc00e94cb662c3520282e6f5717214004a7f26888',
      priceFeed: '0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5',
      scale: ethers.BigNumber.from('1000000000000000000'),
    },
  },
  WBTC: {
    assetDecimals: '8',
    assetSymbol: 'WBTC',
    assetPrice: ethers.BigNumber.from('1902277109072'),
    contractInfo: {
      offset: 1,
      asset: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      priceFeed: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
      scale: ethers.BigNumber.from('100000000'),
    },
  },
  WETH: {
    assetDecimals: '18',
    assetSymbol: 'WETH',
    assetPrice: ethers.BigNumber.from('134452848749'),
    contractInfo: {
      offset: 2,
      asset: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      priceFeed: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
      scale: ethers.BigNumber.from('1000000000000000000'),
    },
  },
  UNI: {
    assetDecimals: 18,
    assetSymbol: 'UNI',
    assetPrice: ethers.BigNumber.from('811444978'),
    contractInfo: {
      offset: 3,
      asset: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
      priceFeed: '0xDA5904BdBfB4EF12a3955aEcA103F51dc87c7C39',
      scale: ethers.BigNumber.from('1000000000000000000'),
    },
  },
  LINK: {
    assetDecimals: 18,
    assetSymbol: 'LINK',
    assetPrice: ethers.BigNumber.from('921000000'),
    contractInfo: {
      offset: 4,
      asset: '0x514910771af9ca656af840dff83e8264ecf986ca',
      priceFeed: '0x396c5E36DD0a0F5a5D33dae44368D4193f69a1F0',
      scale: ethers.BigNumber.from('0x0de0b6b3a7640000'),
    },
  },
  USDC: {
    assetDecimals: 6,
    assetSymbol: 'USDC',
    assetPrice: ethers.BigNumber.from('100000000'),
    contractInfo: {
      offset: 4,
      asset: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      priceFeed: '0x396c5E36DD0a0F5a5D33dae44368D4193f69a1F0',
      scale: ethers.BigNumber.from('0x0de0b6b3a7640000'),
    },
  },
};

// Create data for mocked call to Comet's getAssetInfoByAddress
const ASSET_DATA_BY_ASSET = {};
Object.values(ASSET_DATA).forEach((item) => {
  ASSET_DATA_BY_ASSET[item.contractInfo.asset] = item.contractInfo;
});
console.log(`ASSET_DATA_BY_ASSET: ${JSON.stringify(ASSET_DATA_BY_ASSET, null, 2)}`);

// mock the axios package
const acceptedPost = {
  status: 204,
  statusText: 'No Content',
};

const mockProvider = {
  getLogs: jest.fn(),
};

// mock the defender-relay-client package
jest.mock('defender-relay-client/lib/ethers', () => ({
  DefenderRelayProvider: jest.fn().mockReturnValue(mockProvider),
}));

// Mock Comet contract
const mockContract = {
  symbol: jest.fn(),
  decimals: jest.fn(),
  underlying: jest.fn(),
  numAssets: jest.fn().mockResolvedValue(ASSET_DATA.length),
  getAssetInfoByAddress: jest.fn().mockImplementation(
    (id) => ASSET_DATA_BY_ASSET[id.toLowerCase()],
  ),
  getPrice: jest.fn(),
  baseToken: jest.fn().mockResolvedValue('0x081693E7A42189F6805333b12ECDB0F7f7bc1a9b'),
  baseScale: jest.fn().mockResolvedValue(ethers.BigNumber.from('1000000')),
  baseTokenPriceFeed: jest.fn().mockResolvedValue('0x9211c6b3BF41A10F78539810Cf5c64e1BB78Ec60'),
  userBasic: jest.fn(),
  totalsBasic: jest.fn().mockResolvedValue([
    ethers.BigNumber.from('1000000000000000'), // Base Supply Index
    ethers.BigNumber.from('1000000000000000'), // Base Borrow Index
    ethers.BigNumber.from('0'),
    ethers.BigNumber.from('0'),
    ethers.BigNumber.from('0'),
    ethers.BigNumber.from('0'),
    ethers.BigNumber.from('0'),
    ethers.BigNumber.from('0'),
  ]),
  baseIndexScale: jest.fn().mockResolvedValue(ethers.BigNumber.from('1000000000000000')),
  provider: mockProvider,
};

// Mock price feed contract
const mockPriceFeedContract = {
  decimals: jest.fn().mockResolvedValue(8),
};

// Mock the ethers.Contract class
// - use the passed abi to determine which mock to return
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn().mockImplementation((address, abi) => {
    if (abi.format === undefined) {
      // 'latestRoundData' is from the price feed contracts
      if (abi.includes('function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)')) {
        return mockPriceFeedContract;
      }
    }
    return mockContract;
  }),
}));

jest.mock('axios', () => jest.fn().mockResolvedValue(acceptedPost));
// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');

jest.mock('axios-retry', () => jest.fn());

const { abi: cometAbi } = require('./Comet.json');

const cometAddress = '0x'.concat('7'.repeat(40));
const testAddress = '0x5a803c73ce60f3f54e8db263c8033286c313ec3f';
const testAddressTwo = '0xf3ce313c6823308c362bd8e45f3f06ec37c308a5';
const zeroAddress = ethers.constants.AddressZero;

const { handler } = require('../market_activity/autotask-1/index');

const emptyAutoTaskEvent = {
  trigger: 'sentinel',
  secrets: {
    market_activity_USDC_mainnet_webhookURL: 'http://localhost/index.html',
    market_activity_networkName: 'mainnet',
  },
  request: {
    body: {
      hash: '0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe',
      transaction: {
        blockNumber: 2,
        transactionHash: '0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe',
        transactionIndex: 0,
      },
      blockHash: '0xc95c2e4dd85540840390197a2b9f053104c68de39e218a8c0f2a565005e657a7',
      matchReasons: {},
      matchedAddresses: [
        '0xcC861650dc6f25cB5Ab4185d4657a70c923FDb27',
      ],
      sentinel: {
        name: 'USDC Market Monitor',
        abi: cometAbi,
        addresses: [cometAddress],
        network: 'mainnet',
      },
    },
  },
};

const rawLogTemplate = {
  blockNumber: 2,
  blockHash: '0xdfa05358e354cebaba43fabede4f4b73c70341e3d9f83a57c8f85fda6eadc350',
  transactionIndex: 0,
  address: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
  data: '',
  transactionHash: '0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe',
  logIndex: 0,
  topics: [],
};

// Create event signatures
const cometContract = new ethers.utils.Interface(cometAbi);
const supplyCollateralSignature = cometContract.getEventTopic('SupplyCollateral');
const withdrawCollateralSignature = cometContract.getEventTopic('WithdrawCollateral');
const transferCollateralSignature = cometContract.getEventTopic('TransferCollateral');
const buyCollateralSignature = cometContract.getEventTopic('BuyCollateral');
const supplySignature = cometContract.getEventTopic('Supply');
const transferSignature = cometContract.getEventTopic('Transfer');
const withdrawSignature = cometContract.getEventTopic('Withdraw');
const absorbCollateralSignature = cometContract.getEventTopic('AbsorbCollateral');
const absorbDebtSignature = cometContract.getEventTopic('AbsorbDebt');
const withdrawReservesSignature = cometContract.getEventTopic('WithdrawReserves');

function createRawLog(logValues) {
  console.log(JSON.stringify(logValues, null, 2));

  // Overwrite rawLogTemplate keys from logValues
  const rawLogValues = { ...rawLogTemplate, ...logValues };

  // Encode the array of data and save to raw log
  // - not portable, assumes all data is of type 'uint'
  const typesArray = Array(logValues.data.length).fill('uint');
  rawLogValues.data = ethers.utils.defaultAbiCoder.encode(typesArray, logValues.data);

  // Add topics
  rawLogValues.topics = [];
  // - Add call signature
  rawLogValues.topics.push(logValues.eventSignature);
  // - Add parameters
  //   not portable, assumes parameters are of type 'address'
  logValues.eventArguments.forEach((item) => {
    rawLogValues.topics.push(ethers.utils.defaultAbiCoder.encode(['address'], [item]));
  });

  return rawLogValues;
}

describe('check autotask', () => {
  const url = 'http://localhost/index.html';
  const headers = { 'Content-Type': 'application/json' };
  const method = 'post';

  beforeEach(async () => {
    axios.mockClear();
    mockContract.symbol.mockReset();
    mockContract.decimals.mockReset();
    mockContract.underlying.mockReset();
    mockContract.getPrice.mockReset();
    mockContract.userBasic.mockReset();
    mockProvider.getLogs.mockReset();
    mockContract.userBasic.mockReset();
  });

  it('Test discord post of a mocked Supply event', async () => {
    const openingPrincipal = '0'; // $0
    const supplyAmount = '300000000'; // $300
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📥 **$300 of USDC** Supply by 0x5A80' };

    const testValues = {
      eventSignature: supplySignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [supplyAmount],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(openingPrincipal), 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked Repay & Supply event', async () => {
    const openingPrincipal = '-300000000'; // $-300
    const supplyAmount = '500000000'; // $500
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📥 **$300 of USDC** Repay by 0x5A80\n   📥 **$200 of USDC** Supply by 0x5A80' };

    const testValues = {
      eventSignature: supplySignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [supplyAmount],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic
      .mockResolvedValueOnce([openingPrincipal, 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked Repay event', async () => {
    const openingPrincipal = '-9950000000'; // $-995
    const supplyAmount = '5000000'; // $5
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📥 **$5 of USDC** Repay by 0x5A80' };

    const testValues = {
      eventSignature: supplySignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [supplyAmount],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(openingPrincipal), 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked Supply small amount event', async () => {
    // Event should not be reported
    const openingPrincipal = '200000000'; // $200
    const supplyAmount = '2222'; // $.002222

    const testValues = {
      eventSignature: supplySignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [supplyAmount],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([openingPrincipal, 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    expect(mockContract.userBasic).toBeCalledTimes(1);
    // Event should be dropped due to supply amount too low to report
    expect(axios).toBeCalledTimes(0);
  });

  it('Test discord post of a mocked SupplyCollateral event', async () => {
    const {
      contractInfo,
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.LINK;

    const {
      assetSymbol: baseAssetSymbol,
    } = ASSET_DATA.USDC;

    const {
      asset: assetAddress,
    } = contractInfo;
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 🐳📈 **$3,684 of LINK** SupplyCollateral by 0x5A80' };

    const testValues = {
      eventSignature: supplyCollateralSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
        assetAddress, // asset
      ],
      data: ['400000000000000000000'],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(baseAssetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(0), 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked Transfer event', async () => {
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 🔄 **$500 of USDC** Transfer by 0x5A80' };

    const testValues = {
      eventSignature: transferSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: ['500000001'],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    // 2 Transfer events in one AutoTask Event
    mockContract.decimals
      .mockResolvedValueOnce(assetDecimals);
    mockContract.symbol
      .mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice
      .mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(0), 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked Withdraw event', async () => {
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📤 **$10 of USDC** Borrow by 0x5A80' };

    const testValues = {
      eventSignature: withdrawSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: ['10000000'],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(0), 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked Withdraw & Borrow event', async () => {
    // User's base principal is $10, withdraw $510, so withdraw amount is $10
    //   and borrow amount is $500
    // - in production, our call to the smart contract will reflect the
    //   after-transaction principal amount
    // - Before transaction: principal($10), withdraw($510)
    // - After transaction: principal($-500), withdraw($510)
    const openingPrincipal = '10000000'; // $10
    const withdrawAmount = '510000000'; // $510
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📤 **$10 of USDC** Withdraw by 0x5A80\n   📤 **$500 of USDC** Borrow by 0x5A80' };

    const testValues = {
      eventSignature: withdrawSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [withdrawAmount],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic
      .mockResolvedValueOnce([openingPrincipal, 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked Borrow event', async () => {
    const openingPrincipal = '-10000000'; // $-10
    const withdrawAmount = '400000000'; // $400
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📤 **$400 of USDC** Borrow by 0x5A80' };

    const testValues = {
      eventSignature: withdrawSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [withdrawAmount],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([openingPrincipal, 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked Withdraw to zero account balance event', async () => {
    const openingPrincipal = '400000000'; // $400
    const withdrawAmount = '400000000'; // $400
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📤 **$400 of USDC** Withdraw by 0x5A80' };

    const testValues = {
      eventSignature: withdrawSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [withdrawAmount],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([openingPrincipal, 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked Repay to zero account balance event', async () => {
    const openingPrincipal = '-400000000'; // $-400
    const supplyAmount = '400000000'; // $400
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📥 **$400 of USDC** Repay by 0x5A80' };

    const testValues = {
      eventSignature: supplySignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [supplyAmount],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([openingPrincipal, 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked WithdrawCollateral event', async () => {
    const {
      contractInfo,
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.LINK;

    const {
      assetSymbol: baseAssetSymbol,
    } = ASSET_DATA.USDC;

    const {
      asset: assetAddress,
    } = contractInfo;
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 🐳📉 **$1,842 of LINK** WithdrawCollateral by 0x5A80' };

    const testValues = {
      eventSignature: withdrawCollateralSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
        assetAddress, // asset
      ],
      data: ['200000000000000000000'],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(baseAssetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(0), 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked TransferCollateral event', async () => {
    const {
      contractInfo,
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.UNI;

    const {
      assetSymbol: baseAssetSymbol,
    } = ASSET_DATA.USDC;

    const {
      asset: assetAddress,
    } = contractInfo;
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 🔄 **$8 of UNI** TransferCollateral by 0x5A80' };

    const testValues = {
      eventSignature: transferCollateralSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
        assetAddress, // asset
      ],
      data: ['1000000000000000000'],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(baseAssetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(0), 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked AbsorbCollateral mocked event', async () => {
    const {
      contractInfo,
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.UNI;

    const {
      assetSymbol: baseAssetSymbol,
    } = ASSET_DATA.USDC;

    const {
      asset: assetAddress,
    } = contractInfo;
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 🐳 ♻ **$4,057 of UNI** AbsorbCollateral by 0x5A80' };

    const testValues = {
      eventSignature: absorbCollateralSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
        assetAddress, // asset
      ],
      data: [
        '500000000000000000001',
        '5000000000',
      ],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(baseAssetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(0), 0, 0, 0, 0]);

    // run the autoTask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked AbsorbDebt event', async () => {
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>)  ♻ **$500 of USDC** AbsorbDebt by 0x5A80' };

    const testValues = {
      eventSignature: absorbDebtSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [
        '500000001',
        '5000000000',
      ],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(0), 0, 0, 0, 0]);

    // run the autoTask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of a mocked BuyCollateral event', async () => {
    const {
      contractInfo,
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.UNI;

    const {
      assetSymbol: baseAssetSymbol,
    } = ASSET_DATA.USDC;

    const {
      asset: assetAddress,
    } = contractInfo;
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 💱 **$40 of UNI** BuyCollateral by 0x5A80' };

    const testValues = {
      eventSignature: buyCollateralSignature,
      eventArguments: [
        testAddress, // buyer
        assetAddress, // asset
      ],
      data: [
        '5000000000000000000',
        '5000000000000000000',
      ],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);
    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(baseAssetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(0), 0, 0, 0, 0]);

    // run the autotask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post of one transaction with mocked AbsorbCollateral, AbsorbDebt and Transfer events, followed by a transaction with mocked Supply and Withdraw events for the liquidated address', async () => {
    /* This is a regression test for a bug we discovered.
     *
     * This test case was added to check the principal calculation when an AbsorbDebt event occurs
     * before Supply and Withdraw events.
     *
     * The reason for this test case is that the AbsorbDebt event affects the principal calculation
     * for the user whose debt is absorbed (i.e. the user whose funds are being liquidated), but the
     * updated principal does not directly affect the message shown in Discord.
     *
     * We discovered a bug in our initial implementation that caused the AbsorbDebt event processing
     * to return NaN as the updated principal, but because we had never seen a Withdraw or a Supply
     * event occur AFTER that AbsorbDebt event WITHIN THE SAME BLOCK and FROM THE ADDRESS OF THE
     * USER WHO WAS LIQUIDATED, we did not see the bug manifested in any Discord messages.
     *
     * The scenario is the following:
     *
     * Transaction 1: User A (absorber) calling 'absorb()' for User B's account
     * - AbsorbCollateral event emitted
     *   - User B has his collateral and debt transferred directly to the protocol
     *   - This event does not affect User A's principal calculation
     *   - If more than one asset is absorbed, this event will be emitted once for each asset
     * - AbsorbDebt event emitted
     *   - This indicates how much of the base asset was credited to User B based on the value of
     *     the liquidated collateral assets
     * - Transfer event emitted
     *   - This is emitted at the end of the `absorbInternal` function if User B's new principal is
     *     great than zero
     *
     * Transaction 2: User B supplying an amount of the base asset and borrowing more than supplied
     * - Supply event emitted
     *   - User B supplies an amount of the base asset to the Comet contract
     * - Withdraw event emitted
     *   - User B withdraws more of the base asset than they just supplied
     *
     * NOTE: If the AbsorbDebt event were not factored correctly into the principal calculation, the
     * Withdraw event would show up as a Withdraw & Borrow. If the AbsorbDebt event IS correctly
     * affecting the principal, then it will show up as a Withdraw only.
     */
    const {
      contractInfo,
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.UNI;

    const {
      assetDecimals: baseAssetDecimals,
      assetSymbol: baseAssetSymbol,
      assetPrice: baseAssetPrice,
    } = ASSET_DATA.USDC;

    const openingPrincipal = '0'; // $0
    const supplyAmount = '300000000'; // $300
    const withdrawAmount = '800000000'; // $800

    // transaction 1 Discord messages
    const linesTransactionOne = [
      '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 🐳 ♻ **$4,057 of UNI** AbsorbCollateral by 0xf3ce',
      '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>)  ♻ **$500 of USDC** AbsorbDebt by 0x5A80',
      '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📥 **$300 of USDC** Supply by 0x5A80',
      '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📤 **$800 of USDC** Withdraw by 0x5A80',
    ];

    const {
      asset: assetAddressUni,
    } = contractInfo;

    // absorber, liquidated account, asset
    const testAbsorbCollateralValues = {
      eventSignature: absorbCollateralSignature,
      eventArguments: [
        testAddressTwo, // src
        testAddress, // dst
        assetAddressUni, // asset
      ],
      data: [
        '500000000000000000001',
        '5000000000',
      ],
    };

    // absorber, liquidated account
    const principalAfterAbsorbDebt = '500000001';
    const testAbsorbDebtValues = {
      eventSignature: absorbDebtSignature,
      eventArguments: [
        testAddressTwo, // src
        testAddress, // dst
      ],
      data: [
        principalAfterAbsorbDebt,
        '5000000000',
      ],
    };

    // zero address, liquidated account
    const testTransferValues = {
      eventSignature: transferSignature,
      eventArguments: [
        zeroAddress, // src
        testAddress, // dst
      ],
      data: [principalAfterAbsorbDebt],
    };

    // from, to
    const testSupplyValues = {
      eventSignature: supplySignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [supplyAmount],
    };

    const testWithdrawValues = {
      eventSignature: withdrawSignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [withdrawAmount],
    };

    const rawAbsorbCollateralLog = createRawLog(testAbsorbCollateralValues);
    const rawAbsorbDebtLog = createRawLog(testAbsorbDebtValues);
    const rawTransferLog = createRawLog(testTransferValues);
    const rawSupplyLog = createRawLog(testSupplyValues);
    const rawWithdrawLog = createRawLog(testWithdrawValues);
    mockProvider.getLogs
      .mockResolvedValueOnce([
        rawAbsorbCollateralLog, // transaction 1
        rawAbsorbDebtLog, // transaction 1
        rawTransferLog, // transaction 1
        rawSupplyLog, // transaction 2
        rawWithdrawLog, // transaction 2
      ]);

    // mock all decimals() calls
    mockContract.decimals
      .mockResolvedValueOnce(assetDecimals) // AbsorbCollateral
      .mockResolvedValueOnce(baseAssetDecimals) // AbsorbDebt
      .mockResolvedValueOnce(baseAssetDecimals) // Transfer
      .mockResolvedValueOnce(baseAssetDecimals) // Supply
      .mockResolvedValueOnce(baseAssetDecimals); // Withdraw

    // mock all symbol() calls
    mockContract.symbol
      .mockResolvedValueOnce(baseAssetSymbol) // AbsorbCollateral
      .mockResolvedValueOnce(assetSymbol) // AbsorbCollateral
      .mockResolvedValueOnce(baseAssetSymbol) // AbsorbDebt
      .mockResolvedValueOnce(baseAssetSymbol) // AbsorbDebt
      .mockResolvedValueOnce(baseAssetSymbol) // Transfer
      .mockResolvedValueOnce(baseAssetSymbol) // Transfer
      .mockResolvedValueOnce(baseAssetSymbol) // Supply
      .mockResolvedValueOnce(baseAssetSymbol) // Supply
      .mockResolvedValueOnce(baseAssetSymbol) // Withdraw
      .mockResolvedValueOnce(baseAssetSymbol); // Withdraw

    // mock all getPrice() calls
    mockContract.getPrice
      .mockResolvedValueOnce(assetPrice) // AbsorbCollateral
      .mockResolvedValueOnce(baseAssetPrice) // AbsorbDebt
      .mockResolvedValueOnce(baseAssetPrice) // Transfer
      .mockResolvedValueOnce(baseAssetPrice) // Supply
      .mockResolvedValueOnce(baseAssetPrice); // Withdraw

    // mock all userBasic() calls
    // called once per account per Autotask execution
    mockContract.userBasic
      .mockResolvedValueOnce([ethers.BigNumber.from(0), 0, 0, 0, 0]) // testAddressTwo
      .mockResolvedValueOnce([
        ethers.BigNumber.from(openingPrincipal),
        0,
        0,
        0,
        0,
      ]) // testAddressOne
      .mockResolvedValueOnce([ethers.BigNumber.from(0), 0, 0, 0, 0]); // zeroAddress

    await handler(emptyAutoTaskEvent);
    // once per address per Autotask execution
    // (three addresses involved)
    expect(mockContract.userBasic).toBeCalledTimes(3);
    // once for each event, but NOT for the Transfer event, because it will have the zero address
    // as the sender argument
    // we do not create messages for Transfer events that have the zero address as either the
    // sending or the receiving address
    // Once for each of these:
    //   - AbsorbCollateral
    //   - AbsorbDebt
    //   - Supply
    //   - Withdraw
    expect(axios).toBeCalledTimes(4);

    linesTransactionOne.forEach((line, i) => {
      const expectedCall = {
        url,
        headers,
        method,
        data: {
          content: line,
        },
      };
      const index = -1 * (linesTransactionOne.length - i);
      expect(axios.mock.calls.slice(index)[0][0]).toStrictEqual(expectedCall);
    });
  });

  it('Test discord post of a mocked WithdrawReserves event', async () => {
    const discordPost = { content: '[TX](<https://etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 🐳💸 **$5,000 of USDC** WithdrawReserves by 0x5A80' };

    const testValues = {
      eventSignature: withdrawReservesSignature,
      eventArguments: [
        testAddress, // src
      ],
      data: ['5000000000'],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockClear();
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(0), 0, 0, 0, 0]);

    // run the autoTask on the events
    await handler(emptyAutoTaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('Test discord post on a different network', async () => {
    const openingPrincipal = '0'; // $0
    const supplyAmount = '300000000'; // $300
    const discordPost = { content: '[TX](<https://goerli.etherscan.io/tx/0xd005d864c7c1e614f673a5a086e054de3aab156f9ac3c2a8406c3f08ba96a5fe>) 📥 **$300 of USDC** Supply by 0x5A80' };

    const testValues = {
      eventSignature: supplySignature,
      eventArguments: [
        testAddress, // src
        testAddress, // dst
      ],
      data: [supplyAmount],
    };

    const rawLog = createRawLog(testValues);
    mockProvider.getLogs.mockResolvedValueOnce([rawLog]);

    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol).mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);
    mockContract.userBasic.mockResolvedValue([ethers.BigNumber.from(openingPrincipal), 0, 0, 0, 0]);

    // Deep copy the event and modify the network name
    const autotaskEvent = JSON.parse(JSON.stringify(emptyAutoTaskEvent));
    autotaskEvent.request.body.sentinel.network = 'goerli';
    autotaskEvent.secrets.market_activity_USDC_goerli_webhookURL = 'http://localhost/index.html';

    // run the autotask on the events
    await handler(autotaskEvent);

    const expectedLastCall = {
      url, headers, method, data: discordPost,
    };
    expect(mockContract.userBasic).toBeCalledTimes(1);
    expect(axios).toBeCalledTimes(1);
    expect(axios.mock.lastCall[0]).toStrictEqual(expectedLastCall);
  });

  it('throws error if network does not exist', async () => {
    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);

    // Deep copy the event and modify the network name
    const autotaskEvent = JSON.parse(JSON.stringify(emptyAutoTaskEvent));
    autotaskEvent.request.body.sentinel.network = 'unknown';
    autotaskEvent.secrets.market_activity_USDC_unknown_webhookURL = 'http://localhost/index.html';

    // run the autoTask on the events
    await expect(handler(autotaskEvent)).rejects.toThrow('Block Explorer not found for this network: unknown');

    expect(axios).toBeCalledTimes(0);
  });

  it('throws error if discordUrl is not valid', async () => {
    const {
      assetDecimals,
      assetSymbol,
      assetPrice,
    } = ASSET_DATA.USDC;

    mockContract.decimals.mockResolvedValueOnce(assetDecimals);
    mockContract.symbol.mockResolvedValueOnce(assetSymbol);
    mockContract.getPrice.mockResolvedValue(assetPrice);

    // Deep copy the event and use an invalid discord URL
    const autotaskEvent = JSON.parse(JSON.stringify(emptyAutoTaskEvent));
    autotaskEvent.secrets.market_activity_USDC_mainnet_webhookURL = 'http//zzzz';

    // run the autoTask on the events
    await expect(handler(autotaskEvent)).rejects.toThrow('discordUrl is not a valid URL');

    expect(axios).toBeCalledTimes(0);
  });

  it('throws error on empty autoTask members', async () => {
    // pass an undefined autoTask
    let autotaskEvent;
    await expect(handler(autotaskEvent)).rejects.toThrow('body undefined');

    // pass an undefined autoTask.handler
    autotaskEvent = { request: undefined };
    await expect(handler(autotaskEvent)).rejects.toThrow('body undefined');

    // pass an undefined autoTask.handler.body
    autotaskEvent = { request: { body: undefined } };
    await expect(handler(autotaskEvent)).rejects.toThrow('body undefined');

    expect(axios).toBeCalledTimes(0);
  });

  it('throws error on invalid sentinel name, must contain USDC or WETH', async () => {
    // Deep copy the event and use an invalid discord URL
    const autotaskEvent = JSON.parse(JSON.stringify(emptyAutoTaskEvent));
    autotaskEvent.request.body.sentinel.name = 'Market Monitor';

    // run the autoTask on the events
    await expect(handler(autotaskEvent)).rejects.toThrow('Invalid Sentinel name(Market Monitor).  Must contain USDC, ARB, GTX, WBTC or WETH to determine market');

    expect(axios).toBeCalledTimes(0);
  });
});
