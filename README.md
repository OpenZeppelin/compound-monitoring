# Compound Protocol Monitoring

This repository contains Forta Agent scripts that can be deployed to the Forta Network to monitor
transactions that occur with Compound Protocol smart contracts.

## Agents

### Governance Event Monitor

This agent monitors the Compound Finance GovernorBravo contract for specific emitted events related
to Proposals and Voting.  All alert types and severities are set to Info.

### Large Borrows Governance Monitor

This agent monitors all borrow events of COMP to see if the borrower address has accrued enough COMP
to pass significant governance thresholds. This can be an early indication of governance attacks.

