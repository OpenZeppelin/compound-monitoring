const EthersAdapter = require('@gnosis.pm/safe-ethers-lib').default;
const Safe = require('@gnosis.pm/safe-core-sdk').default;
const SafeServiceClient = require('@gnosis.pm/safe-service-client').default;
const ethers = require('ethers');

// load values from the .env file
require('dotenv').config();

// load the Gnosis Safe proxy contract address
const polygonSafeAddress = process.env.POLYGON_SAFE_ADDRESS;

// load the JSON-RPC endpoint URL
const polygonEndpoint = process.env.POLYGON_ENDPOINT;

// load the private key for the account that will be signing the transaction
const ownerPrivateKey = process.env.APPROVER_PRIVATE_KEY;

// load the transaction hash to approve
const safeTxHash = process.env.SAFE_TX_HASH;

async function main() {
  // create an ethers.js provider
  const provider = new ethers.providers.JsonRpcProvider(polygonEndpoint);

  // create an ethers.js wallet (signer) and connect it to the provider
  const safeWallet = new ethers.Wallet(ownerPrivateKey, provider);
  const signer = safeWallet.connect(provider);

  // create an ethAdapter Object
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

  console.log('Getting deployed Gnosis Safe Contract');
  const safeSdk = await Safe.create({
    ethAdapter,
    safeAddress: polygonSafeAddress,
  });

  // sign the transaction hash and provide confirmation to the Safe Service Client
  const signature = await safeSdk.signTransactionHash(safeTxHash);
  await safeService.confirmTransaction(safeTxHash, signature.data);
  console.log('Transaction confirmed');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
