const { ethers } = require('hardhat');

const { abi: cometAbi } = require('../abi/Comet.json');
const { abi: tokenAbi } = require('../abi/ERC20.json');

const fauceteerAbi = [
  'function drip(address)',
];

// Specific to Mumbai deployment
const cometAddress = '0xF09F0369aB0a875254fB565E52226c88f10Bc839';
const fauceteerAddress = '0x1Cea3a83BA17692cEa8DB37D72446f014480F3bE';

describe('Comet Market Monitor', () => {
  let owner;
  let user2;
  let cometContract;
  let baseTokenContract;
  const assetContractList = [];
  const transactionList = [];

  before('Account setup', async () => {
    [owner, user2] = await ethers.getSigners();

    console.log(`owner: ${owner.address}`);
    console.log(`user2: ${user2.address}`);

    // get comet contract
    cometContract = new ethers.Contract(cometAddress, cometAbi, ethers.provider);
    const baseTokenAddress = await cometContract.baseToken();
    console.log(`baseToken: ${baseTokenAddress}`);

    // get base token info
    baseTokenContract = new ethers.Contract(baseTokenAddress, tokenAbi, ethers.provider);
    const baseTokenName = await baseTokenContract.name();
    const baseTokenDecimals = await baseTokenContract.decimals();
    const baseTokenSymbol = await baseTokenContract.symbol();
    console.log(`Base Asset name(${baseTokenName}) decimals(${baseTokenDecimals}) symbol(${baseTokenSymbol}) address(${baseTokenAddress})`);

    // create Fauceteer contract to get us some base token
    const faucetContract = new ethers.Contract(fauceteerAddress, fauceteerAbi, ethers.provider);

    const numAssets = await cometContract.numAssets();
    await Promise.all((new Array(numAssets).fill(null)).map(async (_, i) => {
      const { asset: assetAddress } = await cometContract.getAssetInfo(i);
      const assetTokenContract = new ethers.Contract(assetAddress, tokenAbi, ethers.provider);
      const assetTokenName = await assetTokenContract.name();
      const assetTokenDecimals = await assetTokenContract.decimals();
      const assetTokenSymbol = await assetTokenContract.symbol();
      console.log(`Collateral Asset name(${assetTokenName}) symbol(${assetTokenSymbol}) decimals(${assetTokenDecimals}) address(${assetAddress})`);
      if (assetTokenName === 'Wrapped Matic') {
        console.log('Not including WMATIC, Fauceteer has 0 balance');
        return;
      }
      assetContractList.push(assetTokenContract);
    }));

    // Drip base asset to owner wallet
    const txFaucetSigner = faucetContract.connect(owner);
    await txFaucetSigner.drip(baseTokenAddress);
    const assetBalance = await baseTokenContract.balanceOf(owner.address);
    console.log(`owner balance: ${assetBalance} ${baseTokenSymbol}`);

    // Drip collateral assets to user2 wallet
    const txFaucetSigner2 = faucetContract.connect(user2);
    await Promise.all(assetContractList.map(async (assetContract) => {
      const symbol = await assetContract.symbol();
      try {
        await txFaucetSigner2.drip(assetContract.address);
      } finally {
        const balanceOfAsset = await assetContract.balanceOf(user2.address);
        console.log(`user2 Balance: ${balanceOfAsset} ${symbol}`);
      }
    }));
  });

  describe('Exercise Base Supply/Withdraw', () => {
    it('Should supply base asset to Comet', async () => {
      // First address will add base to Comet to be lent
      // supply base to Comet
      let ownerBaseBalance = await baseTokenContract.balanceOf(owner.address);
      const txBaseSigner = baseTokenContract.connect(owner);
      await txBaseSigner.approve(cometContract.address, ownerBaseBalance);
      const txCometSigner = cometContract.connect(owner);
      let txOutput = await txCometSigner.supply(baseTokenContract.address, ownerBaseBalance);
      transactionList.push(txOutput.hash);
      console.log(`TX(${txOutput.hash}): supply(asset=${baseTokenContract.address}, amount=${ownerBaseBalance})`);

      // withdraw half of supplied base from Comet
      const withdrawAmt = ownerBaseBalance.div(2);
      txOutput = await txCometSigner.withdraw(baseTokenContract.address, withdrawAmt);
      transactionList.push(txOutput.hash);
      console.log(`TX(${txOutput.hash}): withdraw(asset=${baseTokenContract.address}, amount=${withdrawAmt})`);

      ownerBaseBalance = await baseTokenContract.balanceOf(owner.address);
      console.log(`Owner Base Balance: ${ownerBaseBalance}`);
    });
  });

  describe('Exercise Collateral Supply', () => {
    it('Should supply collateral assets to Comet', async () => {
      const txCometSigner = cometContract.connect(user2);

      // supply collateral to Comet
      await Promise.all(assetContractList.map(async (assetContract) => {
        const assetBalance = await assetContract.balanceOf(user2.address);
        console.log(`${assetContract.address} balanceOf = ${assetBalance}`);
        const txAssetSigner = assetContract.connect(user2);
        // Approve and Supply collateral
        await txAssetSigner.approve(cometContract.address, assetBalance);
        const txOutput = await txCometSigner.supply(assetContract.address, assetBalance);
        transactionList.push(txOutput.hash);
        console.log(`TX(${txOutput.hash}): supply(asset=${assetContract.address}, amount=${assetBalance})`);
      }));

      const totalBorrow = await cometContract.totalBorrow();
      console.log(`TotalBorrow: ${totalBorrow}`);

      const borrowAmount = ethers.BigNumber.from('4998500149');

      // Borrow(withdraw) base from Comet
      let txOutput = await txCometSigner.withdraw(baseTokenContract.address, borrowAmount);
      transactionList.push(txOutput.hash);
      console.log(`TX(${txOutput.hash}): withdraw(asset=${baseTokenContract.address}, amount=${borrowAmount})`);
      let user2BaseBalance = await baseTokenContract.balanceOf(user2.address);
      console.log(`User 2 Base Balance after borrow: ${user2BaseBalance}`);

      // Repay(supply) base to Comet
      const txBaseTokenSigner2 = baseTokenContract.connect(user2);
      await txBaseTokenSigner2.approve(cometContract.address, user2BaseBalance);
      txOutput = await txCometSigner.supply(baseTokenContract.address, user2BaseBalance);
      transactionList.push(txOutput.hash);
      console.log(`TX(${txOutput.hash}): supply(asset=${baseTokenContract.address}, amount=${user2BaseBalance})`);
      user2BaseBalance = await baseTokenContract.balanceOf(user2.address);
      console.log(`User 2 Base Balance after repay: ${user2BaseBalance}`);
    });
  });

  describe('Market Monitor Autotask', () => {
    it('Output transactions to be verified', async () => {
      transactionList.forEach((transactionHash) => {
        console.log(`tx: ${transactionHash}`);
      });
    });
  });
});
