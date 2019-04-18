// this app is meant to demonstrate how to use the /functions/send-tokens.js

const config = require("./config")
let express = require("express"),
path = require('path'),
bodyParser = require('body-parser')

let app = express()

// Set up the static server for files in public folder
app.use(express.static(path.join(__dirname, 'public')))

// BodyParser Middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

app.listen(3000)
console.log("server running at port 3000")


/** 
this is an in-memory user database meant for the demonstration 
purpose only, please implement your user database according to 
your convenience 
*/
let db = require('./utils/db')

let sendTokens = require('./functions/send-tokens')
let getTxReceipt = require('./functions/get-tx-receipt')

// require web3 library for checking if the given ethereum address
// for converting points to tokens is valid
let web3 = require('web3')

// require Big Number library for precise calculation as there might be 
// floating point errors in JS's default way for arithmetic because 
// the numbers we work with are quite big and Important 
// (like number of tokens etc)
let BN = require('bignumber.js')


app.post('/signup', async (req, res) => {
  // please implement your own sign up feature, this one is for demonstration
  // only and does not actually 'sign up' and does not authenticate
  let { username } = req.body
  let user; 
  try {
    user = await db.createUser({username})
  } catch (e) {
    return res.sendStatus(500)
  }
  return res.redirect(`index.html?username=${username}`)
  // res.send({user})
})

isAddress = function (address) {
    if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
        // check if it has the basic requirements of an address
        return false;
    } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
        // If it's all small caps or all all caps, return true
        return true;
    } else {
        // Otherwise check each case
        return isChecksumAddress(address);
    }
}

isChecksumAddress = function (address) {
    // Check each case
    address = address.replace('0x','');
    var addressHash = web3.utils.sha3(address.toLowerCase());

    for (var i = 0; i < 40; i++ ) {
        // the nth letter should be uppercase if the nth digit of casemap is 1
        if ((parseInt(addressHash[i], 16) > 7 && address[i].toUpperCase() !== address[i]) || (parseInt(addressHash[i], 16) <= 7 &&
address[i].toLowerCase() !== address[i])) {
            return false;
        }
    }
    return true;
}

app.post('/change_points_to_tokens', (req, res) => {
  let { address, username } = req.body
  
  // we want to send the response to the request only once
  // so this can be helpful in knowing if the response was
  // already sent so as to decide whether or not to send the
  // response this time
  let responseSent = false
  
  
  // find the user from the DB
  let user = db.getUserByUsername(username)
  
  // console.log({user, username, address})

    
  // the number of points the user owns which will be converted to tokens
  let points = user.points

  // if there is no such user
  
  // or if the user's points are on hold (because the user has already
  // sent a request to convert points to tokens and it is currently pending)

  // or if the number of points to convert to tokens is 
  // less than or equal to 0
  if (!user || user.pointsOnHold || points <= 0)
    // it was a bad request, no need to proceed
    return res.sendStatus(400)

  // if the address provided to send the tokens is invalid
  if (!web3.utils.isAddress(address))
//  if (!isAddress(address))
//     it was a bad request, no need to proceed
    return res.sendStatus(400)


  /** 
  Here is something interesting.
  the number `points` is converted to a BigNumber instance, that's fine
  but why is it multiplied by 1e18 ? or why is it multiplied by 10^18 ?

  this is because in Ethereum we don't work with floating points at all
  to avoid the floating point errors,

  we represent the number of tokens as integer, represented in the 
  lowest possible unit, for example, if we were using USD we would 
  represent it as cents, so 100 cents would mean 1 USD, this shows that 
  USD has 2 decimal digits 0.01 USD = 1 cents is the smallest possible 
  unit, there can not be any less

  similarly, this ERC20 Token has *18 decimal digits*! and here we are working
  with the lowest possible unit of the token, so the number `1` lowest 
  possible unit of the token would mean 0.000000000000000001 Tokens!

  so to send 1 token, we have to send 1000000000000000000 lowest possible 
  units of the tokens, that's why we need to multiply the amount by 1e18

  If you did not understand, please don't worry at all! you don't have to 
  understand the above comment at all! just know that while sending out
  this particular ERC20 Token, you will need to multiply the amount by 
  1e18 or 10^18 or 1000000000000000000 or 1 followed by 18 zeros!
  */
  amount = new BN(points).times(1e18)

  // PS: you might want to change `points` to some expression of your own
  // according to your conditions as to how you want to convert the points
  // to tokens, for now here we converted the points to tokens at the ratio
  // 1:1, 1 token for 1 point, feel free to change it according to your
  // conditions!
  

  /** 
  Now, since the user has requested to convert his points to tokens
  we can not let them request the same again till the first request 
  is fulfilled, so we put the points of the user 'on hold', 

  it simply means set a boolean value for checking if the user has already
  requested the conversion and the conversion is not done yet... 
  you can see on line 82 the related check is done using this 
  'on hold' thing to decide whether or not to continue executing this function ;)
  */
  db.putUserPointsOnHold(username)

  /** 
  We also keep a number to see how many points are converted to tokens
  so that later after the tokens are successfully sent to the user, we can
  deduct the number of points converted to tokens from the user's 
  current number of points
  */
  db.setNoOfUserPointsOnHold(username, points)


  /** 
  As the name suggests, this is a callback function which is called
  with an error, or the transaction hash of the transaction where we sent
  the tokens to the user
  */
  let callback = (err, txHash) => {
    // if there is any error
    if (err) {
      // set the user's 'on hold' or `pointsOnHold` to false
      // so that the user can request the converstion of points to tokens
      // again if they want as there is no pending tx for them
      db.putUserPointsOnHold(username, false)

      // set the number of points on hold to zero as well as we don't need 
      // to deduct any points from the user's points because no points were 
      // converted to tokens
      db.setNoOfUserPointsOnHold(username, 0)

      // yes we sent the response, actually we are just gonna send it :p
      responseSent = true
      return res.sendStatus(500)
    }

    // there was no error, we have a transaction hash now, which is most 
    // probably in `pending` state, so we store the transaction hash in DB
    db.setUserLastTx(username, txHash)

    // we are just gonna send a response ;)
    responseSent = true
    return res.send(txHash)
  }
  
  // here is our `sendTokens` call, probably I provided you a detailed
  // 'README' about this function!
  sendTokens(
    config.CXC_contract_address, // token contract address
    config.private_key, // private key of the account to send from
    address, // ethereum address of the account to send to
    amount, // number of tokens to send out
    {
      gasPriceGwei: config.gas_price_gwei,
      gasLimit: config.gas_limit,
      chainId: config.chain_id
    },

    callback
  )
  .then(receipt => {
    // console.log(receipt)
    // we have a transaction receipt, means the tx (or transaction) 
    // was confirmed
    if (receipt.status === true && user.lastEthTx) {
      // the transaction succeeded!

      // deduct the number of points converted to tokens
      // from the number of points they have
      db.deductUserPoints(username)

      // set the user's number of points which is on hold to zero
      db.setNoOfUserPointsOnHold(username, 0)
      
      // set the user's boolean property `pointsOnHold` to false
      db.putUserPointsOnHold(username, false)

      // set the user's lastTx property, or the `user's pending tx hash` 
      // to null
      db.setUserLastTx(username, null) 
    }

    // if response is not sent yet, respond to the request please...
    !responseSent && res.send(receipt)
  })
  .catch(err => {
    // oops, there was some error while sending out tokens!

    // set the user's boolean property `pointsOnHold` to false
    db.putUserPointsOnHold(username, false)

    // set the user's number of points which is on hold to zero
    db.setNoOfUserPointsOnHold(username, 0)

    // let's respond to the request is not already done...
    !responseSent && res.sendStatus(500)
  })
})


