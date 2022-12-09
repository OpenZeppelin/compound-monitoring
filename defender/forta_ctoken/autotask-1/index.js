const stackName = 'forta_ctoken';
const discordSecretName = `${stackName}_discordWebhook`;

const axios = require('axios');
const axiosRetry = require('axios-retry');

function condition(error) {
  const result = axiosRetry.isNetworkOrIdempotentRequestError(error);
  const rateLimit = (error.response.status === 429);
  return result || rateLimit;
}

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: condition,
});

async function postToDiscord(url, message) {
  const method = 'post';
  const headers = {
    'Content-Type': 'application/json',
  };
  const data = { content: message };

  const response = await axios({
    url,
    method,
    headers,
    data,
  });
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
  const discordUrl = secrets[discordSecretName];
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
  const { metadata } = alert;
  if (metadata === undefined) {
    throw new Error('metadata undefined');
  }

  // extract the hashes from the source Object
  const {
    transactionHash,
  } = source;

  // Start of usual modifications to the autotask script
  // extract the metadata
  const {
    cTokenSymbol,
    eventName,
    usdValue,
  } = metadata;
  if (usdValue === undefined) {
    throw new Error('usdValue undefined, please use newer bot version');
  }

  const eventMapping = {
    Borrow: {
      amountKey: 'borrowAmount',
      byKey: 'borrower',
      action: 'borrowed',
    },
    LiquidateBorrow: {
      amountKey: 'repayAmount',
      byKey: 'liquidator',
      fromKey: 'borrower',
      action: 'liquidated',
    },
    Mint: {
      amountKey: 'mintAmount',
      byKey: 'minter',
      action: 'supplied',
    },
    Redeem: {
      amountKey: 'redeemAmount',
      byKey: 'redeemer',
      action: 'withdrew',
    },
    RepayBorrow: {
      amountKey: 'repayAmount',
      byKey: 'payer',
      forKey: 'borrower',
      action: 'repaid',
    },
  };

  function emojiForEvent(eventType, usdValueString) {
    // create the appropriate number of whale emoji for the value
    // add one whale for each power of 1000
    const numWhales = Math.floor((usdValueString.length - 1) / 3);
    const whaleString = '🐳'.repeat(numWhales);

    switch (eventType) {
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

  const eventObject = eventMapping[eventName];
  const byAddress = metadata[eventObject.byKey];

  const { action } = eventObject;
  let message = `${eventEmoji} **$${amountString} of ${cTokenSymbol}** ${action}`;

  if (action === 'liquidated') {
    const fromAddress = metadata[eventObject.fromKey];
    message += ` from ${fromAddress.slice(0, 6)} by ${byAddress.slice(0, 6)}`;
  } else if (action === 'repaid') {
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

  // create promises for posting messages to Discord webhook
  // with Log Forwarding enabled, this console.log will forward the text string to Dune Analytics
  console.log(`${etherscanLink} ${message}`);
  await postToDiscord(discordUrl, `${etherscanLink} ${message}`);

  return {};
};
