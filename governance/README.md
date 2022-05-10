# Compound Governance Event Monitor

## Description

This agent monitors the Compound Finance GovernorBravo contract for specific emitted events related
to Proposals and Voting.  All alert types and severities are set to Info.

## Alerts

<!-- -->
- AE-COMP-GOVERNANCE-PROPOSAL-CREATED
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Address of GovernorBravo contract
    - Proposal ID
    - Proposer address
    - Target addresses for calls to be made during proposal execution
    - Values to be passed to target calls during proposal execution, named "_values" due to a naming collision with JavaScript Object method name
    - Function signatures to be passed during proposal execution
    - Call datas to be passed to each individual function during proposal execution 
    - Starting block for voting period
    - Ending block for voting period
    - Description of proposal

<!-- -->
- AE-COMP-GOVERNANCE-VOTE-CAST
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Address of GovernorBravo contract
    - Voter address
    - Number of votes cast by voter
    - Reason string that accompanies vote 
    - First line of proposal description

<!-- -->
- AE-COMP-GOVERNANCE-PROPOSAL-CANCELED
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Address of GovernorBravo contract
    - Proposal ID
    - State of proposal
    - First line of proposal description

<!-- -->
- AE-COMP-GOVERNANCE-PROPOSAL-EXECUTED
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Address of GovernorBravo contract
    - Proposal ID
    - State of proposal
    - First line of proposal description

<!-- -->
- AE-COMP-GOVERNANCE-PROPOSAL-QUEUED
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Address of GovernorBravo contract
    - End block number for proposal to be queued (eta)
    - Proposal ID
    - State of proposal
    - First line of proposal description

<!-- -->
- AE-COMP-GOVERNANCE-PROPOSAL-THRESHOLD-SET
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Address of GovernorBravo contract
    - Old proposal threshold
    - New proposal threshold


## Testing

The following transactions can be used to test the operation of this agent.

ProposalCanceled - 0x30e5bc0fc04394f505f7edf782bf6a7d5595c2e4c15106358847d24cb9d37a4d
ProposalCreated - 0xb8128ed644be6448123acd0dcc082c8c54d4c999ed1561b82aa405dbd19c84b1
ProposalExecuted - 0x00e6174a179bb8e34d8835a8f4111d659e3b40ab73ee1c073c7917156b0eeff6
ProposalQueued - 0xfd2ccca6807f3a8fd5cd63d62a760759cc7496238255b6f0f2bb2bde68d63f16
ProposalThresholdSet - 0x849061327963a1de927a1cccffaed34631a3962b272a7efbf0caef945fb4e7d3
VoteCast - 0xd3b303df1c7cd21bc8442f436cda91a1ee00872eab212d74ba5ccd8ea067c760

To run, use:
`npm run tx {transactionHash}`

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