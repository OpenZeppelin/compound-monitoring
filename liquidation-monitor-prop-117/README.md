# Compound Liquidation Monitor - Accounts Affected by Proposal 117

## Description

This Bot is a modified version of the Compound Liquidatable Positions Monitor Bot. This Bot checks for all accounts on Compound that have:
- cEther listed as an asset
- A borrow amount greater than a threshold (set to the equivalent of `0.01 ETH` in `bot-config.json`)
- A health factor below a threshold (set to `1.00` in `bot-config.json`)

## Initialization

- This Bot uses a data file that was compiled locally, containing data for all Compound accounts up to a particular block
- When the Bot starts, it retrieves all logs that contain Borrow events from the block used in the data file until the current block

## Operation

- Transactions are checked for Borrow and MarketExited events. These events indicate that an account's health factor may have been negatively affected and should be recalculated. The account is then added to an Array for calculation during the block handler execution.
- The block handler will retrieve all account information for accounts the were found from recent Borrow events.
- For any accounts found in the data file, all account information is already present, up to the block when that data file was created.
- For all account, whether from the data file or newly discovered, the block handler will calculate the health factor.

### Limitations

- The supplied tokens are tracked accurately and gain value over time. The borrowed tokens have a variable interest rate that changes per block, which is not accounted for in this bot implementation. To compensate for the borrowed skew, the `lowHealthThreshold` in the `bot-config.json` can be increased. Additionally, restarting the bot will pull the most current account balances.

## Supported Chains

- Ethereum

## Alerts

<!-- -->
- AE-COMP-LIQUIDATION-THRESHOLD-PROP117
  - Fired when an account on Compound has a liquidatable position where the borrow amount is above a threshold and the account cannot currently be liquidated due to Proposal 117
  - Severity is configurable in `bot-config.json`
  - Type is configurable in `bot-config.json`
  - Metadata field contains data for all accounts that meet the criteria