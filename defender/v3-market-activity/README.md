# Compound V3 Defender Monitoring

- `market_activity` (Market Monitor)

## Market Monitor

### Description

Monitors Compound V3 USDC and WETH Comet contracts deployed on Ethereum. These monitors notify via Discord when any of the following events occur:

- AbsorbCollateral
- AbsorbDebt
- BuyCollateral
- Supply
- SupplyCollateral
- Transfer
- TransferCollateral
- Withdraw
- WithdrawCollateral
- WithdrawReserves

### Deployment

Uses Defender's serverless deployment to deploy and remove monitors. The USDC and WETH monitors are deployed in unique stacks each containing Relay, Sentinel, and Autotask components. To deploy:

1. Create a `secrets.yml` file patterned after the included `secret-example.yml`

2. Change directories to the `market_activity` directory

3. Deploy WETH market monitor `serverless deploy -c serverless_WETH_mainnet.yml`

4. Deploy USDC market monitor `serverless deploy -c serverless_USDC_mainnet.yml`

5. Deploy USDC polygon market monitor `serverless deploy -c serverless_USDC_polygon.yml`

To remove deployment:

1. Create a `secrets.yml` file patterned after the included `secret-example.yml`

2. Change directories to the `market_activity` directory

3. Remove WETH market monitor `serverless remove -c serverless_WETH_mainnet.yml`

4. Remove USDC market monitor `serverless remove -c serverless_USDC_mainnet.yml`

5. Remove USDC polygon market monitor `serverless remove -c serverless_USDC_polygon.yml`
