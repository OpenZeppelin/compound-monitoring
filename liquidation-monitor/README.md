# Compound Liquidation Monitor

## Description

This agent detects when an account on Compound is able to be liquidated.

## Optimizations

- Although there are ~400k accounts using Compound, limit the search to 1 wei ETH borrowed it will reduce the tracked accounts down to just over 9000. A nearly 98% reduction in assets being tracked.
- Lowering the maxHealth setting will further reduce this list.
- Prioritizing only the top x worst accounts can be done with maxTrackedAccounts.
- Accounts can be updated based on current health vs changes in the token prices. Example: An account with a 10.0 health score would require 90% change in asset prices before it becomes unhealthy. Therefore, an asset price change of less than 80% would not require a new health calculation. The change in value would include both borrowed asset increasing and the supplied asset decreasing.
- If the dataset is small enough, all accounts can be updated each block.
- Initial account information can be obtained from Compound API or other API.
- Account balances only need to be updated/added if they perform a negative health action such as removing collateral or borrowing tokens.
- All other on-chain data updates to accounts can happen automatically as their health score gets closer to 1.0 or the assets that they hold change in value significantly.
- Tracking qty of cTokens for supplied is preferred because it is static and the value includes interest earned per block.
- Likewise, qty of Tokens for borrowed is preferred because borrowed tokens do not earn interest.

## Supported Chains

- Ethereum
