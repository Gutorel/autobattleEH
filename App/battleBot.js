/* eslint-disable no-unused-vars */
import ethers from 'ethers'
import dotenv from 'dotenv'
import chalk from 'chalk'
import axios from 'axios'

import Logger from './logger.js'
import { readFile } from 'fs/promises'

dotenv.config()

export const log = new Logger('battleBot')

const battleABI = [
  // 'constructor()',
  // 'event Authorized(address adr)',
  // 'event OwnershipTransferred(address owner)',
  // 'event StartFight(address indexed user, uint256 indexed pid, uint256[] heroIds, uint256[] heroIds2, string fight)'
  // 'event Unauthorized(address adr)',
  // 'function add(address _token1, address _token2, uint256 _token1Fee, uint256 _token2Fee, uint8 _countNft, bool _allowGenesis, bool _allowDemi, bool _paused)',
  // 'function authorize(address adr)',
  // 'function emergencyRetrieveAllNfts(address _ntfAddress)',
  // 'function emergencyRetrieveNfts(address _ntfAddress, uint256[] _heroIds)',
  // 'function emergencyRetrieveTokens(address _token, uint256 _amount)',
  // 'function feeAddress() view returns (address)',
  // 'function isAuthorized(address adr) view returns (bool)',
  // 'function isOwner(address account) view returns (bool)',
  // 'function isPaused() view returns (bool)',
  // 'function onERC721Received(address, address, uint256, bytes) pure returns (bytes4)',
  // 'function poolInfo(uint256) view returns (address token1, address token2, uint256 token1Fee, uint256 token2Fee, uint8 countNft, bool allowGenesis, bool allowDemi, bool paused)',
  // 'function poolLength() view returns (uint256)',
  // 'function retrieveBNB(uint256 _amount)',
  // 'function set(uint256 _pid, address _token1, address _token2, uint256 _token1Fee, uint256 _token2Fee, uint8 _countNft, bool _allowGenesis, bool _allowDemi, bool _paused)',
  // 'function setFeeAddress(address _feeAddress)',
  // 'function setPaused(bool value)',
  'function startFight(uint256 _pid, uint256[] _heroIds, uint256[] _heroIds2, string _fight)'
  // 'function transferOwnership(address adr)',
  // 'function unauthorize(address adr)',
  // 'function updatePoolPaused(uint256 _pid, bool _paused)'
]

const battleAdrr = '0x2d9849294294d6A13c16aC92354305ba058a0D19'

const moralisRPC =
  'https://speedy-nodes-nyc.moralis.io/75e4a0022ea0933f1f2387c6/bsc/mainnet'

const GAZPRICE = '5.0'
const GAZLIMIT = '170000'

const options = {
  gasPrice: ethers.utils.parseUnits(GAZPRICE, 'gwei'),
  gasLimit: GAZLIMIT
}

const headers = {
  'Content-Type': 'application/json',
  mode: 'no-cors'
}

function checkJson (json) {
  let isError = true
  const msg = ''
  if (!json.battle) return { isError, msg: 'need battle keys' }
  if (typeof json.battle !== 'object' && !json.battle.isArray()) return { isError, msg: 'battle keys need to be an array' }
  if (json.battle.length === 0) return { isError, msg: 'battle have no items' }
  for (let index = 0; index < json.battle.length; index++) {
    const elem = json.battle[index]
    if (!elem.heroId || !Array.isArray(elem.heroId) || !elem.poolId) return { isError, msg: `missing heroId or poolId at ${index}` }
    let maxHeroes = (2 * Math.floor(elem.poolId / 3)) + 1
    if (maxHeroes >= 7) maxHeroes -= 6
    if (maxHeroes !== elem.heroId.length) return { isError, msg: `wrong number of heroes at ${index}` }
  }

  isError = false
  return { isError, msg }
}

