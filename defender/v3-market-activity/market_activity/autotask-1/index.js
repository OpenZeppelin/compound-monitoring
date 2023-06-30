// Variables will be defined inside of the handler
let blockExplorerURL;

const ethers = require('ethers');
const BigNumber = require('bignumber.js');
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

const { DefenderRelayProvider } = require('defender-relay-client/lib/ethers');

if (DefenderRelayProvider === undefined) {
  throw new Error('DefenderRelayProvider is undefined');
}

let BASE_INDEX_SCALE;
const zeroAddress = ethers.constants.AddressZero;

// Ref: https://github.com/compound-finance/comet/blob/28cdc031dcafa53c9848f0da3c27c1122120cba5/contracts/CometCore.sol#L110
function principalValueSupply(baseSupplyIndex_, presentValue_) {
  return (presentValue_.times(BASE_INDEX_SCALE)).dividedToIntegerBy(baseSupplyIndex_);
}

// Ref: https://github.com/compound-finance/comet/blob/28cdc031dcafa53c9848f0da3c27c1122120cba5/contracts/CometCore.sol#L118
function principalValueBorrow(baseBorrowIndex_, presentValue_) {
  const numerator = (presentValue_.times(BASE_INDEX_SCALE)).plus(baseBorrowIndex_.minus(1));
  return numerator.dividedToIntegerBy(baseBorrowIndex_);
}

// Ref: https://github.com/compound-finance/comet/blob/28cdc031dcafa53c9848f0da3c27c1122120cba5/contracts/CometCore.sol#L84
function presentValueSupply(baseSupplyIndex_, principalValue_) {
  return (principalValue_.times(baseSupplyIndex_)).dividedToIntegerBy(BASE_INDEX_SCALE);
}

// Ref: https://github.com/compound-finance/comet/blob/28cdc031dcafa53c9848f0da3c27c1122120cba5/contracts/CometCore.sol#L91
function presentValueBorrow(baseBorrowIndex_, principalValue_) {
  return (principalValue_.times(baseBorrowIndex_)).dividedToIntegerBy(BASE_INDEX_SCALE);
}

// Ref: https://github.com/compound-finance/comet/blob/28cdc031dcafa53c9848f0da3c27c1122120cba5/contracts/CometCore.sol#L73
function presentValue(principalValue_, baseSupplyIndex_, baseBorrowIndex_) {
  console.debug(`principalValue_: ${principalValue_}, baseSupplyIndex: ${baseSupplyIndex_}, baseBorrowIndex: ${baseBorrowIndex_}`);
  if (principalValue_.isGreaterThanOrEqualTo(0)) {
    return presentValueSupply(baseSupplyIndex_, principalValue_);
  }
  return presentValueBorrow(baseBorrowIndex_, principalValue_.times(-1)).times(-1);
}

// Ref: https://github.com/compound-finance/comet/blob/28cdc031dcafa53c9848f0da3c27c1122120cba5/contracts/CometCore.sol#L98
function principalValue(presentValue_, baseSupplyIndex_, baseBorrowIndex_) {
  if (presentValue_.isGreaterThanOrEqualTo(0)) {
    return principalValueSupply(baseSupplyIndex_, presentValue_);
  }
  return principalValueBorrow(baseBorrowIndex_, presentValue_.times(-1)).times(-1);
}

function supplyBase(startPrincipal, baseSupplyIndex, baseBorrowIndex, difference) {
  const balance = presentValue(startPrincipal, baseSupplyIndex, baseBorrowIndex).plus(difference);
  const endPrincipal = principalValue(balance, baseSupplyIndex, baseBorrowIndex);
  console.debug(`Supply starting principal: ${startPrincipal}, diff: ${difference}, last: ${endPrincipal}`);
  return endPrincipal;
}

function withdrawBase(startPrincipal, baseSupplyIndex, baseBorrowIndex, difference) {
  const balance = presentValue(startPrincipal, baseSupplyIndex, baseBorrowIndex).minus(difference);
  const endPrincipal = principalValue(balance, baseSupplyIndex, baseBorrowIndex);
  console.debug(`Withdraw starting principal: ${startPrincipal}, diff: ${difference}, last: ${endPrincipal}`);
  return endPrincipal;
}

