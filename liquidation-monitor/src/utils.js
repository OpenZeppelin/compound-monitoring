const fetch = require('node-fetch-commonjs');

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
  const time = `${hours}:${minutes}:${seconds}`;
  console.log('TS -', time, input);
}

// Helper for Compound API
function buildJsonRequest(maxHealth, minBorrow, pageNumber, pageSize) {
  const jsonRequest = {
    addresses: [], // returns all accounts if empty or not included
    block_number: 0, // returns latest if given 0
    max_health: { value: maxHealth },
    min_borrow_value_in_eth: { value: minBorrow },
    page_number: pageNumber,
    page_size: pageSize,
  };
  return jsonRequest;
}

async function callCompoundAPI(url, jsonRequest) {
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
    .then((responseData) => responseData);

  const responseData = await callPromise.then(
    (data) => data,
    (error) => {
      console.error('Failed to fetch accounts due to error: ', error);
    },
  );
  return responseData;
}

module.exports = {
  getAbi,
  ts,
  callCompoundAPI,
  buildJsonRequest,
};
