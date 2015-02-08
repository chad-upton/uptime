/**
 * Module dependencies.
 */

var Check         = require('../../../models/check');
var Tag           = require('../../../models/tag');
var TagHourlyStat = require('../../../models/tagHourlyStat');
var CheckEvent    = require('../../../models/checkEvent');
var async         = require('async');

/**
 * Check Routes
 */
module.exports = function(app) {
  var isUser = function(req,res,next){
    if(req.session.user) {
      //@TODO Validate logged in user against database
      req.user = req.session.user;
      app.locals.user = req.session.user;
      next();
    } else {
      res.status(403)     // HTTP status 404: NotFound
        .send('Forbidden');
    }
    //next();
  };
  app.get('/tags', isUser, function(req, res) {
    Tag
    .find()
    .sort({ name: 1 })
    .exec(function(err, tags) {
      if (err) return next(err);
      res.json(tags);
    });
  });

  // tag search for autocomplete
  app.get('/tags/search',isUser, function(req, res) {
    Tag
      .aggregate({ $match :   { name : { $regex: req.query.term, $options: 'i' } } },
      { $project : {_id : 0,
        label : '$name',
        value : '$name'}},
      { $sort :    { label : 1 }},
      function(err, tags) {
        if (err) return next(err);
        res.json(tags);
      });
  });

  // tag route middleware
  var loadTag = function(req, res, next) {
    Tag.findOne({ name: req.params.name }, function(err, tag) {
      if (err) return next(err);
      if (!tag) return res.json(404, { error: 'failed to load tag ' + req.params.name });
      req.tag = tag;
      next();
    });
  };
  
  app.get('/tags/:name',isUser , loadTag, function(req, res, next) {
    res.json(req.tag);
  });

  app.get('/tags/:name/checks/:period/:timestamp', isUser,  loadTag, function(req, res, next) {
    req.tag.getChecksForPeriod(req.params.period, new Date(parseInt(req.params.timestamp)), function(err, checks) {
      if (err) return next(err);
      res.json(checks);
    })
  });

  app.get('/tags/:name/stat/:period/:timestamp', isUser, loadTag, function(req, res, next) {
    req.tag.getSingleStatsForPeriod(req.params.period, new Date(parseInt(req.params.timestamp)), function(err, stat) {
      if(err) return next(err);
      res.json(stat);
    });
  });

  app.get('/tags/:name/stats/:type', isUser, loadTag, function(req, res, next) {
    req.tag.getStatsForPeriod(req.params.type, req.query.begin, req.query.end, function(err, stats) {
      if(err) return next(err);
      res.json(stats);
    });
  });

  app.get('/tags/:name/events',isUser,  function(req, res) {
    var query = {
      tags: req.params.name,
      timestamp: { $gte: req.query.begin || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    };
    if (req.query.end) {
      query.timestamp.$lte = req.query.end;
    }
    CheckEvent
    .find(query)
    .sort({ timestamp: -1 })
    .select({ tags: 0 })
    .limit(100)
    .exec(function(err, events) {
      if (err) return next(err);
      CheckEvent.aggregateEventsByDay(events, function(err, aggregatedEvents) {
        res.json(aggregatedEvents);
      });
    });
  });

  app.delete('/tags/:name', loadTag, function(req, res, next) {
    // Delete tag relation first in order to avoid magic respawn
    Check.collection.update({ tags: req.tag.name }, { $pull: { tags: req.tag.name } }, { multi: true }, function(err) {
      if (err) return next(err);
      // Then, remove the tag
      req.tag.remove(function(err2) {
        if (err2) return next(err2);
        res.end();
      });
    })
  });

};
