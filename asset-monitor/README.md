# Compound cToken Underlying Asset Monitor

## Description

This bot monitors the underlying asset of Compound Finance cToken contracts.  First
it determines which assets are deployed using upgradable proxy contracts and then it
monitors those contracts for any upgrade events to detect when the implementation for
a cToken's underlying asset may have changed.

## Alerts

<!-- -->
- AE-COMP-CTOKEN-ASSET-UPGRADED
  - Emitted for any proxy pattern specified in `bot-config.json`
  - Type is set to the pattern specific value in `bot-config.json`
  - Severity is set to the pattern specific value in `bot-config.json`
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