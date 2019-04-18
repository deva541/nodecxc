const config = require('../config')

let Web3 = require('web3')

let idToName = {1: 'mainnet', 4: 'rinkeby'}
const web3 = new Web3(`https://${idToName[config.chain_id]}.infura.io/v3/${config.infura_key}`)

function getTxReceipt(txHash) {
  return web3.eth.getTransactionReceipt(txHash)
}

module.exports = getTxReceipt
