require('dotenv').config({ path: `${__dirname}/.env` });

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { SentinelClient } = require('defender-sentinel-client');
const { AutotaskClient } = require('defender-autotask-client');

// get the API key and API secret necessary to instantiate an instance of the defender client
const apiKey = process.env.DEFENDER_API_KEY;
const apiSecret = process.env.DEFENDER_API_SECRET;
const creds = { apiKey, apiSecret };

function getNotificationObject(notifyConfig, foundNotificationChannels) {
  let alertTimeoutMs;
  let notificationChannels;
  if ((notifyConfig !== undefined) && (Object.keys(notifyConfig).length > 0)) {
    alertTimeoutMs = notifyConfig.timeoutMs;
    notificationChannels = notifyConfig.notifications.map((notification) => {
      // for each notificationId, find the corresponding name to match the format required to
      // deploy a config
      const [notificationInfo] = foundNotificationChannels.filter(
        (item) => item.notificationId === notification.notificationId,
      );

      if (notificationInfo !== undefined) {
        return notificationInfo.name;
      }

      // in the unlikely event that we cannot locate the name of the notification given its id, just
      // return the id
      return notification.notificationId;
    });
  }

  return {
    alertTimeoutMs,
    notificationChannels,
  };
}

function getConditions(inputConditions, outputConditions, type) {
  if (inputConditions.length !== 0) {
    // check for a null expression
    if (inputConditions[0].expression === null) {
      let temp;
      if (type === 'event') {
        temp = { eventSignature: inputConditions[0].eventSignature };
      } else if (type === 'function') {
        temp = { functionSignature: inputConditions[0].functionSignature };
      }
      outputConditions.push(temp);
    } else {
      outputConditions.push(...inputConditions);
    }
  }
}

async function getAutotaskCode(autotaskList, autotaskClient) {
  // for each item we need to use the autotaskClient to get the code
  const promises = autotaskList.map(async (item) => autotaskClient.get(item.autotaskId));
  return Promise.all(promises);
}

function parseFortaSentinel(item, notifications, autotasks) {
  const { fortaRule, notifyConfig } = item;
  const { conditions, addresses, agentIDs } = fortaRule;
  let { autotaskCondition } = fortaRule;
  let autotaskTrigger;
  if (notifyConfig.autotaskId !== undefined) {
    autotaskTrigger = { autotaskId: notifyConfig.autotaskId };
  }

  // parse notification object to get it in correct format
  const notificationObject = getNotificationObject(notifyConfig, notifications);

  // if a sentinel contains either an autotaskCondition or autotaskTrigger (or both), parse and
  // replace the autotaskId with the name of the autotask the ID corresponds to
  if (autotaskCondition !== undefined) {
    const { autotaskId } = autotaskCondition;
    const [autotask] = autotasks.filter((value) => value.autotaskId === autotaskId);
    if (autotask !== undefined) {
      autotaskCondition = autotask.name;
    }
  }

  if (autotaskTrigger !== undefined) {
    const { autotaskId } = autotaskTrigger;
    const [autotask] = autotasks.filter((value) => value.autotaskId === autotaskId);
    if (autotask !== undefined) {
      autotaskTrigger = autotask.name;
    }
  }

  return {
    name: item.name,
    paused: item.paused,
    type: item.type,
    fortaConditions: conditions,
    addresses,
    autotaskCondition,
    autotaskTrigger,
    agentIDs,
    ...notificationObject,
  };
}

function parseContractSentinel(item, notifications, autotasks) {
  const { addressRules, notifyConfig } = item;
  const { conditions, abi, addresses } = addressRules[0];
  let { autotaskCondition } = addressRules[0];
  let autotaskTrigger;
  if (notifyConfig.autotaskId !== undefined) {
    autotaskTrigger = { autotaskId: notifyConfig.autotaskId };
  }
  const eventConditions = [];
  const functionConditions = [];
  let txConditions = [];

  // for each notification found in the sentinel's configuration, parse the object so that it is
  // the correct format for deploying and replace the notificationId with the name of the
  // notification itself
  const notificationObject = getNotificationObject(notifyConfig, notifications);

  conditions.forEach((condition) => {
    getConditions(condition.eventConditions, eventConditions, 'event');
    getConditions(condition.functionConditions, functionConditions, 'function');

    // the txConditions will be identical across all conditions
    if (condition.txConditions.length > 0) {
      ({ txConditions } = condition);
    }

    // if a sentinel contains either an autotaskCondition or autotaskTrigger (or both), parse and
    // replace the autotaskId with the name of the autotask the ID corresponds to
    if (autotaskCondition !== undefined) {
      const { autotaskId } = autotaskCondition;
      const [autotask] = autotasks.filter((value) => value.autotaskId === autotaskId);
      if (autotask !== undefined) {
        autotaskCondition = autotask.name;
      }
    }

    if (autotaskTrigger !== undefined) {
      const { autotaskId } = autotaskTrigger;
      const [autotask] = autotasks.filter((value) => value.autotaskId === autotaskId);
      if (autotask !== undefined) {
        autotaskTrigger = autotask.name;
      }
    }
  });

  return {
    type: item.type,
    network: item.network,
    // hard-code confirmLevel as it is not returned when listing sentinels and the API defaults to
    // using the highest block confirmation level
    confirmLevel: 1,
    paused: item.paused,
    name: item.name,
    addresses,
    abi,
    functionConditions,
    eventConditions,
    txCondition: txConditions.length > 0 ? txConditions[0].expression : '',
    autotaskCondition,
    autotaskTrigger,
    ...notificationObject,
  };
}

