# Compound cToken Underlying Asset Monitor

## Description

This agent monitors the underlying asset of Compound Finance cToken contracts, first
it determines which assets are deployed using upgradable proxy contracts and then it
monitors those contracts for any upgrade events to detect when the implementation for
a cTokens asset may have changed.

## Alerts

<!-- -->
- AE-COMP-CTOKEN-ASSET-UPGRADED
  - Emitted for any proxy pattern specified in `agent-config.json`
  - Type is set to the pattern specific value in `agent-config.json`
  - Severity is set to the pattern specific value in `agent-config.json`
  - Metadata field contains:
    - cToken symbol
    - cToken address
    - underlyingAssetAddress
    - Arguments passed with event (e.g. for new implementation address)

## Testing

0xb505725d0d622207af8ad6bfbd2f9a5031795fe62de9163d54173fbfbbe655e4