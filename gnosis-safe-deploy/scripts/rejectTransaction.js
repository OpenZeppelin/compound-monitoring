const EthersAdapter = require('@gnosis.pm/safe-ethers-lib').default;
const { default: Safe } = require('@gnosis.pm/safe-core-sdk');
const SafeServiceClient = require('@gnosis.pm/safe-service-client').default;

const ethers = require('ethers');

require('dotenv').config();

const polygonSafeAddress = process.env.POLYGON_SAFE_ADDRESS;
const polygonEndpoint = process.env.POLYGON_ENDPOINT;
const ownerPrivateKey = process.env.REJECTION_PRIVATE_KEY;
const nonceToReject = parseInt(process.env.NONCE_TO_REJECT, 10);

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

  // create the transaction Object that we will pass to the Gnosis Safe contract
  const gasPrice = await provider.getGasPrice();
  const transaction = {
    to: polygonSafeAddress,
    data: '0x',
    value: '0',
    gasPrice,
    nonce: nonceToReject,
    safeTxGas: 0,
  };
  const safeTransaction = await safeSdk.createTransaction(transaction);

  console.log('safeTransaction');
  console.log(JSON.stringify(safeTransaction, null, 2));

  // propose the transaction to the service
  await safeSdk.signTransaction(safeTransaction);
  const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
  const origin = 'Canceling a pending transaction';

  console.log('safeTxHash');
  console.log(JSON.stringify(safeTxHash, null, 2));

  await safeService.proposeTransaction({
    safeAddress: polygonSafeAddress,
    safeTransaction,
    safeTxHash,
    senderAddress: safeWallet.address,
    origin, // optional string to provide more information about the app proposing the transaction
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
