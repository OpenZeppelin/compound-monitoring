# Compound Liquidation Monitor

## Description

This agent detects when an account on Compound is able to be liquidated.

## Optimizations

- Although there are ~400k accounts using Compound, limit the search to 1 wei ETH borrowed it will reduce the tracked accounts down to just over 9000. A nearly 98% reduction in assets being tracked.
- Lowering the maxHealth setting will further reduce this list.
- Initial account information can be obtained from Compound API
- Account balances only need to be updated/added if they perform a negative health action such as removing collateral or borrowing tokens.
- Tracking qty of cTokens for supplied is preferred because it is static and the value includes interest earned per block.
- Likewise, qty of Tokens for borrowed is preferred because borrowed tokens do not earn interest.
### To-Do
- Initial import can be done from onchain activity.
- Prioritizing only the top x worst accounts can be done with maxTrackedAccounts.

## Supported Chains

- Ethereum