async function startBattleBot () {
  const json = JSON.parse(await readFile(new URL('./battleHero.json', import.meta.url)))
  const { isError, msg } = checkJson(json)
  //   log.debug(`json: iserror: ${isError} ${msg}`)
  if (isError) throw new Error(msg)
  const { battle } = json
  const providerRPC = new ethers.providers.JsonRpcProvider(moralisRPC)
  await providerRPC.ready
  const wallet = new ethers.Wallet(process.env.privatekey, providerRPC)
  const personalWallet = wallet.connect(providerRPC)
  const battleContract = new ethers.Contract(battleAdrr, battleABI, personalWallet)

  let rewards = 0
  for (let index = 0; index < battle.length; index++) {
    log.info(`start battle ${index + 1} / ${battle.length}`)
    const element = battle[index]
    if (element.pass === true) continue

    if (element.poolId < 9) {
      element.heroId2 = element.heroId
      element.heroId = null
    }
    const reqData = {
      account: await personalWallet.getAddress(),
      heroIds: element.heroId,
      heroIds2: element.heroId2,
      poolId: element.poolId
    }
    log.info('ask fight ID')
    const req = await axios.post('https://epichero.io/api/dungeon/v1/fight', reqData, headers)
    // console.log(req)
    if (req.status === 200 && req.data) {
      // eslint-disable-next-line no-use-before-define
      const { data } = req.data
      log.info(`fightID: ${data.fightId}`)
      // data.fightId
      // data.fightMsg
      const tx = await battleContract.startFight(reqData.poolId, (reqData.heroIds) ? reqData.heroIds : [], (reqData.heroIds2) ? reqData.heroIds2 : [], data.fightMsg, options)
      //   console.log(tx)
      // const receipt = await tx.wait(3)
      await providerRPC.waitForTransaction(tx.hash, 1, 5 * 60 * 1000)
      log.info('confirmation on the chain')

      let dataAPI = {}
      do {
        log.info('wait battle status')
        // eslint-disable-next-line promise/param-names
        await new Promise(r => setTimeout(r, 5 * 1000)) // wait 5s
        const reqAPI = await axios.get(`https://epichero.io/api/dungeon/v1/fight/${data.fightId}`)
        dataAPI = reqAPI.data.data
      } while (!(typeof dataAPI.winner !== 'undefined' && typeof dataAPI.rewards !== 'undefined' && dataAPI.isPaidFee === true && dataAPI.isAttacked === true))
      if (dataAPI.winner === 0) log.info(chalk.bold.yellow('you win'))
      else log.info(chalk.red('you loose'))
      rewards += Number.parseFloat(dataAPI.rewards[0])
    }
  }
  log.info('end of battle')
  log.info(`you win ${rewards} epicHero`)
}

if (!process.env.privatekey) throw Error('key not found')
log.info(chalk.bold('start battle bot'))
startBattleBot()
// test()

