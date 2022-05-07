require('dotenv').config({ path: `${__dirname}/.env` });

const apiKey = process.env.DEFENDER_API_KEY;
const apiSecret = process.env.DEFENDER_API_SECRET;

// create the SentinelClient Object for use in interacting with Defender
const { SentinelClient } = require('defender-sentinel-client');
const { AutotaskClient } = require('defender-autotask-client');

(async () => {
  // get the appropriate key and secret for accessing the Defender API
  const creds = { apiKey, apiSecret };
  const sentinelClient = new SentinelClient(creds);

  // list all sentinels
  const { items: sentinelItems } = await sentinelClient.list();

  // delete all sentinels
  const sentinelPromises = sentinelItems.map((item) => {
    const { subscriberId } = item;
    return sentinelClient.delete(subscriberId);
  });

  // wait for the promises to settle
  const sentinelResults = await Promise.all(sentinelPromises);
  console.log(JSON.stringify(sentinelResults, null, 2));

  // list all autotasks
  const autotaskClient = new AutotaskClient(creds);
  const { items: autotaskItems } = await autotaskClient.list();

  // delete all autotasks
  const autotaskPromises = autotaskItems.map((item) => {
    const { autotaskId } = item;
    return autotaskClient.delete(autotaskId);
  });

  // wait for the promises to settle
  const autotaskResults = await Promise.all(autotaskPromises);
  console.log(JSON.stringify(autotaskResults, null, 2));
})();