(async () => {
  // check for an output file name argument
  const filename = 'defender-config.json';
  const savedPath = 'downloaded';

  // check that the filename is valid and does not exist
  // we do not want to accidentally overwrite any files
  const dirPath = path.join(__dirname, savedPath, filename);
  fs.access(dirPath, fs.constants.F_OK, (err) => {
    if (!err) {
      // if the file exists, error out
      // we don't want to overwrite an existing file
      throw new Error('File already exists, quitting');
    }
  });

  // instantiate a sentinel and autotask client using the credentials found in the .env
  const sentinelClient = new SentinelClient(creds);
  const autotaskClient = new AutotaskClient(creds);

  // list the notification channels
  const notificationChannels = await sentinelClient.listNotificationChannels();

  // get the list of autotasks
  const { items: autotaskList } = await autotaskClient.list();
  let autotasksObject = await getAutotaskCode(autotaskList, autotaskClient);

  // get the list of Sentinels
  const { items: sentinelList } = await sentinelClient.list();
  const sentinelsObject = sentinelList.map((item) => {
    switch (item.type) {
      case 'FORTA':
        return parseFortaSentinel(item, notificationChannels, autotasksObject);
      case 'BLOCK':
        return parseContractSentinel(item, notificationChannels, autotasksObject);
      default:
        throw new Error(`Unknown Sentinel type ${item.type}`);
    }
  });

  // reformat the returned notification channel objects to match the input format
  const notificationsObject = notificationChannels.map((channel) => ({
    type: channel.type,
    name: channel.name,
    config: channel.config,
    paused: channel.paused,
  }));

  // reformat the returned autotasksList to match the input format
  autotasksObject = autotasksObject.map((item) => ({
    name: item.name,
    trigger: item.trigger,
    paused: item.paused,
    encodedZippedCode: item.encodedZippedCode,
  }));

  if (dirPath !== undefined) {
    // for each item in autotaskObjects, write encodedZippedCode to a file based on the item's name
    // and add a new key/value that indicates the filename of the code
    const promises = autotasksObject.map(async (item) => {
      if (item.encodedZippedCode !== undefined) {
        // the data that is returned from defender a is base64 encoded zipfile, so we need to:
        // decode the file, unzip it, and write that data buffer into a new file with the name
        // of the autotask it represents
        const decodedZippedCode = Buffer.from(item.encodedZippedCode, 'base64');
        const loadedZip = await JSZip.loadAsync(decodedZippedCode);
        const fileData = await loadedZip.file('index.js').async('string');
        const fileName = `${item.name.replace(/ /g, '_')}.js`;
        const filePath = path.join(__dirname, savedPath, fileName);

        console.log(`Saving autotask ${item.name} to file: ${filePath}`);
        fs.writeFileSync(filePath, fileData);

        /* eslint-disable no-param-reassign */
        delete item.encodedZippedCode;
        item.autotaskFilePath = `./${path.relative(__dirname, filePath)}`;
        /* eslint-enable no-param-reassign */
      }
    });
    await Promise.all(promises);

    sentinelsObject.forEach((sentinel) => {
      // write the abi to a file and return the path
      const fileName = `${sentinel.name.replace(/ /g, '_')}_ABI.json`;
      const filePath = path.join(__dirname, savedPath, fileName);
      console.log(`Saving sentinel ABI to file: ${filePath}`);
      if (sentinel.abi) {
        fs.writeFileSync(filePath, sentinel.abi);
        // eslint-disable-next-line no-param-reassign
        sentinel.abi = `./${path.relative(__dirname, filePath)}`;
      }
    });

    const requiredParameters = {
      sentinels: sentinelsObject,
      autotasks: autotasksObject,
      notificationChannels: notificationsObject,
    };

    console.log(`Saving configuration to file: ${dirPath}`);
    fs.writeFileSync(dirPath, JSON.stringify(requiredParameters, null, 2));
    console.log('File(s) written successfully');
  } else {
    console.log('-----Notification Channels-----');
    console.log(JSON.stringify(notificationsObject, null, 2));
    console.log('-----Sentinels-----');
    console.log(JSON.stringify(sentinelsObject, null, 2));
    console.log('-----Autotasks-----');
    console.log(JSON.stringify(autotasksObject, null, 2));
  }
})();
