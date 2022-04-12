const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
  getEthersProvider,
} = require('forta-agent');

// To-do: Replace node-fetch with axios
const fetch = require('node-fetch-commonjs');
const config = require('../agent-config.json');

function getAbi(abiName) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const { abi } = require(`../abi/${abiName}`);
  return abi;
}

const { comptrollerAddress, triggerLevels } = config.liquidationMonitor;

const comptrollerABI = getAbi(config.liquidationMonitor.comptrollerABI);
const provider = getEthersProvider();
const comptrollerContract = new ethers.Contract(
  comptrollerAddress,
  comptrollerABI,
  provider,
);

// To-do: find highest values of each trigger for the initial filter
const { maximumHealth, minimumBorrowInETH, minimumShortfallInUSD } =
  triggerLevels.trigger1;

let findingsCount = 0;

const handleBlock = async (blockEvent) => {
  const findings = [];

  // Compound API, find accounts near liquidation
  // To-do: Save accounts to reduce reliance on Compound calls.
  const requestData = {
    addresses: [], // returns all accounts if empty or not included
    block_number: 0, // returns latest if given 0
    max_health: { value: maximumHealth },
    min_borrow_value_in_eth: { value: minimumBorrowInETH },
    page_number: 1,
    page_size: 10,
  };

  // To-do: Replace fetch with axios
  const accountsPromise = fetch('https://api.compound.finance/api/v2/account', {
    method: 'POST',
    body: JSON.stringify(requestData),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Got non-2XX response from API server.');
      }
      return response.json();
    })
    .then((responseData) => {
      return responseData.accounts;
    });

  const accounts = await accountsPromise.then(
    (foundAccounts) => {
      return foundAccounts;
    },
    (error) => {
      console.error('Failed to fetch accounts due to error: ', error);
    },
  );

  // Get list of possible loanable assets from compound

  // Get prices of all assets in ETH via UNISWAP ? Maybe rely on compound.

  // Loop through found accounts and check on-chain for liquidity in USD
  // accounts.forEach((account) => {
  const promises = accounts.map(async (account) => {
    const {
      address,
      health: { value: health },
      total_borrow_value_in_eth: { value: borrowValue },
      total_collateral_value_in_eth: { value: collateralValue },
    } = account;

    // function getAccountLiquidity(address account) view returns (uint, uint, uint)
    // returns(error, liquidity, shortfall) If shortfall is non-zero, account is underwater.
    const accLiquidity = await comptrollerContract.getAccountLiquidity(
      account.address,
    );
    const shortfallUSD = ethers.utils.formatEther(accLiquidity[2]);

    if (
      health <= maximumHealth &&
      borrowValue >= minimumBorrowInETH &&
      collateralValue >= minimumShortfallInUSD
    ) {
      console.log('---Account ', address);
      console.log('---Health: ', health);
      console.log('---Borrowed (in ETH): ', borrowValue);
      console.log('---Collateral (in ETH): ', collateralValue);
      console.log('---Liquidatable amount (in USD): ', shortfallUSD);

      // // Extra: Breakdown of which tokens are borrowed and how much
      // comptroller getMarketsIn(address) to see which tokens are being borrowed from.
      // go to those cTokens to call borrowBalanceStored() to check for amount borrowed.
      // To-do: How to look up collateral? Is this needed? Or go with the liquidity function and API?

      // // Add to findings
    }
  });
  await Promise.all(promises);
  return findings;
};

module.exports = {
  // handleTransaction,
  handleBlock,
};
