const { Finding, FindingSeverity, FindingType } = require('forta-agent');
// import fetch from 'node-fetch';
const fetch = require('node-fetch-commonjs'); // from 'node-fetch';
// const config = require('../agent-config.json');

const ERC20_TRANSFER_EVENT =
  'event Transfer(address indexed from, address indexed to, uint256 value)';
const TETHER_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const TETHER_DECIMALS = 6;
let findingsCount = 0;

const handleBlock = async (blockEvent) => {
  const findings = [];

  // Compound API, find accounts near liquidation
  // To-do: Save accounts to reduce reliance on Compound calls.
  const requestData = {
    addresses: [], // returns all accounts if empty or not included
    block_number: 0, // returns latest if given 0
    max_health: { value: '0.999' },
    min_borrow_value_in_eth: { value: '1.0' },
    page_number: 1,
    page_size: 10,
  };

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

  accounts.forEach((account) => {
    console.log('---Account ', account.address);
    console.log('---Health: ', account.health.value);
    console.log(
      '---Borrowed (in ETH): ',
      account.total_borrow_value_in_eth.value,
    );
    console.log(
      '---Collateral Value: ',
      account.total_collateral_value_in_eth.value,
    );
  });
  // console.log('Known users: ', accounts);
  // Promise.resolve(accounts);
  // console.log('Known users: ', accounts);

  // Get list of possible loanable assets from compound

  // Get prices of all assets in ETH via UNISWAP

  // Loop through found accounts and check on-chain for liquidity in USD
  // function getAccountLiquidity(address account) view returns (uint, uint, uint)
  // returns(error, liquidity, shortfall) If shortfall is non-zero, account is underwater.

  // // Extra: Breakdown of which tokens are borrowed and how much
  // comptroller getMarketsIn(address) to see which tokens are being borrowed from.
  // go to those cTokens to call borrowBalanceStored() to check for amount borrowed.
  // To-do: How to look up collateral? Is this needed? Or go with the liquidity function and API?

  // // Add to findings

  return findings;
};

module.exports = {
  // handleTransaction,
  handleBlock,
  ERC20_TRANSFER_EVENT, // exported for unit tests
  TETHER_ADDRESS, // exported for unit tests
  TETHER_DECIMALS, // exported for unit tests
};