function transferBase(startPrincipal, baseSupplyIndex, baseBorrowIndex, difference) {
  const balance = presentValue(startPrincipal, baseSupplyIndex, baseBorrowIndex).plus(difference);
  const endPrincipal = principalValue(balance, baseSupplyIndex, baseBorrowIndex);
  console.debug(`Transfer starting principal: ${startPrincipal}, diff: ${difference}, last: ${endPrincipal}`);
  return endPrincipal;
}

function absorbInternal(startPrincipal, baseSupplyIndex, baseBorrowIndex, difference) {
  // basePaidOut = unsigned256(newBalance - oldBalance);
  // oldBalance = presentValue(oldPrincipal)
  // newPrincipal = principalValue(newBalance)
  const oldBalance = presentValue(startPrincipal, baseSupplyIndex, baseBorrowIndex);
  const newBalance = oldBalance.plus(difference);
  const endPrincipal = principalValue(newBalance, baseSupplyIndex, baseBorrowIndex);
  console.debug(`AbsorbDebt starting principal: ${startPrincipal}, diff: ${difference}, last: ${endPrincipal}`);
  return endPrincipal;
}

function calculateNewPrincipal(
  eventData,
  accountAddress,
  principal,
  baseSupplyIndex,
  baseBorrowIndex,
) {
  const {
    eventName: signature,
    toKey,
    byKey,
    amount,
  } = eventData;

  let updatedPrincipal = new BigNumber(principal);

  switch (signature) {
    case 'Supply':
      // ensure that the Supply address is the account we're interested in
      if (byKey === accountAddress) {
        // value is being deposited into the account
        console.debug(`Supply amount: ${amount.toString()}`);
        updatedPrincipal = supplyBase(principal, baseSupplyIndex, baseBorrowIndex, amount);
      }
      break;
    case 'Withdraw':
      // ensure that the Withdraw address is the account we're interested in
      if (byKey === accountAddress) {
        // value is being taken away from the account
        console.debug(`Withdraw amount: ${amount.toString()}`);
        updatedPrincipal = withdrawBase(principal, baseSupplyIndex, baseBorrowIndex, amount);
      }
      break;
    case 'Transfer':
      // this event will be emitted in three situations
      // supplyBase - Transfer(address(0), dst, amount)
      // withdrawBase - Transfer(src, address(0), amount);
      // transferBase - Transfer(src, dst, amount);
      // filter out the supplyBase and withdrawBase calls
      if (toKey !== ethers.constants.AddressZero && byKey !== ethers.constants.AddressZero) {
        if (toKey === accountAddress) {
          // amount is being transferred away from the account
          updatedPrincipal = transferBase(principal, baseSupplyIndex, baseBorrowIndex, amount);
        }
        if (byKey === accountAddress) {
          // amount is being transferred to the account
          updatedPrincipal = transferBase(principal, baseSupplyIndex, baseBorrowIndex, amount);
        }
      } else {
        // the Sentinel should have filtering to prevent this, so this should never execute
        console.error(`Unexpected: one of the Transfer() address arguments is zero: ${toKey}, ${byKey}`);
      }
      break;
    case 'AbsorbDebt':
      // the protocol's collateral reserves go up and the collateral of the account is seized
      // event AbsorbDebt(address absorber, address borrower, uint basePaidOut, uint usdValue)
      // this event signifies a change in principal in the case of the account in question having
      // its debt absorbed
      if (byKey === accountAddress) {
        // line go down
        updatedPrincipal = absorbInternal(principal, baseSupplyIndex, baseBorrowIndex, amount);
      }
      break;
    case 'WithdrawCollateral':
    case 'SupplyCollateral':
    case 'TransferCollateral':
    case 'AbsorbCollateral':
    case 'BuyCollateral':
    case 'WithdrawReserves':
      console.debug(`${signature} event does not affect principal`);
      break;
    default:
      console.error(`Unknown event signature: ${signature}`);
  }

  console.debug(`Returning updated principal: ${updatedPrincipal}`);
  return updatedPrincipal;
}

