const EthersAdapter = require('@gnosis.pm/safe-ethers-lib')["default"];
const { default: Safe } = require('@gnosis.pm/safe-core-sdk');
const SafeServiceClient = require('@gnosis.pm/safe-service-client')["default"];
const fortaAgent = require('forta-agent');

const { ethers } = fortaAgent;

// get the Awilix container with its registered modules
const container = fortaAgent.configureContainer();

// get the module corresponding to the agent registry Object
// and the uploadImage function
const {
  agentRegistry,
  uploadImage,
  uploadManifest,
  getCredentials,
  agentId,
  chainIds,
} = container.cradle;

require('dotenv').config();

const polygonSafeAddress = process.env.POLYGON_SAFE_ADDRESS;
const polygonEndpoint = process.env.POLYGON_ENDPOINT;
const safeOwnerOnePrivateKey = process.env.OWNER_ONE_PRIVATE_KEY;

const provider = new ethers.providers.JsonRpcProvider(polygonEndpoint);

// create a wallet (signer) and connect it to the provider
const safeWallet = new ethers.Wallet(safeOwnerOnePrivateKey, provider);
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

  // get the private key for signing the manifest
  const { privateKey } = await getCredentials();
  const fortaDeployerWallet = new ethers.Wallet(privateKey);

  // get the ethers.js Contract Object for interacting with the AgentRegistry contract
  const contract = agentRegistry.getContract(fortaDeployerWallet);

  // uploadImage() will look for a Dockerfile in the main level of the repository
  // then it will invoke 'docker build' and push the image to the Disco image repository
  const imageReference = await uploadImage();

  // uploadManifest() will:
  //   - upload documentation to IPFS
  //   - create an agent manifest
  //   - sign the agent manifest with a privateKey
  //   - upload the manifest and signature to IPFS
  //   - return the content ID for that content
  const manifestReference = await uploadManifest(imageReference, privateKey);
  console.log(manifestReference);

  // create the transaction that will add the information to the Agent Registry contract
  const from = fortaDeployerWallet.address;
  console.log(`from: ${from}`);
  const gas = await contract.estimateGas.createAgent(agentId, from, manifestReference, chainIds);
  console.log(`gas: ${gas}`);
  const txOptions = await agentRegistry.getTxOptions(gas, fortaDeployerWallet);
  console.log(`txOptions: ${JSON.stringify(txOptions, null, 2)}`);
  const txUnsigned = await contract.populateTransaction.createAgent(agentId, from, manifestReference, chainIds, txOptions);
  console.log(`txUnsigned: ${JSON.stringify(txUnsigned, null, 2)}`);

  // get the next available nonce
  console.log('Get nonce');
  const nonce = await safeService.getNextNonce(polygonSafeAddress);
  console.log(`nonce: ${nonce}`);

  // create the transaction Object that we will pass to the Gnosis Safe contract
  const transaction = {
    to: txUnsigned.to,
    data: txUnsigned.data,
    value: '0',
    gasPrice: (ethers.utils.parseUnits('40', 'gwei')).toString(), // specify for Polygon to ensure that we won't hit any 'transaction underpriced' errors
    nonce,
  };
  const safeTransaction = await safeSdk.createTransaction(transaction);

  console.log('safeTransaction');
  console.log(JSON.stringify(safeTransaction, null, 2));

  // propose the transaction to the service
  await safeSdk.signTransaction(safeTransaction);
  const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
  const origin = "A SECOND test transaction to deploy a Forta Bot";

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
