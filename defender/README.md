# Defender Configuration Helper

This repository contains code for pushing up configurations of Sentinels and Autotasks using Serverless Framework to an OpenZeppelin Defender account.

## Serverless Introduction

Serverless Framework allows users to organize related resources into a unit called a stack. A stack can include Autotasks, Sentinels, Relayers, and Notification Channels. Modifying a stack does not affect other stacks, which makes it easier to manage multiple projects.

Example folder structure of a stack containing 2 Autotasks and 2 Sentinels:

```text
defender/
├── example_stack1/             # Production Stack
│   ├── autotask-1/
│   │   └── index.js
│   ├── autotask-2/
│   │   └── index.js
│   ├── abis/
│   │   ├── sentinel-1.json.abi
│   │   └── sentinel-2.json.abi
│   └── serverless.yml
├── example_stack1_dev/         # Development Stack to replace production
├── example_stack2/             # Production Stack
└── secrets.yml
```
Only the `serverless.yml` and `secrets.yml` files are mandatory. The full `serverless.yml` specifications can be found on the [Defender Serverless GitHub repo](https://github.com/OpenZeppelin/defender-serverless)

Naming convention:
- The naming convention for stack is `<project name>_<optional development stage>`.
- Stack names are all lowercase and underscore separated.
- Stacks that are currently deployed in production have the development stage omitted from the name.
- Stacks that have finished development but have not yet been deployed are appended with `dev`.

Secrets.yml file:
- All stacks can access the common `secrets.yml` file, which contains a Defender API key to allow the deployment of the stack to Defender.
- `secrets.yml` also may contain other stack-specific sensitive information such as:
  - API keys
  - Email addresses
  - Webhook URLs
  - Anything other sensitive information that needs to be passed to an Autotask
- `secrets.yml` is local to the deployer and is not committed to GitHub.
- `serverless.yml` can be configured to push the secrets to Notification Channels or Defender Autotask Secrets.

## Defender Account Setup

- In your Defender account, select the Hamburger icon in the upper right corner and click on **Team API Keys**
- In the Team API Keys screen, click **Create API Key**
- Make sure that the options for **Manage Relayers**, **Manage Autotasks**, and **Manage Sentinels** are selected (we do not make use of the **Create Admin proposals and contracts** option)
- Click **Save**
- Copy your API key and Secret key to a local file (you will **NOT** be able to view your API secret again after this message box goes away)
- Make sure that you really did copy your API key and Secret key to a local file
- Check the box for **I’ve written down the secret key** and select **Close**

## Local Code Setup

In the `defender` directory, perform the following steps:
- Run `npm i` to install the necessary Node packages.
- Copy and rename the `secret-example.yml` to `secrets.yml`
- Modify the two lines in the `secrets.yml` file, replacing the portion in the angle brackets `<>` with your Defender API key and secret key, as indicated:
  - `api: <API Key goes here>`
  - `secret: <API Secret goes here>`
- Additional stack-specific secrets can be defined as needed.

## Pushing a Stack to Defender

Change directories to the stack that will be deployed. Use `serverless deploy` to deploy the stack to Defender.

## Autotask Testing

The Autotask files contain code to facilitate development and testing of OpenZeppelin Defender Autotasks.

Rather than creating Autotask scripts in the Defender Web App and then waiting for appropriate blockchain events
to trigger a Forta Sentinel, this code allows a developer to mock the requests sent by Defender Forta Sentinels to
the Autotasks to verify that the Autotasks are performing as expected.

### Use of Jest

This code uses Jest to override several modules (`axios`, `ethers`, and `defender-relay-client`) to mock their actions and avoid performing interactions
with the blockchain or the Internet. This approach allows us to simplify testing by simulating all external data sources and then verify that Autotasks
perform the functions we expect.

### Serverless Migration status

NAME - STATUS - (PAUSED)

Production

- cToken Monitor - Ready to deploy
- Datadog Alerts Heat Map - Ready to deploy
- Datadog Forta Bot Alerts - Ready to deploy
- Datadog Forta Detection Bot Health - Ready to deploy
- Forta cToken - Superseded by Contract Sentinel cToken Monitor - Paused
- Forta Distribution - Ready to deploy - Paused
- Forta Explorer Monitor - Error 400 (bad request) when accessing <https://explorer-api.forta.network/graphql>
- Forta Governance - Superseded by Contract Sentinel Governance Discord Alert - Paused
- Forta Large Borrows Governance - Ready to deploy
- Forta Large Delegations - Ready to deploy
- Forta Low Liquidity - Ready to deploy
- Forta Multi-Sig - Ready to deploy
- Forta Oracle Price - Ready to deploy
- Forta Underlying Asset - Ready to deploy
- Governance Automation - Ready to deploy
- Governance Discord Alert - Replaces Contract Governance - Ready to deploy
- Governance Discord Summary - Replaces Active Proposal Updater - Ready to deploy
- Governance Twitter Bot - Ready to deploy
- Proposal 110 Automatoooor - Ready to Deploy - Paused
- Proposal 117 Monitor Market Entered - No longer in production, missing sentinel data - Paused
- Proposal 117 Monitor Mint - No longer in production, missing sentinel data - Paused

Note: The Forta Explorer Monitor Autotask relies on GraphQL queries which have changed since the last deployment. The query will need to be updated to fix the error 400 issue.

Dev - Yet to be implemented on production

- Forta v2 Liquidation Monitor DEV - Ready to deploy
- Forta v3 Liquidation Monitor DEV - Ready to deploy
- Gasless Voting DEV - Ready to deploy

When changing the stack name, ensure that the following are updated:

- Folder name
- serverless.yml - provider.stackName
- serverless.yml - custom.name
- secrets.yml - secrets.(stackName)
- Stack names and imports inside of the `autotask-1/index.js` file
- Name of the `test.spec.js` file
- Stack names and imports inside of the `test.spec.js` file

Future plans:

- Learn if serverless [environment variables](https://adamdelong.com/serverless-environment-variables/) are available inside of Autotasks
- If so, some additional Autotask parameters may be migrated to the serverless.yml file