const eventMapping = {
  // event Supply(address indexed from, address indexed dst, uint amount);
  Supply: {
    byKey: 'dst',
    toKey: 'from',
    amountKey: 'amount',
    action: 'Supply',
  },
  // event Transfer(address indexed from, address indexed to, uint amount);
  Transfer: {
    byKey: 'from',
    toKey: 'to',
    amountKey: 'amount',
  },
  // event Withdraw(address indexed src, address indexed to, uint amount);
  Withdraw: {
    byKey: 'src',
    toKey: 'to',
    amountKey: 'amount',
    action: 'Withdraw',
  },
  /* eslint-disable max-len */
  // event SupplyCollateral(address indexed from, address indexed dst, address indexed asset, uint amount);
  SupplyCollateral: {
    byKey: 'dst',
    toKey: 'from',
    assetKey: 'asset',
    amountKey: 'amount',
  },
  // event TransferCollateral(address indexed from, address indexed to, address indexed asset, uint amount);
  TransferCollateral: {
    byKey: 'from',
    toKey: 'to',
    assetKey: 'asset',
    amountKey: 'amount',
  },
  // event WithdrawCollateral(address indexed src, address indexed to, address indexed asset, uint amount);
  WithdrawCollateral: {
    byKey: 'src',
    toKey: 'to',
    assetKey: 'asset',
    amountKey: 'amount',
  },
  // event AbsorbDebt(address indexed absorber, address indexed borrower, uint basePaidOut, uint usdValue);
  AbsorbDebt: {
    byKey: 'borrower',
    toKey: 'absorber',
    amountKey: 'basePaidOut',
  },
  // event AbsorbCollateral(address indexed absorber, address indexed borrower, address indexed asset, uint collateralAbsorbed, uint usdValue);
  AbsorbCollateral: {
    byKey: 'absorber',
    toKey: 'borrower',
    assetKey: 'asset',
    amountKey: 'collateralAbsorbed',
  },
  // event BuyCollateral(address indexed buyer, address indexed asset, uint baseAmount, uint collateralAmount);
  BuyCollateral: {
    byKey: 'buyer',
    toKey: 'buyer',
    amountKey: 'collateralAmount',
    assetKey: 'asset',
  },
  // event WithdrawReserves(address indexed to, uint amount);
  /* eslint-enable max-len */
  WithdrawReserves: {
    byKey: 'to',
    toKey: 'to',
    amountKey: 'amount',
  },
};

// Create an ordered list of events by user
async function getEventsByUser(
  contract,
  cometInterface,
  blockNumber,
  baseSupplyIndex,
  baseBorrowIndex,
) {
  const { provider } = contract;
  const topics = [[
    cometInterface.getEventTopic('Supply'),
    cometInterface.getEventTopic('Transfer'),
    cometInterface.getEventTopic('Withdraw'),
    cometInterface.getEventTopic('SupplyCollateral'),
    cometInterface.getEventTopic('TransferCollateral'),
    cometInterface.getEventTopic('WithdrawCollateral'),
    cometInterface.getEventTopic('AbsorbDebt'),
    cometInterface.getEventTopic('AbsorbCollateral'),
    cometInterface.getEventTopic('BuyCollateral'),
    cometInterface.getEventTopic('WithdrawReserves'),
  ]];

  // Get all logs from all transactions
  const rawLogs = await provider.getLogs({
    fromBlock: blockNumber,
    toBlock: blockNumber,
    address: contract.address,
    topics,
  });
  const parsedLogs = rawLogs.map((log) => cometInterface.parseLog(log));

  const eventsByUser = {};

  // Note about logIndex: "The index of this log across all logs in the entire block."
  // ref: https://docs.ethers.io/v5/api/providers/types/#providers-Log
  parsedLogs.forEach((event, parsedLogIndex) => {
    const currentMap = eventMapping[event.name];
    const rawLog = rawLogs[parsedLogIndex];
    const normalizedEvent = {
      logIndex: rawLog.logIndex,
      blockNumber: rawLog.blockNumber,
      blockHash: rawLog.blockHash,
      transactionHash: rawLog.transactionHash,
      eventName: event.name,
      byKey: event.args[currentMap.byKey],
      toKey: event.args[currentMap.toKey],
      assetAddress: event.args[currentMap.assetKey],
      action: event[currentMap.action],
      amountKey: currentMap.amountKey,
      amountUsdKey: currentMap.amountUsdKey,
    };

    if (event.args[currentMap.amountKey] !== undefined) {
      normalizedEvent.amount = new BigNumber(event.args[currentMap.amountKey].toString());
    }

    if (event.args[currentMap.amountUsdKey] !== undefined) {
      normalizedEvent.amountUsd = new BigNumber(event.args[currentMap.amountUsdKey].toString());
    }

    const userAddress = normalizedEvent.byKey;
    if (eventsByUser[userAddress] === undefined) {
      eventsByUser[userAddress] = [];
    }
    eventsByUser[userAddress].push(normalizedEvent);
  });

  Object.keys(eventsByUser).forEach((userAddress) => {
    eventsByUser[userAddress] = eventsByUser[userAddress].sort((a, b) => a.logIndex - b.logIndex);
    // remove Transfer events to/from the zero address (toKey/byKey)
    eventsByUser[userAddress] = eventsByUser[userAddress].filter((a) => {
      const result = (a.eventName !== 'Transfer') || (a.toKey !== zeroAddress && a.byKey !== zeroAddress);
      return result;
    });
  });

  // Calculate the balance of each user
  await Promise.all(Object.keys(eventsByUser).map(async (userAddress) => {
    let [principal] = await contract.userBasic(userAddress, { blockTag: blockNumber - 1 });
    principal = new BigNumber(principal.toString());

    // grab all of the events for the user in this block
    const userEvents = eventsByUser[userAddress];

    // Iterate over each event and adjust the principal
    // calculate the principal after each event in the block
    for (let i = 0; i < userEvents.length; i += 1) {
      // no matter what, record the current principal
      userEvents[i].principalBefore = new BigNumber(principal);

      // calculate the updated principal, based upon the event
      principal = calculateNewPrincipal(
        userEvents[i],
        userAddress,
        principal,
        baseSupplyIndex,
        baseBorrowIndex,
      );

      // store the resulting principal
      userEvents[i].principalAfter = new BigNumber(principal);
    }
  }));

  return eventsByUser;
}

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

