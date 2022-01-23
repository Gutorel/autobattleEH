/* eslint-disable no-unused-vars */
import ethers, { BigNumber } from 'ethers';
import dotenv from 'dotenv';
import chalk from 'chalk';

import startConnection from './connection.js';
import Logger from './logger.js';

import TelegramBot from 'node-telegram-bot-api';


dotenv.config();

export const log = new Logger('botMarket');

let chatID = null;



const MarketABI = [
  'event Authorized(address adr)',
  'event OwnershipTransferred(address owner)',
  'event SendWbnbDividends(uint256 amount)',
  'event TradeCancelled(uint256 tradeId, address indexed seller, uint256 indexed tokenId, uint256 price)',
  'event TradeClosed(uint256 tradeId, address indexed seller, address indexed buyer, uint256 indexed tokenId, uint256 price)',
  'event TradeOpened(uint256 tradeId, address indexed seller, uint256 indexed tokenId, uint256 price)',
  'event Unauthorized(address adr)',
  // "function authorize(address adr)",
  'function cancelTrade(uint256 tradeId)',
  // "function countOpenTradeByOwner(address seller) view returns (uint256)",
  // "function emergencyReturnNfts()",
  'function executeTrade(uint256 tradeId)',
  // "function feeWallet() view returns (address)",
  // "function getOpenTradeByToken(uint24 tokenId) view returns (tuple(uint24 id, uint24 tokenId, uint8 status, uint256 tokenPrice, address seller, address buyer))",
  // "function getOpenTradesLength() view returns (uint256)",
  // "function getOpenTradesSlice(uint256 start, uint256 end) view returns (tuple(uint24 id, uint24 tokenId, uint8 status, uint256 tokenPrice, address seller, address buyer)[])",
  // "function getOpensTradeByOwner(address seller) view returns (tuple(uint24 id, uint24 tokenId, uint8 status, uint256 tokenPrice, address seller, address buyer)[])",
  // "function getTrade(uint256 tradeId) view returns (tuple(uint24 id, uint24 tokenId, uint8 status, uint256 tokenPrice, address seller, address buyer))",
  // "function getTradeCount() view returns (uint256)",
  // "function isAuthorized(address adr) view returns (bool)",
  // "function isClosed() view returns (bool)",
  // "function isOwner(address account) view returns (bool)",
  // "function minPriceAtRarity(uint8) view returns (uint256)",
  // "function minRarity() view returns (uint8)",
  // "function nftAddress() view returns (address)",
  // "function onERC721Received(address, address, uint256, bytes) pure returns (bytes4)",
  'function openTrade(uint24 tokenId, uint256 price)',
  // "function retrieveBNB(uint256 amount)",
  // "function retrieveTokens(address _token, uint256 amount)",
  // "function setCloseMarket(bool value)",
  // "function setMinPriceAtRarity(uint8 rarity, uint256 minPrice)",
  // "function setMinRarity(uint8 rarity)",
  // "function setSwapTokensAtAmount(uint256 _swapAmount)",
  // "function setTradeFee(uint256 newFee)",
  // "function setWbnbReflectRewardsFee(uint256 newFee)",
  // "function setWbnbReflectToken(address _newContract)",
  // "function setWbnbReflectTracker(address _newContract)",
  // "function swapTokensAtAmount() view returns (uint256)",
  // "function tokenAddress() view returns (address)",
  // "function tradeFee() view returns (uint256)",
  // "function transferOwnership(address adr)",
  // "function unauthorize(address adr)",
  // "function wbnbReflectRewardsFee() view returns (uint256)",
  // "function wbnbReflectToken() view returns (address)",
  // "function wbnbReflectTracker() view returns (address)",
];

