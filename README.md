# Compound Protocol Monitoring

This repository contains Forta Agent scripts that can be deployed to the Forta Network to monitor
transactions that occur with Compound Protocol smart contracts.

## Agents

### Event Monitor

This agent monitors blockchain transactions for events emitted from Compound smart contract
addresses.  Alert type and severity are specified per event per contract address.

### Oracle Price Monitor

This agent monitors the UniswapAnchoredProxy contract for PriceGuarded events which indicate that
a ValidatorProxy reported a cToken price that is outside of the Uniswap V2 TWAP percent threshold.
Alert type is set to Degraded and severity is set to High.