const tokenAbi = [
  'function symbol() view returns (string)',
];

async function getTokenInfo(address, provider) {
  // Gather token symbol
  const contract = new ethers.Contract(address, tokenAbi, provider);
  const symbol = await contract.symbol();

  return {
    symbol,
  };
}

const priceFeedAbi = [
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
];

async function getPriceFeedTokenPrice(priceFeed, provider) {
  // Get current price of the specified tokenAddress
  // - use the priceFeed specified by the contract asset list
  const contract = new ethers.Contract(priceFeed, priceFeedAbi, provider);
  const decimals = await contract.decimals();

  return {
    decimals,
  };
}

function emojiForEvent(eventType, usdValueString) {
  // create the appropriate number of whale emoji for the value
  // add one whale for each power of 1000
  const numWhales = Math.floor((usdValueString.length - 1) / 3);
  const whaleString = '🐳'.repeat(numWhales);

  switch (eventType) {
    case 'Withdraw':
      return whaleString.concat('📤');
    case 'Supply':
      return whaleString.concat('📥');
    case 'LiquidateBorrow':
      return whaleString.concat('💔');
    case 'SupplyCollateral':
      return whaleString.concat('📈');
    case 'WithdrawCollateral':
      return whaleString.concat('📉');
    case 'RepayBorrow':
      return whaleString.concat('📤');
    case 'Transfer':
      return whaleString.concat('🔄');
    case 'TransferCollateral':
      return whaleString.concat('🔄');
    case 'AbsorbDebt':
      return whaleString.concat(' ♻');
    case 'AbsorbCollateral':
      return whaleString.concat(' ♻');
    case 'BuyCollateral':
      return whaleString.concat('💱');
    case 'WithdrawReserves':
      return whaleString.concat('💸');
    default:
      return '';
  }
}

