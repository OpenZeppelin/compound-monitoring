# Compound Protocol Monitoring

This repository contains Forta Agent scripts that can be deployed to the Forta Network to monitor
transactions that occur with Compound Protocol smart contracts.

## Agents

### Event Monitor

This agent monitors blockchain transactions for events emitted from Compound smart contract
addresses. Alert type and severity are specified per event per contract address.

### Compound Distribution Monitor

This agent monitors the Compound Finance Comptroller contract for distribution events
that exceed a configurable threshold. Alert type is `Suspicious` and severity is `High`.