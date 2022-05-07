# Compound Distribution Monitor

## Description

This bot monitors the Compound Finance Comptroller contract for distribution events using a heuristic that
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

The following transactions can be used to test the operation of this bot.

0xf4bfef1655f2092cf062c008153a5be66069b2b1fedcacbf4037c1f3cc8a9f45
0xbc246c878326f2c128462d08a0b74048b1dbee733adde8863f569c949c06422a

To run, use:
`npm run tx {transactionHash}`