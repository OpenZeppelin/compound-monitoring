# Compound Protocol Monitoring

This repository contains Forta Bot scripts that can be deployed to the Forta Network to monitor
transactions that occur with Compound Protocol smart contracts.

## Bots

### Governance Event Monitor

This bot monitors the Compound Finance GovernorBravo contract for specific emitted events related
to Proposals and Voting.  All alert types and severities are set to Info.

### Compound Distribution Monitor

This bot monitors the Compound Finance Comptroller contract for distribution events that exceed a 
set of configurable parameters. Alert type is set to INFO and severity is set to INFO.

### cToken Transaction Monitor

This bot monitors Compound Finance cToken contracts for common market events like Mint, Borrow,
etc.  Monitored events are specified in the bot-config.json file, with associated Finding types
and severities for each one.

### Large Borrows Governance Monitor

This bot monitors all borrow events of COMP to see if the borrower address has accrued enough COMP
to pass significant governance thresholds. This can be an early indication of governance attacks.

### Oracle Price Monitor

This bot monitors the UniswapAnchoredProxy contract for PriceGuarded events which indicate that
a ValidatorProxy reported a cToken price that is outside of the Uniswap V2 TWAP percent threshold.
Alert type is set to Degraded and severity is set to High.

## Autotasks

### Underlying Asset Autotask

This Autotask sends alerts to Compound's Discord channel when Openzeppelin's Defender Forta Sentinel picks up on an alert for the COMP Underlying Asset bot.

### cToken Transaction Autotask

This Autotask sends alerts to Compound's Discord channel when Openzeppelin's Defender Forta Sentinel picks up on an alert for the cToken Transaction bot.

### Compound Distribution Autotask

This Autotask sends alerts to Compound's Discord channel when Openzeppelin's Defender Forta Sentinel picks up on an alert for the Compound Governance bot.

### Compound Governance Autotask

This Autotask sends alerts to Compound's Discord channel when Openzeppelin's Defender Forta Sentinel picks up on an alert for the Compound Governance bot.

### Compound Large Borrows Governance Autotask

This Autotask sends alerts to Compound's Discord channel when Openzeppelin's Defender Forta Sentinel picks up on an alert for the Compound Large Borrows bot.

### Oracle Price Autotask

This Autotask sends alerts to Compound's Discord channel when Openzeppelin's Defender Forta Sentinel picks up on an alert for the Compound Price Oracle bot.