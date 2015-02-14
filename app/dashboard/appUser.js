/**
 * Created by sander on 2/8/15.
 */
var express = require('express');
var async = require('async');
var partials = require('express-partials');
var flash = require('connect-flash');
var moment = require('moment');
var crypto = require('crypto');

var Check = require('../../models/check');
var Tag = require('../../models/tag');
var TagDailyStat = require('../../models/tagDailyStat');
var TagMonthlyStat = require('../../models/tagMonthlyStat');
var CheckMonthlyStat = require('../../models/checkMonthlyStat');
var moduleInfo = require('../../package.json');
var Account = require('../../models/user/accountManager');
var Session = require('../../models/user/sessionManager');

module.exports = function(app) {
  app.get('/login', function (req, res) {
    res.render('user/login',{errors: []});
  });

  app.get('/signout', function (req, res) {
    if(req.session.sessionHash) {
      Session.getSessionById(req.session.sessionHash._id, function (session) {
        if (session) {
          Session.endSession(session);
        }
        req.session.sessionHash = {};
        delete req.session.sessionHash;
        app.locals.sessionHash = false;
        app.locals.user = {};
        req.session = null;
        res.clearCookie('sessionHash');
        res.redirect('/dashboard/login');
      });
    } else {
      res.redirect('/dashboard/login');
    }
  });

  //userMiddleware
  var isAuthed = function(req,res,next){
    Account.isUserAuthed(req,function(user){
      req.user = user;
      app.locals.user = user;
      next();
    },function(){
      app.locals.user = false;
      res.redirect('/dashboard/signout');
    });
  };

  app.post('/login', function (req, res) {
    var user = req.param('user');
    var pass = req.param('pass');
    Account.findOne({user:user}, function(e, o) {
      if (o == null){
        res.render('user/login',{ errors: ['User not found'] } );
      }	else{
        Account.validatePassword(pass, o.pass, function(err, r) {
          if (r){
            var userAgent = req.headers['user-agent'];
            var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            Session.startSession(o, ip,userAgent,function(session){
                delete session.userAgent;
                delete session.lastAction;
                delete session.date;
                req.session.sessionHash = session[0];
                res.cookie('sessionHash', session[0], { maxAge:  24 * 60 * 60 * 1000 });
                if (req.param('remember-me') == 'on'){
                  req.session.cookie.expires = false;
                  res.cookie('sessionHash', session, { maxAge:  365 * 24 * 60 * 60 * 1000 });
                }
                res.redirect('/dashboard/events');
            });
           /* req.session.user = o;*/
          }	else{

            res.render('user/login',{ errors: ['Invalid password'] } );
          }
        });
      }
    });
  });

  app.get('/signup', function (req, res) {
    res.render('user/signup',{errors: []});
  });

  app.post('/signup', function (req, res) {
    var newUser = new Account();
    var errors = [];
    var apiKey = [{
      name: 'General api key',
      description: 'For quick use',
      apiKey: crypto.randomBytes(32).toString('hex'),
      created: new Date(),
      lastAccessed: 0
    }];
    newUser.name = req.param('name');
    newUser.email = req.param('email');
    newUser.pass = req.param('pass');
    newUser.apiKeys = apiKey;
    newUser.user = req.param('user');
    newUser.notificationSettings = {
      email: {
        value: "",
        isDefault: false
      },
      pushbullet: {
        apikey: "",
        isDefault: false
      },
      statushub:{
        subdomains: "",
        apikey: "",
        isDefault: false
      }
    };
    if(newUser.name===''){
      errors.push('Fill in a username');
    }
    if(newUser.pass===''){
      errors.push('Fill in a password');
    }
    if(newUser.email===''){
      errors.push('Fill in a email address');
    }
    if(newUser.name===''){
      errors.push('Fill in a name');
    }
    if(newUser.pass !== req.param('passr')){
      errors.push('Passwords do not match');
    }
    Account.findOne({user: newUser.user}, function (e, o) {
      if (o) {
        res.render('user/signup',{errors: ['Sorry this username is taken']});
      } else {
        Account.findOne({email: newUser.email}, function (e, o) {
          if (o) {
            res.render('user/signup',{errors: ['Sorry this email address is already in use.']});
          } else {
            Account.saltAndHash(newUser.pass, function (hash) {
              newUser.pass = hash;
              // append date stamp when record was created //
              newUser.date = moment().format('MMMM Do YYYY, h:mm:ss a');
              newUser.save(function () {
                var userAgent = req.headers['user-agent'];
                var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                Session.startSession(newUser, ip,userAgent,function(session){
                  delete session.userAgent;
                  delete session.lastAction;
                  delete session.date;
                  req.session.sessionHash = session[0];
                  res.cookie('sessionHash', session[0], { maxAge:  24 * 60 * 60 * 1000 });
                  res.redirect('/dashboard/events');
                });
              });
            });
          }
        });
      }
    });
  });

  app.get('/settings', isAuthed, function (req, res) {
    Account.findOne({user: req.user.user}, function(e, o){
      Session.getSessionsFromUser(o,function(sessions){
        if(o) {
          res.render('user/settings', {errors: [], user: o, sessions: sessions,curSession: req.session.sessionHash});
        } else {
          res.redirect('/dashboard/login');
        }
      });
    })
  });

  app.post('/settings', isAuthed, function (req, res) {
    Account.findOne({user: req.user.user}, function(e, o) {
      var notificationSettings = req.param('notifications');
      var settings = req.param('settings');
      settings = settings || {};
      var newData = {};
      var errors = [];
      if (settings.newpw !== settings.newpwr) {
        errors.push('Passwords do not match');
      }
      if(settings.newpw && !settings.oldpw){
        errors.push('Please enter your old password');
      }

      if (errors.length === 0) {
        newData.name 		= settings.name;
        newData.email 	= settings.email;
        notificationSettings.email = notificationSettings.email || { value: ""};
        newData.notificationSettings = notificationSettings;
        if (settings.newpw==="" && settings.newpwr==="") {
          Account.update({_id: o.id}, newData, {upsert: false}, function (err, r) {

          });
        } else {
          Account.saltAndHash(settings.newpw, function (hash) {
            newData.pass = hash;
            Account.update({_id: o.id}, newData, {upsert: false}, function (err, r) {
            });
          });
        }
      }
      res.redirect('/dashboard/settings');
    });
  });

  app.delete('/settings/endsession/:sessionId', function (req, res) {
    var result = {'test': 'hi'};
    Session.getSessionById(req.params.sessionId,function(session){
      if(session) {
        Session.endSession(session);
        result = 'success'
      } else {
        result = {'error': 'session not found'}
      }
    });
    res.json(result)
  });

  app.post('/settings/apikey', isAuthed, function (req, res) {
    var name = req.param('name');
    Account.createApiKey(name, req.user, function(user,newKey){
      console.log('result')
      res.json({
        user: user,
        newKey: newKey
      });
    });
  });

  app.delete('/settings/apikey/:hash', isAuthed, function (req, res) {
    var name = req.param('name');

    Account.deleteApiKey(req.params.hash, req.user, function(e,r){
      res.json({e: e,r:r});
    });
  });
}