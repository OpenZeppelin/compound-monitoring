// WIP: Currently not working

const axios = require('axios');
const axiosRetry = require('axios-retry');
const crypto = require('crypto');
const OAuth = require('./oauth-1.0a');
require('dotenv').config();

axiosRetry(axios, {
  retries: 10,
  retryDelay: axiosRetry.exponentialDelay,
});

// Consumer Keys from an elevated developer account
const consumer = {
  key: process.env.TWITTER_APP_KEY,
  secret: process.env.TWITTER_APP_SECRET,
};
// Authentication Tokens (must have write permissions)
const authToken = {
  key: process.env.TWITTER_ACCESS_TOKEN,
  secret: process.env.TWITTER_ACCESS_SECRET,
};

const oauth = OAuth({
  consumer,
  signature_method: 'HMAC-SHA1',
  hash_function: (baseString, key) => crypto.createHmac('sha1', key).update(baseString).digest('base64'),
});

async function postToTwitter(url, message) {
  const method = 'POST';
  const data = { status: message };
  const requestData = {
    url,
    method,
    data,
  };
  console.log(requestData);
  const headers = oauth.toHeader(oauth.authorize(requestData, authToken));
  console.log(headers);

  const response = await axios({
    url,
    method,
    headers,
    data,
  });
  console.log(response);
  return response;
}
const twitterURL = 'https://api.twitter.com/1/statuses/update.json?include_entities=true';
// const twitterURL = 'https://api.twitter.com/2/tweets';
const message = 'Hello world, a signed OAuth request!';

(async () => {
  try {
    await postToTwitter(twitterURL, message);
  } catch (e) {
    console.error(JSON.stringify(e, null, 2));
  }
})();
