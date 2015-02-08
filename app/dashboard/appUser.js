/**
 * Created by sander on 2/8/15.
 */
var express = require('express');
var async = require('async');
var partials = require('express-partials');
var flash = require('connect-flash');
var moment = require('moment');

var Check = require('../../models/check');
var Tag = require('../../models/tag');
var TagDailyStat = require('../../models/tagDailyStat');
var TagMonthlyStat = require('../../models/tagMonthlyStat');
var CheckMonthlyStat = require('../../models/checkMonthlyStat');
var moduleInfo = require('../../package.json');
var Account = require('../../models/user/accountManager');

module.exports = function(app) {
  app.get('/login', function (req, res) {
    res.render('user/login',{errors: []});
  });

  app.get('/signout', function (req, res) {
    delete req.session.user;
    app.locals.user = false;
    res.redirect('/dashboard/login');
  });

  app.post('/login', function (req, res) {
    var user = req.param('user');
    var pass = req.param('pass');
    Account.findOne({user:user}, function(e, o) {
      if (o == null){
        res.render('user/login',{ errors: ['User not found'] } );
      }	else{
        Account.validatePassword(pass, o.pass, function(err, r) {
          if (r){
            req.session.user = o;
            if (req.param('remember-me') == 'true'){
              res.cookie('user', o.user, { maxAge: 900000 });
              res.cookie('pass', o.pass, { maxAge: 900000 });
            }
            res.redirect('/dashboard/checks');
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
    newUser.name = req.param('name');
    newUser.email = req.param('email');
    newUser.pass = req.param('pass');
    newUser.user = req.param('user');

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
              console.log(newUser)
              newUser.save(function () {
                req.session.user = newUser;
                res.redirect('/dashboard/checks');
              });
            });
          }
        });
      }
    });
  });
}