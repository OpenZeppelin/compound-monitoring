# Defender Configuration Helper

This repository contains code for pulling down/pushing up configurations for Sentinels and Autotasks from an OpenZeppelin Defender account.

The intent of this code is to provide a mechanism for copying a Defender account configuration to another Defender account.

## Defender Account Setup

- In your Defender account, select the Hamburger icon in the upper right corner and click on **Team API Keys**
- In the Team API Keys screen, click **Create API Key**
- Make sure that the options for **Manage Autotasks** and **Manage Sentinels** are selected (we do not make use of the **Create Admin proposals and contracts** option)
- Click **Save**
- Copy your API key and Secret key to a local file (you will **NOT** be able to view your API secret again after this message box goes away)
- Make sure that you really did copy your API key and Secret key to a local file
- Check the box for **I’ve written down the secret key** and select **Close**
- Create a single Relayer on the Ropsten Testnet and record the API key and Secret key


## Local Code Setup

- Run `npm i` to install the necessary Node packages
- In the code directory, create a file called `.env`
- Add two lines to the `.env` file, replacing the portion in the curly braces ({}) with your API key and secret key, as indicated:
  - DEFENDER_API_KEY={API_KEY_GOES_HERE}
  - DEFENDER_API_SECRET={SECRET_KEY_GOES_HERE}


## Pushing an Existing Configuration to Defender

Run `npm run deploy` to push up the configuration stored in `./downloaded/defender-config.json`.  Once the configuration is pushed up to Defender, any
Autotasks that need access to a JSON-RPC provider will need to be connected to an appropriate Relayer.  If this step is not performed, the Autotask will
not be able to perform JSON-RPC requests (this will cause errors).


## Pulling Down a Defender Configuration

Run `npm run download` to pull down a Defender configuration and save it to the `./downloaded` directory.  This will create a `defender-config.json` file
as well as JSON and JS files for the downloaded Autotasks.

## Autotask Testing

The Autotask files contain code to facilitate development and testing of OpenZeppelin Defender Autotasks.

Rather than creating Autotask scripts in the Defender Web App and then waiting for appropriate blockchain events
to trigger a Forta Sentinel, this code allows a developer to mock the requests sent by Defender Forta Sentinels to
the Autotasks to verify that the Autotasks are performing as expected.

### Use of Jest

This code uses Jest to override the several modules (`axios`, `ethers`, and `defender-relay-client`) to mock their actions and avoid performing interactions
with the blockchain or the Internet. This approach allows us to simplify testing by simulating all external data sources and then verifying that Autotasks
performs the functions we expect.

### Serverless Migration status

NAME - STATUS - (PAUSED)

Production
- cToken Monitor - Ready to deploy
- Datadog Alerts Heat Map - Error 400
- Datadog Forta Bot Alerts - Error 400
- Datadog Forta Detection Bot Health - Error 400
- Forta cToken - Ready to deploy - Paused
- Forta Distribution - Ready to deploy - Paused
- Forta Explorer Monitor - Ready to deploy but autotask returns error 400, also consider adding more bots and updating old ones
- Forta Governance - Ready to deploy - Paused
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

Dev - Yet to be implemented on production
- Datadog Alerts Heat Map
- Datadog Forta Bot Alerts
- Forta Explorer Monitor
- Forta v2 Liquidation Monitor
- Forta v3 Liquidation Monitor
- Gasless Voting
- Governance Automation

When changing the stack name, ensure that the following are updated:
- Folder name
- serverless.yml - provider.stackName
- serverless.yml - custom.name
- secret.yml - secrets.(stackName)
- autotask-1/index.js - `const stackName = '<stackName>';`

Future plans:
- Learn if serverless [environment variables](https://adamdelong.com/serverless-environment-variables/) available inside of autotasks
- If so, some additional autotask parameters may be migrated to the serverless.yml file