const DemiABI = [
  'function getHero(uint256 heroId) public view returns (uint8 level, uint8 rarity)',
  // 'function balanceOf(address owner) external view returns (uint balance)',
  // 'function tokenOfOwnerByIndex(address owner, uint index) external view returns (uint tokenId)',
  // 'event CardMinted(address recipient, uint heroId, uint8 packId)',
  // 'event CardSetAdded(uint setId, uint64 mintLimit)',
  // 'event CardSetEdited(uint setId, uint64 mintLimit)',
  // 'event PackPurchased(address user, uint8 packId)',
  // 'event PackAdded(uint packId, uint basePrice, uint basePrice2, uint8 numOfCards, uint8 cardSetId, address tokenAddress, address tokenAddress2)',
  // 'event PackEdited(uint packId, uint basePrice, uint basePrice2, uint8 numOfCards, bool saleRunning, uint8 cardSetId, address tokenAddress, address tokenAddress2)',
  // 'event AttributeAdded(uint id, string name)',
  // 'event AttributeEdited(uint id, string name)',
  // 'event AttributeChanged(uint heroId, string attributeName, string newValue)',
  // 'event AdminKillHero(uint indexed heroId)',
  // 'event AdminSetLevel(uint indexed heroId, uint8 newLevel)',
  // 'event UserLevelUp(uint indexed heroId, uint8 newLevel)',
  // 'event WaitingLevelUp(uint indexed heroId, uint8 newLevel)',
];
const EpicHeroNFTDemiAddr = '0xDD581CAb6F7643AB11498a4B83a8bcDA9EACa29A';
const DemiMarketV2 = '0x56D6B3f0Cb98ba9373b56b9784a043AF910C9D9A';

const moralisRPC = 'https://speedy-nodes-nyc.moralis.io/75e4a0022ea0933f1f2387c6/bsc/mainnet';
const morlisWS = 'wss://speedy-nodes-nyc.moralis.io/75e4a0022ea0933f1f2387c6/bsc/mainnet/ws';

const GAZPRICE = '5.5';
const GAZLIMIT = '300000';

const options = {
  gasPrice: ethers.utils.parseUnits(GAZPRICE, 'gwei'),
  gasLimit: GAZLIMIT,
};

async function startMarketBot() {
  const providerWS = new ethers.providers.WebSocketProvider(morlisWS);
  const bot = new TelegramBot(process.env.BOT_TOKEN, {polling: true});

  startConnection(providerWS, (err) => {
    log.error('The ws connection was closed',JSON.stringify(err, null, 2));
    startMarketBot();
  });
  const contractMarket = new ethers.Contract(
    DemiMarketV2,
    MarketABI,
    providerWS,
  );

  contractMarket.on('TradeOpened', (tradeId, seller, tokenId, price) => {
    log.info(`tradeId:${tradeId}, seller: ${seller}, tokenId: ${tokenId}, price: ${ethers.utils.formatEther(price)}`)
    const bloc = async () => {
      const contractDemi = new ethers.Contract(
        EpicHeroNFTDemiAddr,
        DemiABI,
        providerWS,
      );
      const hero = await contractDemi.getHero(tokenId);
      log.info(`level:${hero.level}, rarity:${hero.rarity}`);
      const priceBigNumber = BigNumber.from(price);
      const limitPrice = ethers.utils.parseEther('20');
      if (hero.rarity >= 3 && priceBigNumber.lte(limitPrice)) {
        log.info(chalk.blue.bgRed.bold('BUYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY'));
        try {
          const providerRPC = new ethers.providers.StaticJsonRpcProvider(moralisRPC);
          await providerRPC.ready
          const wallet = new ethers.Wallet(process.env.privatekey, providerRPC);
          const personalWallet = wallet.connect(providerRPC);
          const contractMarketSigned = new ethers.Contract(
            DemiMarketV2,
            MarketABI,
            personalWallet,
          );
          const tx = await contractMarketSigned.executeTrade(tradeId, options);
          log.debug('send transaction');
          if (chatID) bot.sendMessage(chatID, `send transaction for demi ${hero.rarity} at ${ethers.utils.formatEther(price)} thoreum`);
          const data = await providerRPC.waitForTransaction(
            tx.hash,
            1, // 1 confirmation
            2 * 60 * 1000, // timeout 2 min
          );
          if (data.status === 1) {
            log.debug('ok it`s bought');
            if (chatID) bot.sendMessage(chatID, `demi bought`)
          } else {
            log.debug('tx failed');
          }
        } catch (e) {
          log.error(chalk.red(e));
        }
      } else log.info(chalk.italic.cyan('nah....'));
    }
    bloc()
  });

  // Listen for any kind of message. There are different kinds of
  // messages.
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    if(msg.text==='/auth toto'){
      chatID = msg.chat.id;
      bot.sendMessage(chatId, 'i\'m for you my slave');
    }

    // send a message to the chat acknowledging receipt of their message
    bot.sendMessage(chatId, 'Received your message');
  });

}

if (!process.env.privatekey) throw Error('key not found')
log.info(chalk.italic('startbot'))
startMarketBot()
