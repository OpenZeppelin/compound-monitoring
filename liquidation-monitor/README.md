# Compound Liquidation Monitor

## Description

This bot detects when an account on Compound is able to be liquidated.

## Optimizations

- Although there are ~400k accounts using Compound, limiting the search to 1 wei ETH borrowed reduces the tracked accounts down to just over 9000. A nearly 98% reduction in assets being tracked.
- Lowering the maxHealth setting will further reduce this list.
- Initial account information can be obtained from Compound API.
- Account balances only need to be updated/added if they perform a negative health action such as removing collateral or borrowing tokens.
- Tracking qty of cTokens for supplied is preferred because it is static and the value includes interest earned per block.
- Likewise, qty of Tokens for borrowed is preferred because borrowed tokens do not earn interest.
### To-Do
- Initial import can be done from onchain activity.

### Limitations
- The supplied tokens are tracked accurately and gain value over time. The borrowed tokens have a variable interest rate that changes per block, which is not accounted for in this bot implementation. To compensate for the borrowed skew, the `lowHealthThreshold` in the `bot-config.json` can be increased. Additionally, restarting the bot will pull the most current account balances.

## Supported Chains

- Ethereum
## Alerts

<!-- -->
- AE-COMP-LIQUIDATION-THRESHOLD
  - Fired when an account on Compound has a liquidatable position due to price changes or other change in health factor.
  - Severity is configurable in `agent-config.json`
  - Type is configurable in `agent-config.json`
  - Metadata field contains the borrower's address, liquidatable amount and total shortfall amount.
