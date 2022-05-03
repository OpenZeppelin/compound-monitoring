# Compound Protocol Monitoring

This repository contains Forta Agent scripts that can be deployed to the Forta Network to monitor
transactions that occur with Compound Protocol smart contracts.

## Agents

### Governance Event Monitor

This agent monitors the Compound Finance GovernorBravo contract for specific emitted events related
to Proposals and Voting.  All alert types and severities are set to Info.

### Compound Distribution Monitor

This agent monitors the Compound Finance Comptroller contract for distribution events that exceed a 
set of configurable parameters. All alert types and severities are set to Info.

### cToken Transaction Monitor

This agent monitors Compound Finance cToken contracts for common market events like Mint, Borrow,
etc.  Monitored events are specified in the agent-config.json file, with associated Finding types
and severities for each one.

### Large Borrows Governance Monitor

This agent monitors all borrow events of COMP to see if the borrower address has accrued enough COMP
to pass significant governance thresholds. This can be an early indication of governance attacks.

### Oracle Price Monitor

This agent monitors the UniswapAnchoredProxy contract for PriceGuarded events which indicate that
a ValidatorProxy reported a cToken price that is outside of the Uniswap V2 TWAP percent threshold.
Alert type is set to Degraded and severity is set to High.
