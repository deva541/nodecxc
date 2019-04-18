const config = require('../config')

let ABI = require("./ABI"),
Tx = require('ethereumjs-tx'),
Wallet = require('ethereumjs-wallet'),
Web3 = require('web3'),
BN = require('bignumber.js')

let idToName = {1: 'mainnet', 4: 'rinkeby'}
const web3 = new Web3(`https://${idToName[config.chain_id]}.infura.io/v3/${config.infura_key}`)

function sendTokens(tokenAddress, privKey, _to, _amount, 
    {gasPriceGwei, gasLimit, chainId} = {},
    cb
  ) {
  return new Promise(async (resolve, reject) => {
    if (!web3.utils.isAddress(_to)) return reject('Invalid to address!')
    
    if (privKey.startsWith('0x')) privKey = privKey.slice(2)

    privKey = Buffer.from(privKey, 'hex')
    
    let _from = Wallet.fromPrivateKey(privKey).getChecksumAddressString()

    let count = await web3.eth.getTransactionCount(_from)

    let contract = new web3.eth.Contract(ABI, tokenAddress, {from: _from})

    let balance = await contract.methods.balanceOf(_from).call()

    if (new BN(_amount).gt(balance)) return reject('Insufficient funds')

    gasPriceGwei = gasPriceGwei||3
    gasLimit = gasLimit || 3e6
    chainId = chainId || 4

    let rawTransaction = {
      from: _from,
      nonce: '0x'+count.toString(16),
      gasPrice: web3.utils.toHex(gasPriceGwei*1e9),
      gasLimit: web3.utils.toHex(gasLimit),
      to: tokenAddress,
      value: '0x0',
      data: contract.methods.transfer(_to, _amount).encodeABI(),
      chainId
    }

    let tx = new Tx(rawTransaction)
    tx.sign(privKey)

    let serializedTx = tx.serialize()

    // let receipt = await web3.eth.sendSignedTransaction('0x'+
    //   serializedTx.toString('hex'), cb)

    // return resolve(receipt)

    web3.eth.sendSignedTransaction('0x'+serializedTx.toString('hex'), cb)
      .then(resolve)
      .catch(reject)
  })
}


module.exports = sendTokens



