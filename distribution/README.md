# Compound Distribution Monitor

## Description

This agent monitors the Compound Finance Comptroller contract for distribution events
that exceed a configurable threshold.

## Alerts

<!-- -->
- AE-COMP-DISTRIBUTION-EVENT
  - Type is always set to `Suspicious`
  - Severity is always set to `High`
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