/**
 * Module dependencies.
 */

var util = require('util');
var url  = require('url');
var BasePoller = require('../basePoller');
var phantom = require('node-phantom');
var config = require('config');

/**
 * Phantom Poller, to perform Phantom analysis on web pages
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function PhantomPoller(target, timeout, callback) {
this.debug('PhantomPoller');
  PhantomPoller.super_.call(this, target, timeout, callback);
  
}

util.inherits(PhantomPoller, BasePoller);

PhantomPoller.type = 'phantom';
PhantomPoller.prototype.setDebug(true);

PhantomPoller.validateTarget = function(target) {
  return url.parse(target).protocol == 'http:';
};

PhantomPoller.prototype.initialize = function() {
  this.timeout = 999999; // We can't know a test duration
  this.debug('PhantomPoller: initialize');
  //this.wpt = new Phantom(config.Phantom.server || 'www.phantom.org', config.Phantom.key);//no phatom.org makes no sense but hey right now it's just find and replace
};

/**
 * Launch the actual polling
 *
 * @api   public
 */
PhantomPoller.prototype.poll = function() {
  PhantomPoller.super_.prototype.poll.call(this);
  this.debug('Phantom start test [target='+this.target+']');
  //this.wpt.runTest(this.target, config.Phantom.testOptions | {}, this.onTestStartedCallback.bind(this));
  
  	var page = {};
  	console.log(phantom);
  	var _target = this.target;
  	phantom.create(function (err,ph) {
  		console.log('phantom.create');
  		console.log(this);
  		//console.log(ph);
  		try{
		ph.createPage(function(err,_page) {
			console.log("Page created!")
			var page = _page
			
			
page.address = _target;
  page.resources = [];

  page.onLoadStarted = function () {
	  page.startTime = new Date();
  };

  page.onResourceRequested = function (req) {
	  page.resources[req.id] = {
		  request: req,
		  startReply: null,
		  endReply: null
	  };
  };

  page.onResourceReceived = function (res) {
	  if (res.stage === 'start') {
		  page.resources[res.id].startReply = res;
	  }
	  if (res.stage === 'end') {
		  page.resources[res.id].endReply = res;
	  }
  };
  console.log('Page address:'+page.address);
  page.open(page.address, function (err,status) {
	  var har;
	  console.log('opening');
	  if (status !== 'success') {
		  console.log('FAIL to load the address:'+page.address);
		  //phantom.exit(1);
	  } else {
		  page.endTime = new Date();
		  page.title = page.evaluate(function () {
			  return document.title;
		  });
		  har = createHAR(page.address, page.title, page.startTime, page.resources,page);
		  //console.log(JSON.stringify(har, undefined, 4));
		  //phantom.exit();
		  this.handleOkResponse(har);
	  }
	}.bind(this));

			
			
		}.bind(this))
		}catch(ex){
			console.log(ex);
		}
  	}.bind(this));
  	
 
  
  
};
PhantomPoller.prototype.handleOkResponse = function(res) {
  var poller = this;
  var body = '';
  //this.debug(this.getTime() + "ms - Status code 200 OK");
  /*
  res.on('data', function(chunk) {
    body += chunk.toString();
    poller.debug(poller.getTime() + 'ms - BODY: ' + chunk.toString().substring(0, 100) + '...');
  });
  res.on('end', function() {
    res.body = body;*/
    poller.timer.stop();
    poller.debug(poller.getTime() + "ms - Request Finished");
    poller.callback(undefined, poller.getTime(), res);
  //});
};
/**
 * Test started callback
 *
 * @api   private
 */
PhantomPoller.prototype.onTestStartedCallback = function(err,data){
  if (err) {
    this.debug(err);
    this.timer.stop();
  } else {
    if (data.statusCode && data.statusCode == 200) {
      this.testId = data.data.testId;
      if (data.data.userUrl) {
        this.userUrl = data.data.userUrl;
      }
      this.debug('Phantom test started [testId='+this.testId+']');
      this.checkTestStatus();
    } else {
      return this.onErrorCallback({ name: "Test not started", message: data.statusText});
    }
  }
};