// this route returns all the user required for frontend
app.get('/get_user_info/:username', (req, res) => {
  return res.send(db.getUserByUsername(req.params.username))
})

// this route is used for adding points to the user
// remember that this is for demonstration purpose only and
// that you are totally free to design your own way
// about how the points are added to the user account!
app.post('/add_user_points', (req, res) => {
  let { username, additional_points } = req.body
  console.log("addUserPoints(), line 246 in app.js")
  db.addUserPoints(username, additional_points)

  return res.sendStatus(200)
})


/** 
This route is for refreshing the user's parameters related to points


if in any case the transaction gets confirmed on the blockchain
but it is not updated on the server, 

meaning if in any case the
`sendTokens().then()` is *not* called upon success 

(which is a highly unlikely possibility and may happen probably 
only because of some network problem or server crashing etc), 

- this route will be useful in setting the user's state right.

*/
app.get('/refresh_user_txn/:username', async (req, res) => {
  let { username } = req.params
  let user = db.getUserByUsername(username)

  // if the user is not present or the user's current transaction
  // or `lastEthTx` or the `current pending transaction` (or whatever you
  // may call it) is not there, there is no need to proceed further

  if (!user||!user.lastEthTx) return res.sendStatus(200)

  // the `getTxReceipt` takes in a transaction hash as a parameter
  // and returns a promise which resolves with the
  // transaction receipt when available
  // transaction receipt is not available for pending transactions

  // basically, we can check the `receipt.status` to see if the transaction
  // failed or if it succeeded, when status is true the tx was successful,
  // otherwise it failed
  let receipt = await getTxReceipt(user.lastEthTx)

  // if receipt is not available, no need to proceed!
  if (!receipt) return res.sendStatus(200)
  
  // if the tx was successful
  if (receipt.status === true) {
    // tx succeeded

    // deduct the number of points converted to tokens
    // from the number of points they have
    db.deductUserPoints(username)

    // set the user's number of points which is on hold to zero
    db.setNoOfUserPointsOnHold(username, 0)

    // set the user's boolean property `pointsOnHold` to false
    db.putUserPointsOnHold(username, false)

    // set the user's lastTx property, or the `user's pending tx hash` 
    // to null
    db.setUserLastTx(username, null) 

  } else {
    // tx failed

    // set the user's number of points which is on hold to zero
    db.setNoOfUserPointsOnHold(username, 0)

    // set the user's boolean property `pointsOnHold` to false
    db.putUserPointsOnHold(username, false)
    
  }

  // respond to the request and exit this function
  return res.sendStatus(200)
  
})
