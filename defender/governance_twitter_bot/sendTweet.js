// eslint-disable-next-line import/no-unresolved, import/extensions
const { TwitterApi } = require('./twitter-api-v2');
require('dotenv').config();

// eslint-disable-next-line no-unused-vars
const twitterKeys = {
  // Consumer Keys from an elevated developer account
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  // Authentication Tokens (must have write permissions)
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
};

const userClient = new TwitterApi(twitterKeys);

async function postToTwitter(client, message, tweetIdToReply) {
  let result;
  if (tweetIdToReply) {
    // Reply to previous tweet if possible
    result = await client.v1.reply(message, tweetIdToReply);
  } else {
    // Otherwise start a new tweet thread
    result = await client.v1.tweet(message);
  }
  const { id_str: id } = result;
  return id;
}

(async () => {
  const message1 = 'Hello';
  const message2 = 'World';
  const message3 = '!!!';

  const tweetId1 = await postToTwitter(userClient, message1, null);
  const tweetId2 = await postToTwitter(userClient, message2, tweetId1);
  const tweetId3 = await postToTwitter(userClient, message3, tweetId2);

  console.log(tweetId3);
})();