async function test () {
  const toto = {
    isPaidFee: true,
    isAttacked: false,
    isRewarded: false
  }

  do {
    // eslint-disable-next-line promise/param-names
    await new Promise(r => setTimeout(r, 1 * 1000)) // wait 5s
    console.log('top')
  } while (!(toto.isAttacked === true &&
    typeof toto.winner !== 'undefined' &&
    typeof toto.isAttacked !== 'undefined'))
  console.log('fin de test')
}
/* {
    "error": {
        "status": true,
        "message": "OK"
    },
    "data": {
        "_id": "61f1c6c8187febcc99729f80",
        "poolId": 3,
        "wallet": "0xde00ab816b4f733a775424562190e5fe9c8a8b30",
        "isPaidFee": true,
        "isAttacked": true,
        "isRewarded": false,
        "winner": 0,
        "monsters": [
            {
                "str": 32,
                "agi": 39,
                "end": 35,
                "int": 30,
                "mag": 32,
                "luk": 38,
                "_id": 1,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 5,
                "className": 2,
                "stats": 206,
                "attack": 102,
                "defense": 34,
                "agility": 39,
                "hp": 246,
                "maxHp": 412
            },
            {
                "str": 34,
                "agi": 38,
                "end": 32,
                "int": 33,
                "mag": 31,
                "luk": 39,
                "_id": 2,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 4,
                "className": 2,
                "stats": 207,
                "attack": 104,
                "defense": 35,
                "agility": 38,
                "hp": 249,
                "maxHp": 414
            },
            {
                "str": 36,
                "agi": 29,
                "end": 30,
                "int": 42,
                "mag": 41,
                "luk": 31,
                "_id": 3,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 10,
                "className": 3,
                "stats": 209,
                "attack": 108,
                "defense": 34,
                "agility": 29,
                "hp": 252,
                "maxHp": 418
            },
            {
                "str": 31,
                "agi": 38,
                "end": 35,
                "int": 35,
                "mag": 31,
                "luk": 39,
                "_id": 6,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 7,
                "className": 2,
                "stats": 209,
                "attack": 101,
                "defense": 36,
                "agility": 38,
                "hp": 252,
                "maxHp": 418
            },
            {
                "str": 39,
                "agi": 30,
                "end": 42,
                "int": 30,
                "mag": 36,
                "luk": 34,
                "_id": 10,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 4,
                "className": 1,
                "stats": 211,
                "attack": 109,
                "defense": 35,
                "agility": 30,
                "hp": 252,
                "maxHp": 422
            },
            {
                "str": 31,
                "agi": 45,
                "end": 30,
                "int": 32,
                "mag": 29,
                "luk": 45,
                "_id": 5,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 3,
                "className": 2,
                "stats": 212,
                "attack": 105,
                "defense": 36,
                "agility": 45,
                "hp": 255,
                "maxHp": 424
            },
            {
                "str": 36,
                "agi": 47,
                "end": 30,
                "int": 32,
                "mag": 31,
                "luk": 38,
                "_id": 4,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 3,
                "className": 2,
                "stats": 214,
                "attack": 105,
                "defense": 33,
                "agility": 47,
                "hp": 258,
                "maxHp": 428
            },
            {
                "str": 41,
                "agi": 35,
                "end": 38,
                "int": 33,
                "mag": 35,
                "luk": 33,
                "_id": 7,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 2,
                "className": 1,
                "stats": 215,
                "attack": 109,
                "defense": 35,
                "agility": 35,
                "hp": 258,
                "maxHp": 430
            },
            {
                "str": 34,
                "agi": 41,
                "end": 34,
                "int": 30,
                "mag": 35,
                "luk": 42,
                "_id": 8,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 5,
                "className": 2,
                "stats": 216,
                "attack": 111,
                "defense": 35,
                "agility": 41,
                "hp": 258,
                "maxHp": 432
            },
            {
                "str": 32,
                "agi": 43,
                "end": 35,
                "int": 35,
                "mag": 33,
                "luk": 43,
                "_id": 0,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 8,
                "className": 2,
                "stats": 221,
                "attack": 108,
                "defense": 38,
                "agility": 43,
                "hp": 264,
                "maxHp": 442
            },
            {
                "str": 36,
                "agi": 38,
                "end": 34,
                "int": 35,
                "mag": 35,
                "luk": 47,
                "_id": 9,
                "type": 1,
                "character": 2,
                "rarity": 2,
                "element": 1,
                "className": 2,
                "stats": 225,
                "attack": 118,
                "defense": 39,
                "agility": 38,
                "hp": 270,
                "maxHp": 450
            },
            {
                "str": 42,
                "agi": 39,
                "end": 44,
                "int": 54,
                "mag": 54,
                "luk": 37,
                "_id": 11,
                "type": 0,
                "character": 3,
                "rarity": 3,
                "element": 6,
                "className": 3,
                "stats": 270,
                "attack": 133,
                "defense": 45,
                "agility": 39,
                "hp": 540,
                "maxHp": 540
            }
        ],
        "heroes": [
            {
                "str": 41,
                "agi": 66,
                "end": 38,
                "int": 40,
                "mag": 37,
                "luk": 71,
                "bonusFusion": {},
                "heroId": 15232,
                "_id": 15232,
                "character": 2,
                "className": 2,
                "element": 7,
                "equipments": [],
                "lastBlock": 14713841,
                "level": 3,
                "onSale": false,
                "rarity": 3,
                "skills": [],
                "owner": "0xde00ab816b4f733a775424562190e5fe9c8a8b30",
                "packId": 3,
                "manaPoint": 3,
                "type": 1,
                "stats": 293,
                "attack": 149,
                "defense": 50,
                "agility": 66,
                "hp": 586,
                "maxHp": 586
            },
            {
                "str": 39,
                "agi": 41,
                "end": 38,
                "int": 78,
                "mag": 76,
                "luk": 42,
                "bonusFusion": {},
                "heroId": 18017,
                "_id": 18017,
                "character": 12,
                "className": 3,
                "element": 10,
                "equipments": [],
                "lastBlock": 14713841,
                "level": 5,
                "onSale": false,
                "rarity": 3,
                "skills": [],
                "owner": "0xde00ab816b4f733a775424562190e5fe9c8a8b30",
                "packId": 2,
                "manaPoint": 4,
                "type": 1,
                "stats": 314,
                "attack": 157,
                "defense": 53,
                "agility": 41,
                "hp": 628,
                "maxHp": 628
            },
            {
                "str": 50,
                "agi": 77,
                "end": 52,
                "int": 48,
                "mag": 51,
                "luk": 93,
                "bonusFusion": {},
                "heroId": 15227,
                "_id": 15227,
                "character": 20,
                "className": 2,
                "element": 2,
                "equipments": [],
                "lastBlock": 14713841,
                "level": 4,
                "onSale": false,
                "rarity": 4,
                "skills": [],
                "owner": "0xde00ab816b4f733a775424562190e5fe9c8a8b30",
                "packId": 3,
                "manaPoint": 3,
                "type": 1,
                "stats": 371,
                "attack": 194,
                "defense": 64,
                "agility": 77,
                "hp": 742,
                "maxHp": 742
            }
        ],
        "attacks": [
            {
                "side": 0,
                "from": 15232,
                "to": 1,
                "damage": 161,
                "isHit": true,
                "isRes": false
            },
            {
                "side": 1,
                "from": 1,
                "to": 15232,
                "damage": 52,
                "isHit": false,
                "isRes": true
            },
            {
                "side": 0,
                "from": 15232,
                "to": 1,
                "damage": 0,
                "isHit": true,
                "isRes": false
            },
            {
                "side": 1,
                "from": 1,
                "to": 15232,
                "damage": 0,
                "isHit": false,
                "isRes": true
            },
            {
                "side": 0,
                "from": 15232,
                "to": 1,
                "damage": 0,
                "isHit": true,
                "isRes": false
            },
            {
                "side": 1,
                "from": 1,
                "to": 15232,
                "damage": 53,
                "isHit": false,
                "isRes": true
            },
            {
                "side": 0,
                "from": 15232,
                "to": 1,
                "damage": 164,
                "isHit": true,
                "isRes": false
            },
            {
                "side": 1,
                "from": 2,
                "to": 15232,
                "damage": 0,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15232,
                "to": 2,
                "damage": 134,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 2,
                "to": 15232,
                "damage": 61,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15232,
                "to": 2,
                "damage": 154,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 3,
                "to": 15232,
                "damage": 69,
                "isHit": true,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15232,
                "to": 3,
                "damage": 122,
                "isHit": false,
                "isRes": true
            },
            {
                "side": 1,
                "from": 3,
                "to": 15232,
                "damage": 74,
                "isHit": true,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15232,
                "to": 3,
                "damage": 119,
                "isHit": false,
                "isRes": true
            },
            {
                "side": 1,
                "from": 3,
                "to": 15232,
                "damage": 68,
                "isHit": true,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15232,
                "to": 3,
                "damage": 139,
                "isHit": false,
                "isRes": true
            },
            {
                "side": 1,
                "from": 6,
                "to": 15232,
                "damage": 57,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15232,
                "to": 6,
                "damage": 141,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 6,
                "to": 15232,
                "damage": 56,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15232,
                "to": 6,
                "damage": 0,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 6,
                "to": 15232,
                "damage": 0,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15232,
                "to": 6,
                "damage": 145,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 10,
                "to": 15232,
                "damage": 67,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15232,
                "to": 10,
                "damage": 135,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 10,
                "to": 15232,
                "damage": 0,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15232,
                "to": 10,
                "damage": 150,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 5,
                "to": 15232,
                "damage": 66,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 18017,
                "to": 5,
                "damage": 0,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 5,
                "to": 18017,
                "damage": 58,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 18017,
                "to": 5,
                "damage": 0,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 5,
                "to": 18017,
                "damage": 58,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 18017,
                "to": 5,
                "damage": 132,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 5,
                "to": 18017,
                "damage": 55,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 18017,
                "to": 5,
                "damage": 140,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 4,
                "to": 18017,
                "damage": 60,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 18017,
                "to": 4,
                "damage": 136,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 4,
                "to": 18017,
                "damage": 0,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 18017,
                "to": 4,
                "damage": 136,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 7,
                "to": 18017,
                "damage": 61,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 18017,
                "to": 7,
                "damage": 130,
                "isHit": true,
                "isRes": true
            },
            {
                "side": 1,
                "from": 7,
                "to": 18017,
                "damage": 58,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 18017,
                "to": 7,
                "damage": 138,
                "isHit": true,
                "isRes": true
            },
            {
                "side": 1,
                "from": 8,
                "to": 18017,
                "damage": 67,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 18017,
                "to": 8,
                "damage": 138,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 8,
                "to": 18017,
                "damage": 61,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 18017,
                "to": 8,
                "damage": 138,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 0,
                "to": 18017,
                "damage": 58,
                "isHit": false,
                "isRes": true
            },
            {
                "side": 0,
                "from": 18017,
                "to": 0,
                "damage": 152,
                "isHit": true,
                "isRes": false
            },
            {
                "side": 1,
                "from": 0,
                "to": 18017,
                "damage": 59,
                "isHit": false,
                "isRes": true
            },
            {
                "side": 0,
                "from": 18017,
                "to": 0,
                "damage": 153,
                "isHit": true,
                "isRes": false
            },
            {
                "side": 1,
                "from": 9,
                "to": 18017,
                "damage": 77,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15227,
                "to": 9,
                "damage": 205,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 9,
                "to": 15227,
                "damage": 60,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15227,
                "to": 9,
                "damage": 217,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 11,
                "to": 15227,
                "damage": 81,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15227,
                "to": 11,
                "damage": 202,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 11,
                "to": 15227,
                "damage": 77,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15227,
                "to": 11,
                "damage": 186,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 11,
                "to": 15227,
                "damage": 78,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15227,
                "to": 11,
                "damage": 0,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 1,
                "from": 11,
                "to": 15227,
                "damage": 0,
                "isHit": false,
                "isRes": false
            },
            {
                "side": 0,
                "from": 15227,
                "to": 11,
                "damage": 197,
                "isHit": false,
                "isRes": false
            }
        ],
        "rewards": [
            7.17,
            0
        ]
    }
} */
