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

