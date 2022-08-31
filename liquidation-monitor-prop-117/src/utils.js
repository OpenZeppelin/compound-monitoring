const axios = require('axios');

function getAbi(abiName) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const { abi } = require(`../abi/${abiName}`);
  return abi;
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

async function callCompoundAPI(jsonRequest) {
  try {
    const apiURL = 'https://api.compound.finance/api/v2/account';
    const resp = await axios.post(apiURL, jsonRequest);
    return resp.data;
  } catch (err) {
    // Handle Error Here
    return null;
  }
}

module.exports = {
  getAbi,
  callCompoundAPI,
  buildJsonRequest,
};