/**
 * TestStatus callback
 *
 * @api   private
 */
PhantomPoller.prototype.checkTestStatus = function(){
  var self = this;
  this.wpt.getTestStatus(this.testId, function(err, data) {
    if (err) {
      self.debug('Phantom checkTestStatus error');
      self.timer.stop();
      return;
    }
    if (data && data.statusCode == 200) {
      self.wpt.getTestResults(self.testId, function(err, data) {
        var docTime = parseInt(data.response.data.average.firstView.docTime, 10);
        self.debug('PhantomResults received [docTime=' + docTime + ']');
        self.timer.stop();
        if (self.userUrl) {
          self.callback(null, docTime, {}, { url: self.userUrl });
        } else {
          self.callback(null, docTime, {});
        }
      });
    } else {
      self.testStatusTimeout = setTimeout(self.checkTestStatus.bind(self), 5000);
    }
  });
};

/**
 * Timeout callback
 *
 * @api   private
 */
PhantomPoller.prototype.timeoutReached = function() {
  this.debug('PhantomPoller timeoutReached call');
  PhantomPoller.super_.prototype.timeoutReached.call(this);
  var self = this;
  if (typeof this.timeout !== undefined) {
    this.wpt.cancelTest(this.testId, function(err,data) {
      self.debug('Phantom test started [testId=' + self.testId + ']');
    });
  }
};
/* Utilities */
if (!Date.prototype.toISOString) {
    Date.prototype.toISOString = function () {
        function pad(n) { return n < 10 ? '0' + n : n; }
        function ms(n) { return n < 10 ? '00'+ n : n < 100 ? '0' + n : n }
        return this.getFullYear() + '-' +
            pad(this.getMonth() + 1) + '-' +
            pad(this.getDate()) + 'T' +
            pad(this.getHours()) + ':' +
            pad(this.getMinutes()) + ':' +
            pad(this.getSeconds()) + '.' +
            ms(this.getMilliseconds()) + 'Z';
    }
}

function createHAR(address, title, startTime, resources,page)
{
    var entries = [];

    resources.forEach(function (resource) {
        var request = resource.request,
            startReply = resource.startReply,
            endReply = resource.endReply;

        if (!request || !startReply || !endReply) {
            return;
        }

        // Exclude Data URI from HAR file because
        // they aren't included in specification
        if (request.url.match(/(^data:image\/.*)/i)) {
            return;
	}

        entries.push({
            //startedDateTime: request.time.toISOString(),
            startedDateTime: Date.prototype.toISOString.apply(new Date (request.time)),
            time: endReply.time - request.time,
            request: {
                method: request.method,
                url: request.url,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: request.headers,
                queryString: [],
                headersSize: -1,
                bodySize: -1
            },
            response: {
                status: endReply.status,
                statusText: endReply.statusText,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: endReply.headers,
                redirectURL: "",
                headersSize: -1,
                bodySize: startReply.bodySize,
                content: {
                    size: startReply.bodySize,
                    mimeType: endReply.contentType
                }
            },
            cache: {},
            timings: {
                blocked: 0,
                dns: -1,
                connect: -1,
                send: 0,
                wait: startReply.time - request.time,
                receive: endReply.time - startReply.time,
                ssl: -1
            },
            pageref: address
        });
    });

    return {
        log: {
            version: '1.2',
            creator: {
                name: "PhantomJS",
                version: 'node-phantom' //phantom.version.major + '.' + phantom.version.minor + '.' + phantom.version.patch
            },
            pages: [{
                //startedDateTime: startTime.toISOString(),
                startedDateTime: Date.prototype.toISOString.apply(new Date (startTime)),
                id: address,
                title: title,
                pageTimings: {
                    onLoad: page.endTime - page.startTime
                }
            }],
            entries: entries
        }
    };
}

module.exports = PhantomPoller;
