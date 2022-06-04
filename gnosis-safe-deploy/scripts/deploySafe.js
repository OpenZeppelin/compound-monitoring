const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const EthersAdapter = require('@gnosis.pm/safe-ethers-lib').default;
const { SafeFactory } = require('@gnosis.pm/safe-core-sdk');

require('dotenv').config();

// load the Gnosis Safe configuration and version to deploy
/* eslint-disable import/no-unresolved */
const {
  safeAccountConfig,
  safeVersion,
} = require('../config.json');
/* eslint-enable import/no-unresolved */

// load values from the .env file
const polygonEndpoint = process.env.POLYGON_ENDPOINT;
const polygonPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

// set up an ethers.js provider
const provider = new ethers.providers.JsonRpcProvider(polygonEndpoint);

// create a wallet (signer) and connect it to the provider
const wallet = new ethers.Wallet(polygonPrivateKey, provider);
const signer = wallet.connect(provider);

function writeAddressToDeploymentFile(safeAddress) {
  const filePath = path.join(__dirname, '../deployments.json');
  let data;
  if (fs.existsSync(filePath)) {
    // file exists
    console.log('File exists');
    const content = fs.readFileSync(filePath);
    data = JSON.parse(content);
    data.deployments.push(safeAddress);
  } else {
    // file does not exist
    console.log('File does not exist');
    data = {
      deployments: [safeAddress],
    };
  }
  console.log('Writing to file');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function main() {
  // create an ethAdapter Object
  const ethAdapter = new EthersAdapter({
    ethers,
    signer,
  });

  console.log('Creating safeFactory Object');
  const safeFactory = await SafeFactory.create({
    ethAdapter,
    safeVersion,
  });
  console.log('\tDone');

  // setting the gas is necessary because Polygon increased the minimum gas amount to 30 gwei
  // ref: https://forum.matic.network/t/recommended-min-gas-price-setting/2531
  // const options = { gasPrice: ethers.utils.parseUnits('40', 'gwei') };

  // to avoid issues during periods of high network activity, attempt to get the current gas price
  const gasPrice = await provider.getGasPrice();
  const options = { gasPrice };

  console.log('Deploying Safe');
  const safeSdk = await safeFactory.deploySafe({ safeAccountConfig, options });
  console.log('\tDone');

  console.log('Getting Safe address');
  const newSafeAddress = safeSdk.getAddress();
  console.log(`\tSafe Address: ${newSafeAddress}`);

  // save the Safe address to a local file
  writeAddressToDeploymentFile(newSafeAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
