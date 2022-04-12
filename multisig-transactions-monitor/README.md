# Compound Multisig Transaction Monitor Agent

## Description

This agent detects specific transactions from and with Compound's multisig wallet.

## Supported Chains

- Ethereum

## Alerts


- AE-COMP-MULTISIG-OWNER-ADDED-ALERT
  - Fired when an owner is added to the Compound multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Owner address added
    - Compound multisig address

- AE-COMP-MULITSIG-OWNER-REMOVED-ALERT
  - Fired when an owner is removed from the Compound multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Wwner address removed
    - Compound multisig address

- AE-COMP-GOVERNANCE-PROPOSAL-CREATED-ALERT
  - Fired when a proposal is created from Compound's multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Proposal Id created
    - Compound multisig address

- AE-COMP-GOVERNANCE-PROPOSAL-EXECUTED-ALERT
  - Fired when a proposal is executed by Compound's multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Proposal Id executed
    - Compound multisig address

- AE-COMP-GOVERNANCE-PROPOSAL-CANCELED-ALERT
  - Fired when a proposal is cancelled by Compound's multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Proposal Id canceled
    - Compound multisig address

- AE-COMP-GOVERNANCE-VOTE-CAST-ALERT
  - Fired when a vote is casted from Compound's multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Proposal Id voted on
    - Compound multisig address

- AE-COMP-GOVERNANCE-PROPOSAL-THRESHOLD-SET-ALERT
  - Fired when a proposal threshold is set from Compound's multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Proposal old threshold
    - Proposal new threshold
    - Compound multisig address

- AE-COMP-GOVERNANCE-NEW-ADMIN-ALERT
  - Fired when a new admin is changed by Compound's multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Old Admin address
    - New Admin address
    - Compound multisig address

- AE-COMP-NEW-PAUSE-GUARDIAN-ALERT
  - Fired when a new pause guardian is changed by Compound's multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Old pause guardian address
    - New pause gaurdian address
    - Compound multisig address

- AE-COMP-ACTION-PAUSED-ALERT
  - Fired when a global action is paused by Compound's multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Action paused
    - Compound multisig address

- AE-COMP-NEW-BORROW-CAP-ALERT
  - Fired when a new borrow cap is set by Compound's multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - cToken address changed
    - New borrow cap
    - Compound multisig address

- AE-COMP-NEW-BORROW-CAP-GUARDIAN-ALERT
  - Fired when a new borrow cap guadian is set by Compound's multisig wallet
  - Type is always set to `Info`
  - Severity is always set to `Info`
  - Metadata field contains:
    - Old borrow cap guardian address
    - New borrow cap guardian address
    - Compound multisig address
