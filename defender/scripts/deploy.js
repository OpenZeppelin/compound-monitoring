require('dotenv').config({ path: `${__dirname}/.env` });

const fs = require('fs');
const JSZip = require('jszip');
const { SentinelClient } = require('defender-sentinel-client');
const { AutotaskClient } = require('defender-autotask-client');

const apiKey = process.env.DEFENDER_API_KEY;
const apiSecret = process.env.DEFENDER_API_SECRET;
const creds = { apiKey, apiSecret };

// load the configuration file
const config = require('./downloaded/defender-config.json');

/* eslint-disable no-param-reassign */
async function createNotificationChannels(channels, client) {
  // create a notification channel
  const notificationPromises = channels.map((channel) => {
    const { type: notificationType } = channel;
    delete channel.type;

    return client.createNotificationChannel(notificationType, channel);
  });
  const notificationResults = await Promise.allSettled(notificationPromises);

  // iterate over each promise, if the promise was successful pull out the notificationId of the
  // successfully created notification channel and the name for indexing off of later and return
  const createdNotificationChannels = {};
  notificationResults.forEach((notificationResult) => {
    if (notificationResult.status === 'fulfilled') {
      const { name, notificationId } = notificationResult.value;
      createdNotificationChannels[name] = notificationId;
    } else {
      const failReason = JSON.stringify(notificationResult.reason, null, 2);
      console.error(`Notification channel creation failed\nReason: ${failReason}`);
    }
  });

  return createdNotificationChannels;
}

async function createAutotasks(autotasks, client) {
  const autotaskPromises = autotasks.map(async (autotask) => {
    const { autotaskFilePath } = autotask;
    // make sure the path provided points to an actual file
    try {
      fs.statSync(autotaskFilePath).isFile();
    } catch (err) {
      console.error(`Autotask creation failed, file ${autotaskFilePath} was not found.`);
      return {};
    }

    // read the autotask code file into a buffer, zip, and base64 encode it
    const fileData = fs.readFileSync(autotaskFilePath);
    const zip = new JSZip();
    zip.file('index.js', fileData);
    const zippedCode = (await zip.generateAsync({ type: 'nodebuffer' })).toString('base64');

    // remove the autotaskFilePath from the passed-in autotask object and replace it with the base64
    // encoded and zipped autotask code
    delete autotask.autotaskFilePath;
    autotask.encodedZippedCode = zippedCode;

    return client.create(autotask);
  });

  const createdAutotasks = {};
  const autotaskResults = await Promise.allSettled(autotaskPromises);
  autotaskResults.forEach((autotaskResult) => {
    if (autotaskResult.status === 'fulfilled') {
      createdAutotasks[autotaskResult.value.name] = autotaskResult.value.autotaskId;
    } else if (autotaskResult.status === 'rejected') {
      const failReason = JSON.stringify(autotaskResult.reason, null, 2);
      console.error(`Autotask creation failed\nReason: ${failReason}`);
    }
  });

  return createdAutotasks;
}

async function createSentinels(notificationChannels, autotasks, sentinels, client) {
  const sentinelPromises = sentinels.map((sentinel) => {
    // grab the ABI file path for the file
    // only contract sentinels have an ABI - do not do for forta sentinels
    if (sentinel.type === 'BLOCK') {
      const { abi: abiFilePath } = sentinel;
      // make sure the path provided points to an actual file
      try {
        fs.statSync(abiFilePath).isFile();
      } catch (err) {
        console.error(`Sentinel creation failed, file ${abiFilePath} was not found.`);
        return {};
      }

      const fileData = fs.readFileSync(abiFilePath);
      // parse out just the 'abi' field from the json file
      const contractABI = JSON.parse(fileData);
      // overwrite the ABI file path in the sentinel with the ABI file contents
      sentinel.abi = JSON.stringify(contractABI);
    }

    // for each value in the notificationChannels array, locate the corresponding id of the newly
    // created notification channel
    const newNotificationChannels = [];
    sentinel.notificationChannels.forEach((channelName) => {
      if (notificationChannels[channelName] !== undefined) {
        newNotificationChannels.push(notificationChannels[channelName]);
      }
    });

    // overwrite the existing notificationChannels array in the sentinel config with the new array
    // containing the actual channel ids
    sentinel.notificationChannels = newNotificationChannels;

    // if autotaskCondition or autotaskTrigger are defined for a sentinel, find and replace the
    // name of the autotask with its respective id (if possible)
    if (sentinel.autotaskCondition !== undefined
      && autotasks[sentinel.autotaskCondition] !== undefined) {
      sentinel.autotaskCondition = autotasks[sentinel.autotaskCondition];
    }

    if (sentinel.autotaskTrigger !== undefined
      && autotasks[sentinel.autotaskTrigger] !== undefined) {
      sentinel.autotaskTrigger = autotasks[sentinel.autotaskTrigger];
    }

    // return the promise for creating the Sentinel
    return client.create(sentinel);
  });

  const createdSentinels = {};
  const sentinelResults = await Promise.allSettled(sentinelPromises);
  sentinelResults.forEach((sentinelResult) => {
    if (sentinelResult.status === 'fulfilled') {
      createdSentinels[sentinelResult.value.name] = sentinelResult.value.subscriberId;
    } else if (sentinelResult.status === 'rejected') {
      const failReason = JSON.stringify(sentinelResult.reason, null, 2);
      console.log(`Sentinel creation failed\nReason: ${failReason}`);
    }
  });

  return createdSentinels;
}

(async () => {
  const { sentinels, notificationChannels, autotasks } = config;

  // create a SentinelClient instance for use in creating notification channels and sentinels
  const sentinelClient = new SentinelClient(creds);

  // create an AutotaskClient instance for use in creating autotasks
  const autotaskClient = new AutotaskClient(creds);

  // create the notification channels
  const createdNotificationChannels = await createNotificationChannels(
    notificationChannels,
    sentinelClient,
  );
  console.log(`Notification Channels created: ${JSON.stringify(createdNotificationChannels, null, 2)}`);

  // create the autotasks
  const createdAutotasks = await createAutotasks(autotasks, autotaskClient);
  console.log(`Autotasks created: ${JSON.stringify(createdAutotasks, null, 2)}`);

  // create the Sentinels
  const createdSentinels = await createSentinels(
    createdNotificationChannels,
    createdAutotasks,
    sentinels,
    sentinelClient,
  );
  console.log(`Sentinels created: ${JSON.stringify(createdSentinels, null, 2)}`);
})();
