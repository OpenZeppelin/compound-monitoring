# Test monitoring Comet transactions

0. Create a new Alchemy API key for Polygon Mumbai and add the resultant JSON RPC URL to your .env file as POLYGON_MUMBAI_JSON_RPC_URL=<your-URL-with-key-here>.  
   
1. Next, add a valid private key for a wallet to your .env file and add some test MATIC via the Polygon Mumbai faucet: https://faucet.polygon.technology/ 
   
2. From the `hardhat_tests/` directory, start a localhost forked chain `npx hardhat node`

3. Create transactions. In a separate terminal (from the same `hardhat_tests/` directory) run: `npx hardhat --network localhost test`.  The tests should succeed and log a list of transaction hashes to the terminal.

4. Change directories to base project directory. For each transaction run a market monitor test:

```shell
npm test defender-components/tests/LiveProvider_Market_Activity_Monitor.spec.js --tx=<transactionHash>
```
Note: In order to run the shell command, you will need to populate your .env with ETHEREUM_MAINNET_JSON_RPC_URL, POLYGON_MAINNET_JSON_RPC_URL, 
