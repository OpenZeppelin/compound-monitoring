# Compound Large Borrows Governance Agent

## Description

This agent monitors all borrow events of COMP to see if the borrower address has accrued enough COMP
to pass significant governance thresholds. This can be an early indication of governance attacks.

## Alerts

<!-- -->
- AE-COMP-GOVERNANCE-THRESHOLD
  - Type is always set to `Suspicious`
  - Severity is set to `Medium` for the proposal threshold alert and `High` for the voting quorum
    threshold alert
  - Metadata field contains:
    - Borrower address
    - Governance threshold level that has been surpassed, which can be either `proposal` or `votingQuorum`
    - The minimum amount of COMP needed to pass the respective governance threshold
    - The amount of COMP owned by the borrower address

## Testing

Run unit tests:
```
npm test
```

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