async function postIt(
  transactionHash,
  discordUrl,
  eventData,
  blockNumber,
  cometContract,
  provider,
) {
  const {
    eventName,
    byKey: byAddress,
    amountUsdKey,
    amountUsd,
    principalBefore: startPrincipalBalance,
    principalAfter: endPrincipalBalance,
  } = eventData;

  let { assetAddress } = eventData;

  const internationalNumberFormat = new Intl.NumberFormat('en-US');

  let amount;
  if (amountUsdKey !== undefined) {
    amount = [amountUsd];
  } else {
    amount = [eventData.amount];
  }

  let eventNameString = eventName;

  // Distinguish between a base withdraw/borrow
  // - Comet emits the same Withdraw event for both withdraw and borrow actions
  if (eventName === 'Withdraw') {
    if (startPrincipalBalance.isLessThan(endPrincipalBalance)) {
      throw new Error(`Invalid start(${startPrincipalBalance}) and end(${endPrincipalBalance}) principal values for Withdraw`);
    }
    if (!startPrincipalBalance.isZero() && startPrincipalBalance.isPositive()) {
      // Withdraw || Withdraw & Borrow
      if (endPrincipalBalance.isNegative()) {
        eventNameString = 'Withdraw,Borrow';
        amount = [startPrincipalBalance, endPrincipalBalance.absoluteValue()];
      }
    } else if (endPrincipalBalance.isNegative()) {
      // Borrow
      eventNameString = 'Borrow';
    }
  }
  // Distinguish between a base supply/repay
  // - Comet emits the same Supply event for both supply and repay actions
  if (eventName === 'Supply') {
    if (startPrincipalBalance.isGreaterThan(endPrincipalBalance)) {
      // This is a supply so start principal should never be greater then end principal
      throw new Error(`Invalid start(${startPrincipalBalance}) and end(${endPrincipalBalance}) principal values for Supply`);
    }

    if (!startPrincipalBalance.isZero() && startPrincipalBalance.isNegative()) {
      // Repay || Supply & Repay
      if (!endPrincipalBalance.isZero() && endPrincipalBalance.isPositive()) {
        eventNameString = 'Repay,Supply';
        amount = [startPrincipalBalance.absoluteValue(), endPrincipalBalance];
      } else {
        eventNameString = 'Repay';
      }
    }
  }
  let assetScale;
  let priceFeed;

  const blockTag = { blockTag: blockNumber };

  // Get asset address, price feed, scale
  if (assetAddress !== undefined) {
    // collateral asset
    const assetInfo = await cometContract.getAssetInfoByAddress(assetAddress, blockTag);
    ({ priceFeed, scale: assetScale } = assetInfo);
  } else {
    // base asset
    assetAddress = await cometContract.baseToken(blockTag);
    priceFeed = await cometContract.baseTokenPriceFeed(blockTag);
    assetScale = await cometContract.baseScale(blockTag);
  }
  // Get base symbol
  const baseAssetAddress = await cometContract.baseToken(blockTag);
  const {
    symbol: baseSymbol,
  } = await getTokenInfo(baseAssetAddress, provider);

  // convert asset to BigNumber
  assetScale = new BigNumber(assetScale.toString());

  // get asset symbol
  const {
    symbol,
  } = await getTokenInfo(assetAddress, provider);

  // let usdValue;
  const usdValues = await Promise.all(amount.map(async (amountItem) => {
    let usdValue;
    if (amountUsdKey !== undefined) {
      // Amount is in USD
      usdValue = amountItem.div(assetScale);
      if (usdValue >= 1) {
        usdValue = usdValue.integerValue(BigNumber.ROUND_FLOOR);
      } else {
        usdValue = usdValue.integerValue(BigNumber.ROUND_CEIL);
      }
    } else {
      // Get price feed divisor(scale)
      const { decimals } = await getPriceFeedTokenPrice(priceFeed, provider);
      const priceFeedDivisor = (new BigNumber(10)).pow(decimals);
      // Get asset price per USD
      const usdPerToken = new BigNumber(
        (await cometContract.getPrice(priceFeed, blockTag)).toString(),
      );

      // Calculate asset price in USD
      usdValue = amountItem.div(assetScale)
        .times(usdPerToken.div(priceFeedDivisor));
      if (usdValue >= 1) {
        usdValue = usdValue.integerValue(BigNumber.ROUND_FLOOR);
      } else {
        usdValue = usdValue.integerValue(BigNumber.ROUND_CEIL);
      }
    }
    return usdValue;
  }));

  if (usdValues.every((value) => value.isLessThanOrEqualTo(1) === true)) {
    console.debug(`Dropping event(${eventName}) in TX ${transactionHash}, value too low`);
    return;
  }

  // construct the Etherscan transaction link
  const blockExplorerLink = `[TX](<${blockExplorerURL}${transactionHash}>)`;

  // modify message if USDC is the base asset
  let dollarSign = '';
  let messageModifier = '';
  if (baseSymbol === 'USDC') {
    dollarSign = '$';
    messageModifier = `of ${symbol}`;
  } else if (baseSymbol === symbol) {
    messageModifier = `${symbol}`;
  } else {
    messageModifier = `${baseSymbol} worth of ${symbol}`;
  }

  // Create message
  let message;
  if (usdValues.length === 1) {
    const amountString = internationalNumberFormat.format(usdValues[0]);
    const eventEmoji = emojiForEvent(eventName, amountString);
    message = `${eventEmoji} **${dollarSign}${amountString} ${messageModifier}** ${eventNameString}`;
    message += ` by ${byAddress.slice(0, 6)}`;
  } else if (usdValues.length === 2) { // Withdraw&Borrow , Repay&Supply cases
    const amountString1 = internationalNumberFormat.format(usdValues[0]);
    const amountString2 = internationalNumberFormat.format(usdValues[1]);
    const amountStringTotal = internationalNumberFormat.format(usdValues[0].plus(usdValues[1]));
    const eventEmoji = emojiForEvent(eventName, amountStringTotal);
    const [eventNameString1, eventNameString2] = eventNameString.split(',');
    message = `${eventEmoji} **${dollarSign}${amountString1} ${messageModifier}** ${eventNameString1}`;
    message += ` by ${byAddress.slice(0, 6)}\n`;
    message += `   ${eventEmoji} **${dollarSign}${amountString2} ${messageModifier}** ${eventNameString2}`;
    message += ` by ${byAddress.slice(0, 6)}`;
  } else {
    throw new Error(`Too many values in usdValues(${usdValues})`);
  }
  console.debug(`message: ${message}`);
  await postToDiscord(discordUrl, `${blockExplorerLink} ${message}`);
}

