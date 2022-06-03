const {
  Finding, FindingType, FindingSeverity,
} = require('forta-agent');

// Mock the data from the Bot finding
// Random block
const mockBlockHash = '0x1110890564dbd87ca848b7107487ae5a7d28da1b16707bccd3ba37381ae33419';

const mockLiquidateBorrowTxHash = '0x064228d15febb05b929e8aecbf3d828449bd8210df758d692b9b855355ed3560';
const mockLiquidateBorrowMeta = {
  borrower: '0xf1C6A281452fEdEAda164731895B1a38b5476516',
  cTokenCollateral: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
  cTokenSymbol: 'cUSDT',
  contractAddress: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
  eventName: 'LiquidateBorrow',
  liquidator: '0xD911560979B78821D7b045C79E36E9CbfC2F6C6F',
  repayAmount: '880985666',
  seizeTokens: '2710480386',
  usdValue: '881',
};

const mockMintTxHash = '0xff85476c183ef3cc0fb0623877abf5589197a773845f8acac341e48c42957a3e';
const mockMintMeta = {
  cTokenSymbol: 'cETH',
  contractAddress: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
  eventName: 'Mint',
  mintAmount: '38307619381957671712',
  mintTokens: '190925893578',
  minter: '0x352E490bC98BB07AA908Cc2934b6Ca473a6b229d',
  usdValue: '67721',
};

const mockRedeemTxHash = '0xa1be93b4be553650aec7c4d99dcefcad23c573c5a23004fbc7c0dfe4179d62ce';
const mockRedeemMeta = {
  cTokenSymbol: 'cUSDC',
  contractAddress: '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
  eventName: 'Redeem',
  redeemAmount: '894873',
  redeemTokens: '20224',
  redeemer: '0xb65Ca07fD529f891A14d5Df72CCCD915A59AafF9',
  usdValue: '20224',
};

const mockRepayBorrowTxHash = '0x57a36644b7440ad247a41222ad105d5a08d21b47e434025bcf4427b2c20f3dee';
const mockRRepayBorrowMeta = {
  accountBorrows: '1457196372779',
  borrower: '0xF6aaadA76eA7f044ffA028565b028740Dce5389F',
  cTokenSymbol: 'cUSDC',
  contractAddress: '0x39aa39c021dfbae8fac545936693ac917d5e7563',
  eventName: 'RepayBorrow',
  payer: '0xF6aaadA76eA7f044ffA028565b028740Dce5389F',
  repayAmount: '19985757121',
  totalBorrows: '449947401135954',
  usdValue: '19985',
};

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

const { handler } = require('./autotask');

function createFinding(metadata) {
  return Finding.fromObject({
    name: 'Placeholder Alert',
    description: 'Placeholder description',
    alertId: 'AE-ALERT-ID',
    type: FindingType.Info,
    severity: FindingSeverity.Info,
    protocol: 'Protocol',
    metadata,
  });
}

function createFortaSentinelEvent(finding, blockHash, tryTxHash) {
  // Generally findings go from the Bot, to Scan Node, to Sentinel, to Autotasks
  //  with some metadata being added and removed along the way. This function will mimic
  // the Sentinel output with only Finding, block and transaction data.

  // Note: Much of the extra data here is superfluous but is left here just in case future bots
  // want to reference any of the Sentinel data in the Discord output. It also mimics sentinel
  // output more accurately.

  // On block events, the txHash does not exist
  let txHash;
  if (tryTxHash === undefined || tryTxHash === null) {
    txHash = '';
  } else {
    txHash = tryTxHash;
  }

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
  it('Runs autotask against mock LiquidateBorrow data and posts in Discord (manual-check)', async () => {
    const mockFinding = createFinding(mockLiquidateBorrowMeta);
    const autotaskEvent = createFortaSentinelEvent(
      mockFinding,
      mockBlockHash,
      mockLiquidateBorrowTxHash,
    );

    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mock Mint data and posts in Discord (manual-check)', async () => {
    const mockFinding = createFinding(mockMintMeta);
    const autotaskEvent = createFortaSentinelEvent(mockFinding, mockBlockHash, mockMintTxHash);

    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mock Redeem data and posts in Discord (manual-check)', async () => {
    const mockFinding = createFinding(mockRedeemMeta);
    const autotaskEvent = createFortaSentinelEvent(mockFinding, mockBlockHash, mockRedeemTxHash);

    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('Runs autotask against mock RepayBorrow data and posts in Discord (manual-check)', async () => {
    const mockFinding = createFinding(mockRRepayBorrowMeta);
    const autotaskEvent = createFortaSentinelEvent(
      mockFinding,
      mockBlockHash,
      mockRepayBorrowTxHash,
    );

    // run the autotask on the events
    await handler(autotaskEvent);
  });

  it('throws error if discordUrl is not valid', async () => {
    // Use an invalid discord URL
    secrets.discordUrl = 'http//zzzz';
    const mockFinding = createFinding(mockRedeemMeta);
    const autotaskEvent = createFortaSentinelEvent(mockFinding, mockBlockHash, mockRedeemTxHash);

    // run the autotask on the events
    await expect(handler(autotaskEvent)).rejects.toThrow('discordUrl is not a valid URL');
  });
});
