# Compound cToken Underlying Asset Monitor

## Description

This agent monitors the underlying asset of Compound Finance cToken contracts.  First
it determines which assets are deployed using upgradable proxy contracts and then it
monitors those contracts for any upgrade events to detect when the implementation for
a cToken's underlying asset may have changed.

## Alerts

<!-- -->
- AE-COMP-CTOKEN-ASSET-UPGRADED
  - Emitted for any proxy pattern specified in `agent-config.json`
  - Type is set to the pattern specific value in `agent-config.json`
  - Severity is set to the pattern specific value in `agent-config.json`
  - Metadata field contains:
    - cToken symbol
    - cToken address
    - underlyingAssetAddress
    - Arguments passed with event (e.g. for new implementation address)

## Testing

- AAVE - 0xb505725d0d622207af8ad6bfbd2f9a5031795fe62de9163d54173fbfbbe655e4
- TUSD - 0x125823f2914e4f14e06b9b1b30fe9dd9512b36354cc1f6c063118c4fe03d8287
- USDP - 0xeea8b8f0f0b7125bda2f78ee2f62eb031418be78e09a2fae892eb58f13837ceb
- USDC - 0xe2e40640ffd5f76538cd23660cf56f00bfebd5fe925ebad6b8067c4cee18a2c3

## Autotask

This autotask sends alerts from Openzepplin's Defender Forta Sentinel's to Compound's Disord channel. 

### Testing

The Autotask files contain code to facilitate development and testing of OpenZeppelin Defender Autotasks.

Rather than creating Autotask scripts in the Defender Web App and then waiting for appropriate blockchain events
to trigger a Forta Sentinel, this code allows a developer to specify a range of blocks to use for retrieving alerts
from the Forta Public API.  Those alerts are then fed directly into the Autotask in the same format that they would
have if they were occurring live.

### Use of Jest

This code uses Jest to override the `defender-relay-client` module.  That module can be used to create a JSON-RPC provider
in the Defender environment, but because we are not running in that environment, we can simplify the approach by using a
standard ethers JSONRPCProvider instead.

The use of `describe` and `it` is currently only necessary because we are using Jest for the module override.

### Autotask Setup
- Create an `autotask-config.json` file with the following format:
```
{
  "jsonRpcUrl": "https://your.preferred.json.rpc.endpoint/with/api-key",
  "agentId": "0xFORTAAGENTIDHERE",
  "startBlockNumber": <integer_for_starting_block_number>,
  "endBlockNumber": <integer_for_ending_block_number>
}
```
- Create a .env file that contains the name of your discord webook and the url for it:
  - ex.) `FortaSentinelTestingDiscord = "discord_webhook_url"`