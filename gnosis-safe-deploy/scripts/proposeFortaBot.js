const EthersAdapter = require('@gnosis.pm/safe-ethers-lib').default;
const Safe = require('@gnosis.pm/safe-core-sdk').default;
const SafeServiceClient = require('@gnosis.pm/safe-service-client').default;
const fortaAgent = require('forta-agent');

const { ethers } = fortaAgent;

// get the Awilix container with its registered modules
const container = fortaAgent.configureContainer();

// get the module corresponding to the bot registry Object
// and the uploadImage function
const {
  agentRegistry,
  uploadImage,
  uploadManifest,
  getCredentials,
  agentId,
  chainIds,
} = container.cradle;

// load values from the .env file
require('dotenv').config();

// load the address of our Gnosis Safe proxy smart contract
const polygonSafeAddress = process.env.POLYGON_SAFE_ADDRESS;
// load our JSON-RPC endpoint URL
const polygonEndpoint = process.env.POLYGON_ENDPOINT;
// load the private key for one of the owners of the Gnosis Safe
const ownerPrivateKey = process.env.PROPOSE_PRIVATE_KEY;

async function main() {
  // set up an ethers.js provider
  const provider = new ethers.providers.JsonRpcProvider(polygonEndpoint);

  // create an ethers.js Wallet (signer) and connect it to the provider
  const safeWallet = new ethers.Wallet(ownerPrivateKey);
  const signer = safeWallet.connect(provider);

  // create an ethAdapter to use with the Safe Service Client and Safe Objects
  const ethAdapter = new EthersAdapter({
    ethers,
    signer,
    provider,
  });

  // Gnosis Safe Service Client
  // initialize the Safe Service Client
  const transactionServiceUrl = 'https://safe-transaction.polygon.gnosis.io/';
  const safeService = new SafeServiceClient({
    txServiceUrl: transactionServiceUrl,
    ethAdapter,
  });

  // Gnosis Safe method
  console.log('Getting deployed Gnosis Safe Contract');
  const safeSdk = await Safe.create({
    ethAdapter,
    safeAddress: polygonSafeAddress,
  });

  // Forta SDK function
  // get the private key for signing the manifest from the forta.config.json file
  const { privateKey } = await getCredentials();

  // set up an ethers.js Wallet
  const fortaDeployerWallet = new ethers.Wallet(privateKey);

  // Forta SDK function
  // get the ethers.js Contract Object for interacting with the Forta AgentRegistry contract
  const contract = agentRegistry.getContract(fortaDeployerWallet);

  // Forta SDK function
  // uploadImage() will look for a Dockerfile in the main level of the repository
  // then it will invoke 'docker build' and push the image to the Forta Disco image repository
  const imageReference = await uploadImage();

  // Forta SDK function
  // uploadManifest() will:
  //   - upload documentation to IPFS
  //   - create a bot manifest
  //   - sign the bot manifest with a privateKey
  //   - upload the manifest and signature to IPFS
  //   - return the content ID for that content
  const manifestReference = await uploadManifest(imageReference, privateKey);
  console.log(manifestReference);

  // create the transaction that will add the information to the Bot Registry contract
  // normally the 'from' address would be the same as the address used for signing the manifest
  // in this case, we want the Bot to "belong" to the Gnosis safe.
  // therefore, we will pass the Gnosis Safe contract address as the 'from' address
  // this will result in an ERC721 Forta Bot token being minted to the Gnosis Safe address
  const from = polygonSafeAddress;
  console.log(`from: ${from}`);

  // Forta SDK function
  const gas = await contract.estimateGas.createAgent(agentId, from, manifestReference, chainIds);
  console.log(`gas: ${gas}`);

  // Forta SDK function
  const txOptions = await agentRegistry.getTxOptions(gas, fortaDeployerWallet);
  console.log(`txOptions: ${JSON.stringify(txOptions, null, 2)}`);

  // using ethers.js Contract populateTransaction method to create an unsigned transaction for
  // calling 'createAgent' on the Forta AgentRegistry smart contract
  // this step is critical to being able to deploy the Forta Bot with a Gnosis Safe contract,
  // because we have to submit the transaction to the Gnosis Safe for approval, allow the owners
  // to approve or reject the proposed transaction, and then allow an owner to execute the
  // the transaction if it has received enough approvals
  const txUnsigned = await contract.populateTransaction.createAgent(
    agentId,
    from,
    manifestReference,
    chainIds,
    txOptions,
  );
  console.log(`txUnsigned: ${JSON.stringify(txUnsigned, null, 2)}`);

  // Gnosis Safe Service Client method
  // get the next available nonce
  const nonce = await safeService.getNextNonce(polygonSafeAddress);
  console.log(`nonce: ${nonce}`);

  // Gnosis Safe Core SDK method
  // create the transaction Object that we will pass to the Gnosis Safe contract
  const transaction = {
    to: txUnsigned.to,
    data: txUnsigned.data,
    value: '0',
    nonce,
  };
  const safeTransaction = await safeSdk.createTransaction(transaction);
  console.log('safeTransaction');
  console.log(JSON.stringify(safeTransaction, null, 2));

  // Gnosis Safe Core SDK method
  await safeSdk.signTransaction(safeTransaction);

  // Gnosis Safe Core SDK method
  const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
  console.log('safeTxHash');
  console.log(JSON.stringify(safeTxHash, null, 2));

  // optional string to provide more information about the app proposing the transaction
  const origin = 'A transaction to deploy a Forta Bot';

  // Gnosis Safe Service Client method
  // propose the transaction to the service
  await safeService.proposeTransaction({
    safeAddress: polygonSafeAddress,
    safeTransaction,
    safeTxHash,
    senderAddress: safeWallet.address,
    origin,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
