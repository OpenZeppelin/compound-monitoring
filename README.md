# Compound Protocol Monitoring

This repository contains Forta Agent scripts that can be deployed to the Forta Network to monitor
transactions that occur with Compound Protocol smart contracts.

## Agents

### Governance Event Monitor

This agent monitors the Compound Finance GovernorBravo contract for specific emitted events related
to Proposals and Voting.  All alert types and severities are set to Info.

### cToken Transaction Monitor

This agent monitors Compound Finance cToken contracts for common market events like Mint, Borrow,
etc.  Monitored events are specified in the agent-config.json file, with associated Finding types
and severities for each one.
