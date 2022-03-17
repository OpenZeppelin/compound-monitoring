# Compound Protocol Monitoring

This repository contains Forta Agent scripts that can be deployed to the Forta Network to monitor
transactions that occur with Compound Protocol smart contracts.

## Agents

### Event Monitor

This agent monitors blockchain transactions for events emitted from Compound smart contract
addresses.  Alert type and severity are specified per event per contract address.

### Large Borrows of COMP

This agent monitors all borrow events of COMP to see if the borrower address has accrued enough COMP
to pass significant governance thresholds. This can be an early indication of governance attacks.
