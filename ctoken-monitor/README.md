# Compound cToken Event Monitor

## Description

This bot monitors Compound Finance cToken contracts for common market events like Mint, Borrow,
etc.  Monitored events are specified in the bot-config.json file, with associated Finding types
and severities for each one.

This bot also checks the Compound Finance Comptroller contract on every block to compare the most
recent Array of cToken addresses against the previously stored Array.  If any new cTokens were
added, the new cToken address(es) are placed into the Array for monitoring in that block and all
subsequent blocks.

## Alerts

<!-- -->
- AE-COMP-CTOKEN-EVENT
  - Emitted for any event specified in `bot-config.json`
  - Type is set to event specific value in `bot-config.json`
  - Severity is set to event specific value in `bot-config.json`
  - Metadata field contains:
    - cToken symbol
    - cToken address
    - Event name
    - Arguments passed with event (e.g. for Borrow event, includes borrower address, borrowAmount, accountBorrows, and totalBorrows)

## Testing

Borrow (ETH) - 0xcf8a30b55567c988259b08fb219d10bedc3376f612f12d536a045186a566c99c
Liquidate (DAI) - 0x4316c6cb73296b6b5b603a80a267b203d394e049216d71d8e3ff4822e8d7658f
Mint (USDC) - 0xfd200d6d3136ce4f4b91270f8ed7579bf9932e1ce2388b324ee4a281f58047b1
Redeem (ETH) - 0x4b11cee2963cbb2c01cf2c9858a684117ef24ce62a4ffac5738557e14f0276b6
Repay (USDC) - 0x3c59e9ba77e3864f2efdc49df1c9aba83fb202c59ffbbe116c133dbeb327b010