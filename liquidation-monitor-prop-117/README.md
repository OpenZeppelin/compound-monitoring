# Compound Liquidation Monitor

## Description

This Bot is a modified version of the Compound Liquidatable Positions Monitor Bot. This Bot checks for all accounts on Compound that have cEther listed as an asset and have a non-zero borrow amount.

## Initialization

- This Bot checks for all Borrow events that have ever occurred on the Compound protocol (uses eth_getLogs).
- Borrow events are used to determine which accounts have performed borrows.
- Due to the number of Borrow events that have occurred, the initialization of this Bot may take approximately 4-5 minutes.

## Operation

- Transactions are checked for Borrow and MarketExited events. These events indicate that an account's health factor may have been negatively affected and should be recalculated. The account is then added to an Array for calculation during the block handler execution.
- The block handler will calculate the health factor for all accounts that have not had it calculated yet. For the first execution of the block handler, this will be for ALL accounts found in the initialization step.
- For subsequent executions of the block handler, the number of accounts that need to have their health factor calculated should be very small (likely zero for most blocks).
- Accounts that do not list cEther are removed.

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

## Autotask

This Autotask sends alerts from Openzeppelin's Defender Forta Sentinels to Compound's Discord channel.

### Testing

The Autotask files contain code to facilitate development and testing of OpenZeppelin Defender Autotasks.

Rather than creating Autotask scripts in the Defender Web App and then waiting for appropriate blockchain events to trigger a Forta Sentinel, this code allows a developer to specify a mocked finding alert. Those alerts are then fed directly into the Autotask in the same format that they would have if they were occurring live.

### Autotask Setup
- Create a .env file that contains the name of your discord webhook and the URL for it:
  - ex.) `discordUrl = "discord_webhook_url"`