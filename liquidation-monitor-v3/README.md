# Compound v3 Comet Liquidation Monitor

## Description

This bot detects when an account on Compound is able to be liquidated.

## Supported Chains

- Kovan

## Alerts

<!-- -->
- AE-COMP-LIQUIDATION-THRESHOLD
  - Fired when an account on Compound has a liquidatable position due to price changes or other change in risk factor.
  - Severity is configurable in `bot-config.json`
  - Type is configurable in `bot-config.json`
  - Metadata field contains the borrower's address and block it was detected.
