let db = {
  users: {}
}

/** 
The user object stores

username

points

pointsOnHold
- whether there is any pending tx related to the user converting their
  points to tokens. if there is a pending tx then the points must be 
  'on hold', or something like that, the intention is to prevent user from
  converting the same points to tokens twice, if there are points on hold,
  do not proceed with converting tokens to points if requested in a new 
  request, we hope you get the idea...

lastEthTx
- the transaction hash of the current transaction in which the points are
  being converted to tokens, this is useful in the `refresh` route, you can
  read more about it in app.js from lines 254 onwards or in the README!

noOfPointsOnHold 
- the number of points being converted to tokens in a pending tx
  if the tx is successful, this pointsOnHold is deducted from user's 
  `points`

txList 
- list of the transaction hashes of the transactions done by the user
*/

db.createUser = ({username}) => 
  new Promise((resolve, reject) => {
    let user = {
      username, 
      points: 0,
      pointsOnHold: false,
      lastEthTx: null,
      noOfPointsOnHold:0,
      txList:[]
    }
    
    db.users[username] = user

    return resolve(user)
  })

db.getUserByUsername = (username) => db.users[username]


db.putUserPointsOnHold = (username, onHold=true) =>
  db.getUserByUsername(username).pointsOnHold = onHold

db.setNoOfUserPointsOnHold = (username, n) => 
  db.getUserByUsername(username).noOfPointsOnHold = n 


db.setUserLastTx = (username, txHash) => {
  let user = db.getUserByUsername(username)
  user.lastEthTx = txHash
  txHash && user.txList.push(txHash)
}

db.addUserPoints = (username, additionalPoints) => {

  console.log(`addUserPoints(${username}, ${additionalPoints})`)
  let user = db.getUserByUsername(username)
  if (isNaN(1*additionalPoints)) return;
  
  user.points = user.points + Number(additionalPoints)
}
  

db.deductUserPoints = (username) => {
  let user = db.getUserByUsername(username)
  user.points = user.points - user.noOfPointsOnHold
}

 
module.exports = db
