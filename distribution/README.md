# Compound Distribution Monitor

## Description

This bot monitors the Compound Finance Comptroller contract for distribution events and
if an amount of COMP is distributed that exceeds a configurable maximum amount an alert is generated.

## Alerts

<!-- -->
- AE-COMP-EXCEEDS-SANE-DISTRIBUTION-EVENT
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Amount of COMP distributed
    - COMP index

## Testing

The following transactions can be used to test the operation of this bot.

0xf4bfef1655f2092cf062c008153a5be66069b2b1fedcacbf4037c1f3cc8a9f45
0xbc246c878326f2c128462d08a0b74048b1dbee733adde8863f569c949c06422a

To run, use:
`npm run tx {transactionHash}`