// eslint-disable-next-line func-names
exports.handler = async function (autoTaskEvent) {
  // ensure that the body key exists within the request Object
  const body = autoTaskEvent?.request?.body;
  if (body === undefined) {
    throw new Error('body undefined');
  }

  const {
    transaction,
    sentinel,
  } = body;
  if (transaction === undefined) {
    throw new Error('transaction undefined');
  }
  // ref: https://docs.openzeppelin.com/defender/sentinel#request_schema
  const {
    name: sentinelName, abi: cometAbi, addresses, network,
  } = sentinel;

  // Locate Discord webhook secret
  // - USDC,WETH market activity updates are sent to different discord webhooks
  // - the webhook secret is in the format <stackName>_webhookURL
  // - stackName is in the format market_activity_<USDC|WETH>
  // parse sentinel name for market USDC,WETH
  const tmpMarketMatches = sentinelName.match(/(USDC|WETH)/g);
  if (tmpMarketMatches === null) {
    throw new Error(`Invalid Sentinel name(${sentinelName}).  Must contain USDC or WETH to determine market`);
  }
  const marketMatches = [...new Set(tmpMarketMatches)]; // remove duplicates
  if (marketMatches.length !== 1) {
    throw new Error(`Invalid Sentinel name(${sentinelName}).  Must contain USDC or WETH to determine market`);
  }
  const stackName = `market_activity_${marketMatches[0]}_${network}`;
  const discordSecretName = `${stackName}_webhookURL`;

  const { secrets } = autoTaskEvent;
  if (secrets === undefined) {
    throw new Error('secrets undefined');
  }

  // ensure that there is a DiscordUrl secret
  const discordUrl = secrets[discordSecretName];
  console.log(`discordSecretName: ${discordSecretName}`);
  console.log(`discordUrl: ${discordUrl}`);
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

  // Block explorer mapping
  // ref: https://github.com/OpenZeppelin/defender-client/blob/master/packages/base/src/utils/network.ts
  switch (network) {
    // Ethereum Mainnet
    case 'mainnet':
      blockExplorerURL = 'https://etherscan.io/tx/';
      break;
    // Ethereum testnet
    case 'goerli':
      blockExplorerURL = 'https://goerli.etherscan.io/tx/';
      break;
    // Ethereum testnet
    case 'kovan':
      blockExplorerURL = 'https://kovan.etherscan.io/tx/';
      break;
    // Polygon mainnet
    case 'matic':
      blockExplorerURL = 'https://polygonscan.com/tx/';
      break;
    // Polygon testnet
    case 'mumbai':
      blockExplorerURL = 'https://mumbai.polygonscan.com/tx/';
      break;
    // Avalanche Mainnet
    case 'avalanche':
      blockExplorerURL = 'https://avascan.info/blockchain/c/tx/';
      break;
    // Avalanche testnet
    case 'fuji':
      blockExplorerURL = 'https://testnet.avascan.info/blockchain/c/tx/';
      break;
    case 'arbitrum':
      blockExplorerURL = 'https://arbiscan.io/tx/';
      break;
    case 'arbitrum-goerli':
      blockExplorerURL = 'https://goerli.arbiscan.io/tx/';
      break;
    default:
      throw new Error(`Block Explorer not found for this network: ${network}`);
  }

  // add the function definition for the totalsBasic method
  cometAbi.push({
    inputs: [],
    name: 'totalsBasic',
    outputs: [
      {
        components: [
          {
            internalType: 'uint64',
            name: 'baseSupplyIndex',
            type: 'uint64',
          },
          {
            internalType: 'uint64',
            name: 'baseBorrowIndex',
            type: 'uint64',
          },
          {
            internalType: 'uint64',
            name: 'trackingSupplyIndex',
            type: 'uint64',
          },
          {
            internalType: 'uint64',
            name: 'trackingBorrowIndex',
            type: 'uint64',
          },
          {
            internalType: 'uint104',
            name: 'totalSupplyBase',
            type: 'uint104',
          },
          {
            internalType: 'uint104',
            name: 'totalBorrowBase',
            type: 'uint104',
          },
          {
            internalType: 'uint40',
            name: 'lastAccrualTime',
            type: 'uint40',
          },
          {
            internalType: 'uint8',
            name: 'pauseFlags',
            type: 'uint8',
          },
        ],
        internalType: 'struct CometStorage.TotalsBasic',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  });

  // add the function definition for the BASE_INDEX_SCALE constant
  cometAbi.push({
    inputs: [],
    name: 'baseIndexScale',
    outputs: [
      {
        internalType: 'uint64',
        name: '',
        type: 'uint64',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  });

  const cometAddress = addresses[0];

  const {
    transactionHash,
    blockNumber: currentBlockNumber,
  } = transaction;
  if (transactionHash === undefined) {
    throw new Error('transactionHash undefined');
  }
  if (currentBlockNumber === undefined) {
    throw new Error('blockNumber undefined');
  }
  const blockNumber = Number(currentBlockNumber);

  const provider = new DefenderRelayProvider(autoTaskEvent);
  const cometContract = new ethers.Contract(cometAddress, cometAbi, provider);
  const cometInterface = new ethers.utils.Interface(cometAbi);

  const totalsBasic = await cometContract.totalsBasic({ blockTag: blockNumber });
  const [baseSupplyIndexEthers, baseBorrowIndexEthers] = totalsBasic;
  const baseSupplyIndex = new BigNumber(baseSupplyIndexEthers.toString());
  const baseBorrowIndex = new BigNumber(baseBorrowIndexEthers.toString());
  console.debug(`totalsBasic: ${totalsBasic}`);

  (BASE_INDEX_SCALE = await cometContract.baseIndexScale({ blockTag: blockNumber }));
  BASE_INDEX_SCALE = new BigNumber(BASE_INDEX_SCALE.toString());
  console.debug(`BASE_INDEX_SCALE: ${BASE_INDEX_SCALE}`);

  // Grab all events from that block
  const eventsByUser = await getEventsByUser(
    cometContract,
    cometInterface,
    blockNumber,
    baseSupplyIndex,
    baseBorrowIndex,
  );

  // find all of the events that match our transaction hash
  let eventsToAlert = [];
  Object.values(eventsByUser).forEach((normalizedEvents) => {
    normalizedEvents.forEach((normalizedEvent) => {
      if (normalizedEvent.transactionHash === transactionHash) {
        eventsToAlert.push(normalizedEvent);
      }
    });
  });

  // Sort the events
  eventsToAlert = eventsToAlert.sort((a, b) => a.logIndex - b.logIndex);

  // NOTE: the order of these events matters
  // we want to accurately reflect the order of the events in the transaction
  // therefore, we must use a for loop to intentionally post in order
  for (let index = 0; index < eventsToAlert.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await postIt(
      transactionHash,
      discordUrl,
      eventsToAlert[index],
      blockNumber,
      cometContract,
      provider,
    );
  }

  return {};
};
