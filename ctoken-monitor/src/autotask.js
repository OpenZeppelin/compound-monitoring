const axios = require('axios');

async function post(url, method, headers, data) {
  return axios({
    url,
    method,
    headers,
    data,
  });
}

async function postToDiscord(url, message) {
  const method = 'post';
  const headers = {
    'Content-Type': 'application/json',
  };
  const data = JSON.stringify({ content: message });

  let response;
  try {
    // perform the POST request
    response = await post(url, method, headers, data);
  } catch (error) {
    // is this a "too many requests" error (HTTP status 429)
    if (error.response && error.response.status === 429) {
      // the request was made and a response was received
      // try again after waiting 5 seconds
      // eslint-disable-next-line no-promise-executor-return
      const promise = new Promise((resolve) => setTimeout(resolve, 5000));
      await promise;
      response = await post(url, method, headers, data);
    } else {
      // re-throw the error if it's not from a 429 status
      throw error;
    }
  }
  return response;
}

// eslint-disable-next-line func-names
exports.handler = async function (autotaskEvent) {
  // ensure that the autotaskEvent Object exists
  if (autotaskEvent === undefined) {
    throw new Error('autotaskEvent undefined');
  }

  const { secrets } = autotaskEvent;
  if (secrets === undefined) {
    throw new Error('secrets undefined');
  }

  // ensure that there is a DiscordUrl secret
  const { discordUrl } = secrets;
  if (discordUrl === undefined) {
    throw new Error('discordUrl undefined');
  }

  // Ref: https://developer.mozilla.org/en-US/docs/Web/API/URL
  function isValidUrl(string) {
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }
    return url.href;
  }

  if (isValidUrl(discordUrl) === false) {
    throw new Error('discordUrl is not a valid URL');
  }

  // ensure that the request key exists within the autotaskEvent Object
  const { request } = autotaskEvent;
  if (request === undefined) {
    throw new Error('request undefined');
  }

  // ensure that the body key exists within the request Object
  const { body } = request;
  if (body === undefined) {
    throw new Error('body undefined');
  }

  // ensure that the alert key exists within the body Object
  const { alert } = body;
  if (alert === undefined) {
    throw new Error('alert undefined');
  }

  // ensure that the alert key exists within the body Object
  const { source } = body;
  if (source === undefined) {
    throw new Error('source undefined');
  }

  // extract the metadata from the alert Object
  const {
    metadata,
  } = alert;

  // extract the hashes from the source Object
  const {
    transactionHash,
    block: {
      hash,
    },
  } = source;

  // Start of usual modifications to the autotask script
  // extract the metadata
  const {
    cTokenSymbol,
    contractAddress,
    eventName,
    usdValue,
  } = metadata;

  const eventMapping = {
    Borrow: {
      amountKey: 'borrowAmount',
      byKey: 'borrower',
      action: 'borrow',
    },
    LiquidateBorrow: {
      amountKey: 'repayAmount',
      byKey: 'liquidator',
      fromKey: 'borrower',
      action: 'liquidate',
    },
    Mint: {
      amountKey: 'mintAmount',
      byKey: 'minter',
      action: 'supply',
    },
    Redeem: {
      amountKey: 'redeemAmount',
      byKey: 'redeemer',
      action: 'withdraw',
    },
    RepayBorrow: {
      amountKey: 'repayAmount',
      byKey: 'payer',
      forKey: 'borrower',
      action: 'repay',
    },
  };

  function emojiForEvent(eventName, usdValueString) {
    // create the appropriate number of whale emoji for the value
    // add one whale for each power of 1000
    const numWhales = Math.floor((usdValueString.length - 1) / 3);
    const whaleString = '🐳'.repeat(numWhales);

    switch (eventName) {
      case 'Borrow':
        return whaleString.concat('📥');
      case 'LiquidateBorrow':
        return whaleString.concat('💔');
      case 'Mint':
        return whaleString.concat('📈');
      case 'Redeem':
        return whaleString.concat('📉');
      case 'RepayBorrow':
        return whaleString.concat('📤');
      default:
        return '';
    }
  }

  const eventEmoji = emojiForEvent(eventName, usdValue);

  const internationalNumberFormat = new Intl.NumberFormat('en-US');
  const amountString = internationalNumberFormat.format(usdValue);


  console.log(eventEmoji);
  const eventObject = eventMapping[eventName];
  const byAddress = metadata[eventObject.byKey];

  const { action } = eventObject;
  let message = `${eventEmoji} **$${amountString} of ${cTokenSymbol}** ${action}`;

  if (action === 'liquidate') {
    const fromAddress = metadata[eventObject.fromKey];
    message += ` from ${fromAddress.slice(0, 6)} by ${byAddress.slice(0, 6)}`;
  } else if (action === 'repayBorrow') {
    const forAddress = metadata[eventObject.forKey];
    message += ` by ${byAddress.slice(0, 6)}`;
    if (forAddress !== byAddress) {
      message += ` for ${forAddress.slice(0, 6)}`;
    }
  } else {
    message += ` by ${byAddress.slice(0, 6)}`;
  }

  // construct the Etherscan transaction link
  const etherscanLink = `[TX](<https://etherscan.io/tx/${transactionHash}>)`;
  // let etherscanLink = `[BLOCK](<https://etherscan.io/block/${hash}>)`;
  // etherscanLink += ` - [ACCT](<https://etherscan.io/address/${borrowerAddress}>)`;

  // create promises for posting messages to Discord webhook
  await postToDiscord(discordUrl, `${etherscanLink} ${message}`);

  return {};
};
