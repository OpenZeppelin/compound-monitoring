const {
  Finding, FindingType, FindingSeverity,
} = require('forta-agent');

// Mock the data from the Bot finding
// Random block
const mockBlockHash = '0x1110890564dbd87ca848b7107487ae5a7d28da1b16707bccd3ba37381ae33419';

const mockCreatedTxHash = '0xcab21dadc18ca7c28ec204225ee350558322506df50e12b290b4b563bef0e773';
const mockCreatedName = 'Compound Governance Proposal Created';
const mockCreatedMeta = {
  _values: '0,0,0,0,0',
  address: '0xc0Da02939E1441F497fd74F78cE7Decb17B66529',
  calldatas: '0x0000000000000000000000005d3a536e4d6dbd6114cc1ead35777bab948e36430000000000000000000000000000000000000000000000000b72fd2103b28000,0x000000000000000000000000face851a4921ce59e912d19329929ce6da6eb0c70000000000000000000000000000000000000000000000000aaf96eb9d0d0000,0x00000000000000000000000095b4ef2869ebd94beb4eee400a99824bf5dc325b0000000000000000000000000000000000000000000000000a217b21de090000,0x00000000000000000000000039aa39c021dfbae8fac545936693ac917d5e75630000000000000000000000000000000000000000000000000b72fd2103b28000,0x00000000000000000000000080a2ae356fc9ef4305676f7a3e2ed04e12c339460000000000000000000000000000000000000000000000000a217b21de090000',
  description: "# Risk Parameter Updates for 5 Collateral Assets\n## Simple Summary\n\nA proposal to adjust five (5) parameters for five (5) Compound assets.\n\n## Background\n\nGauntlet's simulation engine has ingested the latest market and liquidity data following the recent market crash. This proposal is a batch update of risk parameters to align with the [Moderate risk level](https://www.comp.xyz/t/community-risk-level-consensus-check/2437) chosen by the Compound community. These parameter updates are the eleventh of Gauntlet's regular parameter recommendations as part of [Dynamic Risk Parameters](https://www.comp.xyz/t/dynamic-risk-parameters/2223/16).\n\n[Full proposal and forum discussion](https://www.comp.xyz/t/risk-parameter-updates-2022-05-18/3253)\n\n## Motivation and Specification\n\nThis set of parameter updates seeks to maintain the overall risk tolerance of the protocol while making risk trade-offs between specific assets.\n\nOur parameter recommendations are driven by an optimization function that balances 3 core metrics: insolvencies, liquidations, and borrow usage. Our parameter recommendations seek to optimize for this objective function. For more details, please see [Gauntlet's Parameter Recommendation Methodology](https://medium.com/gauntlet-networks/gauntlets-parameter-recommendation-methodology-8591478a0c1c) and [Gauntlet's Model Methodology](https://medium.com/gauntlet-networks/gauntlets-model-methodology-ea150ff0bafd).\n\n![](https://i.imgur.com/995NEMj.png)\n\n## Dashboard\n\nGauntlet has launched the [Compound Risk Dashboard](https://gov.gauntlet.network/compound). The community should use the Dashboard to understand better the updated parameter suggestions and general market risk in Compound.\n\nValue at Risk represents the 95th percentile **insolvency value** that occurs from simulations we run over a range of volatility to approximate a tail event. \n\nLiquidations at Risk represents the 95th percentile **liquidation volume** that occurs from simulations we run over a range of volatilities to approximate a tail event.\n\nThese parameter changes increase borrow usage by 28 basis points with no change in Value at Risk or Liquidations at Risk.\n\nOur recent [market downturn report](https://www.comp.xyz/t/compound-market-downturn-risk-review-may-2022/3251) showed that many collaterals are resilient to insolvencies, as our simulation models have predicted. \n\nSince the recent market crash, user positions are generally more highly collateralized, partly due to previously lowly collateralized positions having been liquidated during the crash. Many top whale suppliers repaid some of their borrows during the crash, thus avoiding liquidations. As a result, Gauntlet's simulations reflect that Compound can prudently increase collateral factors post-crash.\n\nNote that we are proposing increasing collateral factors for the stablecoins USDC and DAI. Recursive borrowing has decreased in the past month for both assets. The partially recursive positions have a substantial amount of other collateral assets locked, thus leading to a low chance of insolvency in those positions, as our simulation results reflect. \n\n![](https://i.imgur.com/WXeWl1n.png)",
  endBlock: '14858534',
  id: '107',
  proposer: '0x683a4F9915D6216f73d6Df50151725036bD26C02',
  signatures: '_setCollateralFactor(address,uint256),_setCollateralFactor(address,uint256),_setCollateralFactor(address,uint256),_setCollateralFactor(address,uint256),_setCollateralFactor(address,uint256)',
  startBlock: '14838824',
  targets: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B,0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B,0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B,0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B,0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
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

function createFortaSentinelEvent(finding, findingName, blockHash, tryTxHash) {
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
          name: findingName,
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
  it('Runs autotask against mock Borrow data and posts in Discord (manual-check)', async () => {
    const mockFinding = createFinding(mockCreatedMeta);
    const autotaskEvent = createFortaSentinelEvent(
      mockFinding,
      mockCreatedName,
      mockBlockHash,
      mockCreatedTxHash,
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
