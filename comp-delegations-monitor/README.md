# Compound Delegate Votes Governance Bot

## Description

This bot monitors all DelegateVotesChanged events emitted by the COMP token contract to see if an address has been delegated enough COMP to pass significant governance thresholds.

## Alerts

- AE-COMP-GOVERNANCE-DELEGATE-THRESHOLD
  - Fired when a delegate's balance is the minimum governance threshold level for `proposal` or `votingQuorum`
  - Type is always set to `Suspicious`
  - Severity is set to `Medium` for the proposal threshold alert and `High` for the voting quorum threshold alert
  - Metadata field contains:
    - Delegate Address
    - Governance threshold level that has been surpassed, which can be either `proposal` or `votingQuorum`
    - The minimum amount of COMP needed to pass the respective governance threshold
    - The amount of COMP owned by the delegate address