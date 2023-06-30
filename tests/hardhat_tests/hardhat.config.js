require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config({ path: '../../../.env' });

// fork: Polygon Mumbai
/* @type import('hardhat/config').HardhatNetworkConfig */
const { POLYGON_MUMBAI_JSON_RPC_URL: rpcUrl } = process.env;
const forkBlockNumber = 32149088;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.17',
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: rpcUrl,
        blockNumber: forkBlockNumber,
      },
    },
  },
};
