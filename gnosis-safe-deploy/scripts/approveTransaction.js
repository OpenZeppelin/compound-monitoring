const EthersAdapter = require('@gnosis.pm/safe-ethers-lib')["default"];
const { default: Safe } = require('@gnosis.pm/safe-core-sdk');
const SafeServiceClient = require('@gnosis.pm/safe-service-client')["default"];
const fortaAgent = require('forta-agent');

const { ethers } = fortaAgent;

require('dotenv').config();

const polygonSafeAddress = process.env.POLYGON_SAFE_ADDRESS;
const polygonEndpoint = process.env.POLYGON_ENDPOINT;

// load the private key for the account that will be signing the transaction
const ownerPrivateKey = process.env.OWNER_TWO_PRIVATE_KEY;

// load the transaction hash to approve
const safeTxHash = process.env.SAFE_TX_HASH;

const provider = new ethers.providers.JsonRpcProvider(polygonEndpoint);

// create a wallet (signer) and connect it to the provider
const safeWallet = new ethers.Wallet(ownerPrivateKey, provider);
const signer = safeWallet.connect(provider);

const ethAdapter = new EthersAdapter({
  ethers,
  signer,
  provider,
});

// initialize the Safe Service Client
const transactionServiceUrl = 'https://safe-transaction.polygon.gnosis.io/';
const safeService = new SafeServiceClient({
  txServiceUrl: transactionServiceUrl,
  ethAdapter,
});

async function main() {
  console.log('Getting deployed Gnosis Safe Contract');
  const safeSdk = await Safe.create({
      ethAdapter,
      safeAddress: polygonSafeAddress,
  });

  console.log('Getting pending transactions');
  const tx = await safeService.getTransaction(safeTxHash);
  console.log(tx);

  let signature = await safeSdk.signTransactionHash(safeTxHash);
  await safeService.confirmTransaction(safeTxHash, signature.data);
  console.log('Transaction confirmed');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
