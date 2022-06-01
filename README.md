# Compound Protocol Monitoring

This repository contains Forta Bot scripts that can be deployed to the Forta Network to monitor
transactions that occur with Compound Protocol smart contracts.

## Bots

### cToken Underlying Asset Monitor

This bot monitors the underlying asset of Compound Finance cToken contracts.  First
it determines which assets are deployed using upgradable proxy contracts and then it
monitors those contracts for any upgrade events to detect when the implementation for
a cToken's underlying asset may have changed.

### Delegate Votes Governance Bot

This bot monitors all DelegateVotesChanged events emitted by the COMP token contract to see if an
address has been delegated enough COMP to pass significant governance thresholds.

### cToken Transaction Monitor

This bot monitors Compound Finance cToken contracts for common market events like Mint, Borrow,
etc.  Monitored events are specified in the bot-config.json file, with associated Finding types
and severities for each one.

### Compound Distribution Monitor

This bot monitors the Compound Finance Comptroller contract for distribution events that exceed a 
set of configurable parameters.

### Governance Event Monitor

This bot monitors the Compound Finance GovernorBravo contract for specific emitted events related
to Proposals and Voting.

### Large Borrows Governance Monitor

This bot monitors all borrow events of COMP to see if the borrower address has accrued enough COMP
to pass significant governance thresholds. This can be an early indication of governance attacks.

### Liquidation Monitor

This bot detects when an account on Compound is able to be liquidated.

### Low Liquidity Market Attack Monitor

This bot monitors Compound Finance cToken contracts that have low liquidity for potential 
market attacks where a malicious actor mints cTokens and then transfers additional tokens in
order to unbalance the contract such that subsequent mints will not yield cTokens.

### Compound Multisig Transaction Monitor Bot

This bot detects specific transactions originating from and/or interacting with the Compound Community Multisig wallet.

### Oracle Price Monitor

This bot monitors the UniswapAnchoredProxy contract for PriceGuarded events which indicate that
a ValidatorProxy reported a cToken price that is outside of the Uniswap V2 TWAP percent threshold.
Alert type is set to Degraded and severity is set to High.

### Defender Configuration Helper

This folder contains code for pulling down/pushing up configurations for Sentinels and Autotasks from an OpenZeppelin Defender account.

### Gnosis Safe Bot Deployer

This code allows users to deploy bots to the Forta network using Gnosis Safe multi-sig accounts.