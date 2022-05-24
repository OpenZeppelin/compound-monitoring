# Compound Distribution Monitor

## Description

This agent monitors the Compound Finance Comptroller contract for distribution events using a heuristic that
attempts to find potentially dangerous distributions. First it determines if a distribution exceeds a 
configurable minimum amount of COMP, next it checks the amount of COMP accrued in the previous block and if that
amount is non-zero it checks the ratio of that distribution to the amount of COMP actually transferred and if it
exceeds a configurable ratio an alert is generated.

## Alerts

<!-- -->
- AE-COMP-DISTRIBUTION-EVENT
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Amount of COMP distributed
    - Amount of COMP accrued
    - Receiver address

## Testing

The following transactions can be used to test the operation of this agent.

0xf4bfef1655f2092cf062c008153a5be66069b2b1fedcacbf4037c1f3cc8a9f45
0xbc246c878326f2c128462d08a0b74048b1dbee733adde8863f569c949c06422a

To run, use:
`npm run tx {transactionHash}`

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