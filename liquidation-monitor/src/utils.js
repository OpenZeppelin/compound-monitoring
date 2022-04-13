function getAbi(abiName) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const { abi } = require(`../abi/${abiName}`);
  return abi;
}

// Time-stamping + Troubleshooting function
function ts(input) {
  const today = new Date();
  const hours = String(today.getHours()).padStart(2, '0');
  const minutes = String(today.getMinutes()).padStart(2, '0');
  const seconds = String(today.getSeconds()).padStart(2, '0');
  const time = hours + ':' + minutes + ':' + seconds;
  console.log('TS -', time, input);
}

// To-do: Replace fetch with axios
const fetch = require('node-fetch-commonjs');
async function callAPI(url, jsonRequest) {
  const callPromise = fetch(url, {
    method: 'POST',
    body: JSON.stringify(jsonRequest),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Got non-2XX response from API server.');
      }
      return response.json();
    })
    .then((responseData) => {
      return responseData;
    });

  const responseData = await callPromise.then(
    (responseData) => {
      return responseData;
    },
    (error) => {
      console.error('Failed to fetch accounts due to error: ', error);
    },
  );
  return responseData;
}

function getBorrowerAccounts(maxHealth, minBorrow, maxResults) {
  url = 'https://api.compound.finance/api/v2/account';
}

module.exports = {
  getAbi,
  ts,
  getBorrowerAccounts,
  callAPI,
};
