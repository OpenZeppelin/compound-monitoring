# Compound Oracle Price Monitor Agent

## Description

This agent monitors the UniswapAnchoredProxy contract for PriceGuarded events which indicate that
a ValidatorProxy reported a cToken price that is outside of the Uniswap V2 TWAP percent threshold.

## Alerts

<!-- -->
- AE-COMP-CTOKEN-PRICE-REJECTED
  - Type is always set to `Degraded`
  - Severity is always set to `High`
  - Metadata field contains:
    - Address of the affected cToken
    - Address of the underlying token
    - Address of the respective ValidatorProxy contract
    - Anchor Price (current price)
    - Reporter Price (failed price)

## Testing

Running against a real transaction:
```
npx forta-agent run --tx 0xe9456ccee1b1764dfe80291f3b894a29f0789f20f995de7d88ff186e8cafe55c
```

Run unit tests:
```
npm test
```

## Autotask

This Autotask sends alerts from Openzeppelin's Defender Forta Sentinels to Compound's Discord channel.

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
- Create a .env file that contains the name of your discord webhook and the URL for it:
  - ex.) `FortaSentinelTestingDiscord = "discord_webhook_url"`