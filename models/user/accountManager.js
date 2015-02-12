var crypto 		= require('crypto');
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var moment 		= require('moment');
var Session = require('./sessionManager');
var assert = require('assert');

// main model
var Account = new Schema({
  name        : String,
  email        : String,
  user         : String,
  pass         : String,
  date         : String,
  notificationSettings: Object,
  apiKeys: Array
});
Account.plugin(require('mongoose-lifecycle'));

Account.statics.userExist = function(user, callback) {
  return this.db.model('Account').findOne({user: user.user}, callback);
};

Account.statics.isUserAuthed =  function(req,loggedInCallback,errorCallback){
  if(req.query.apikey) {
    /**
     * Check for an api key:
     *
     */
    this.db.model('Account').find({apiKeys:{ $elemMatch: {apiKey: req.query.apikey } } },function(e,r){

      if(r === null){
        errorCallback(req);
      } else {
        loggedInCallback(r);
      }
    });
  } else {
    if(req.session.sessionHash) {
      var searchFor = req.session.sessionHash;
      delete searchFor.user;
      Session.getSessionFromUser(searchFor,function (storedSession) {
        if(storedSession !== null && storedSession.user){
          var now = new Date();
          Session.setLastAccessed(storedSession,now);
          loggedInCallback(storedSession.user);
        } else {
          errorCallback(req);
        }
      });
    } else {
      /** @TODO check sessionhash cookie */
      errorCallback(req);
      return;
    }
  }
};
/* login validation methods */
/*
Account.methods.autoLogin = function(user, pass, callback)
{
  Account.findOne({user:user}, function(e, o) {
    if (o){
      o.pass == pass ? callback(o) : callback(null);
    }	else{
      callback(null);
    }
  });
}

Account.methods.manualLogin = function(user, pass, callback)
{  Account.findOne({user:user}, function(e, o) {
    if (o == null){
      callback('user-not-found');
    }	else{
      validatePassword(pass, o.pass, function(err, res) {
        if (res){
          callback(null, o);
        }	else{
          callback('invalid-password');
        }
      });
    }
  });
}

/* record insertion, update & deletion methods
Account.methods.addNewAccount = function(newData, callback)
{
  /*Account.findOne({user:newData.user}, function(e, o) {
    if (o){
      callback('username-taken');
    }	else{
      Account.findOne({email:newData.email}, function(e, o) {
        if (o){
          callback('email-taken');
        }	else{
          saltAndHash(newData.pass, function(hash){
            newData.pass = hash;
            // append date stamp when record was created //
            newData.date = moment().format('MMMM Do YYYY, h:mm:ss a');
            Account.insert(newData, {safe: true}, callback);
          });
        }
      });
    }
  });
  console.log(newData);
  Account.findOne({user: newData.user},function(e,o){
    console.log(e,o)
  })
  console.log(Account);
}

Account.methods.updateAccount = function(newData, callback)
{
  Account.findOne({user:newData.user}, function(e, o){
    o.name 		= newData.name;
    o.email 	= newData.email;
    o.country 	= newData.country;
    if (newData.pass == ''){
      Account.save(o, {safe: true}, function(err) {
        if (err) callback(err);
        else callback(null, o);
      });
    }	else{
      saltAndHash(newData.pass, function(hash){
        o.pass = hash;
        Account.save(o, {safe: true}, function(err) {
          if (err) callback(err);
          else callback(null, o);
        });
      });
    }
  });
}

Account.methods.updatePassword = function(email, newPass, callback)
{
  Account.findOne({email:email}, function(e, o){
    if (e){
      callback(e, null);
    }	else{
      saltAndHash(newPass, function(hash){
        o.pass = hash;
        Account.save(o, {safe: true}, callback);
      });
    }
  });
}

/* account lookup methods

Account.methods.deleteAccount = function(id, callback)
{
  Account.remove({_id: getObjectId(id)}, callback);
}

Account.methods.getAccountByEmail = function(email, callback)
{
  Account.findOne({email:email}, function(e, o){ callback(o); });
}

Account.methods.validateResetLink = function(email, passHash, callback)
{
  Account.find({ $and: [{email:email, pass:passHash}] }, function(e, o){
    callback(o ? 'ok' : null);
  });
}

Account.methods.getAllRecords = function(callback)
{
  Account.find().toArray(
    function(e, res) {
      if (e) callback(e)
      else callback(null, res)
    });
};

Account.methods.delAllRecords = function(callback)
{
  Account.remove({}, callback); // reset accounts collection for testing //
}
*/
/* private encryption & validation methods */

var generateSalt = function()
{
  var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
  var salt = '';
  for (var i = 0; i < 10; i++) {
    var p = Math.floor(Math.random() * set.length);
    salt += set[p];
  }
  return salt;
}

var md5 = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

Account.statics.saltAndHash = function(pass, callback)
{
  var salt = generateSalt();
  callback(salt + md5(pass + salt));
}

Account.statics.validatePassword = function(plainPass, hashedPass, callback)
{
  var salt = hashedPass.substr(0, 10);
  var validHash = salt + md5(plainPass + salt);
  callback(null, hashedPass === validHash);
}

/* auxiliary methods */

var getObjectId = function(id)
{
  return Account.db.bson_serializer.ObjectID.createFromHexString(id)
}

var findById = function(id, callback)
{
  accounts.findOne({_id: getObjectId(id)},
    function(e, res) {
      if (e) callback(e)
      else callback(null, res)
    });
};


var findByMultipleFields = function(a, callback)
{
// this takes an array of name/val pairs to search against {fieldName : 'value'} //
  accounts.find( { $or : a } ).toArray(
    function(e, results) {
      if (e) callback(e)
      else callback(null, results)
    });
};

module.exports = mongoose.model('Account', Account);
