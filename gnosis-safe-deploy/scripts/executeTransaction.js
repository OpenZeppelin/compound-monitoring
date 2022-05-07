const EthersAdapter = require('@gnosis.pm/safe-ethers-lib').default;
const { default: Safe, EthSignSignature } = require('@gnosis.pm/safe-core-sdk');
const SafeServiceClient = require('@gnosis.pm/safe-service-client').default;
const ethers = require('ethers');

require('dotenv').config();

const polygonSafeAddress = process.env.POLYGON_SAFE_ADDRESS;
const polygonEndpoint = process.env.POLYGON_ENDPOINT;

// load the private key for the account that will execute the transaction
const ownerPrivateKey = process.env.EXECUTION_PRIVATE_KEY;

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
  const transaction = await safeService.getTransaction(safeTxHash);
  console.log(transaction);

  const safeTransactionData = {
    to: transaction.to,
    value: transaction.value,
    data: transaction.data,
    operation: transaction.operation,
    safeTxGas: transaction.safeTxGas,
    baseGas: transaction.baseGas,
    gasPrice: transaction.gasPrice,
    gasToken: transaction.gasToken,
    refundReceiver: transaction.refundReceiver,
    nonce: transaction.nonce,
  };

  console.log(`safeTransactionData: ${JSON.stringify(safeTransactionData, null, 2)}`);

  const gasPrice = await provider.getGasPrice();
  const options = { gasPrice };
  const safeTransaction = await safeSdk.createTransaction(safeTransactionData, options);
  transaction.confirmations.forEach((confirmation) => {
    const signature = new EthSignSignature(confirmation.owner, confirmation.signature);
    safeTransaction.addSignature(signature);
  });

  console.log(`safeTransaction: ${JSON.stringify(safeTransaction, null, 2)}`);

  const executeTxResponse = await safeSdk.executeTransaction(safeTransaction); // , options);
  console.log(`executeTxResponse: ${JSON.stringify(executeTxResponse, null, 2)}`);

  // eslint-disable-next-line max-len
  const receipt = executeTxResponse.transactionResponse && (await executeTxResponse.transactionResponse.wait());
  console.log(`Receipt: ${JSON.stringify(receipt, null, 2)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
