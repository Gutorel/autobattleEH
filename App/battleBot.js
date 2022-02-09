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
  'function startFight(uint256 _pid, uint256[] _heroIds, uint256[] _heroIds2, string _fight)'
]

const battleAdrr = '0x2d9849294294d6A13c16aC92354305ba058a0D19'

const moralisRPC =
  'https://bsc-dataseed.binance.org'

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
    if (req.status === 200 && req.data) {
      const { data } = req.data
      log.info(`fightID: ${data.fightId}`)
      const tx = await battleContract.startFight(reqData.poolId, (reqData.heroIds) ? reqData.heroIds : [], (reqData.heroIds2) ? reqData.heroIds2 : [], data.fightMsg, options)
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
