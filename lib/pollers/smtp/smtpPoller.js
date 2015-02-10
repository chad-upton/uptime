/**
 * Module dependencies.
 */

var util = require('util');
var url  = require('url');
var net = require('net');
var BaseHttpPoller = require('../http/baseHttpPoller');

// The http module lacks proxy support. Let's monkey-patch it.
require('../../proxy');
/**
 * SMTP Poller, to check smtp servers
 *
 * @param {Mixed} Poller Target host:port
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function SmtpPoller(target, timeout, callback) {
    SmtpPoller.super_.call(this, target, timeout, callback);
}

util.inherits(SmtpPoller, BaseHttpPoller);

SmtpPoller.type = 'smtp';

SmtpPoller.validateTarget = function(target) {
    return url.parse(target).protocol == 'smtp:';
};

/**
 * Launch the actual polling
 *
 * @api   public
 */
SmtpPoller.prototype.poll = function(secure) {
    SmtpPoller.super_.prototype.poll.call(this);
    var poller = this;
    try {
        var responseAmount = 0;
        var target = this.target;
        var res = {};
        var port = target.port || 25;
        var client = net.connect({
                port: port,
                host: target.hostname
            },
            function() { //'connect' listener
            });
        client.on('data', function(data) {
            responseAmount += 1;
            if (responseAmount === 2) {
                res.body = data;
                client.end();
            } else {
                client.write('HELO '+ target.hostname +'\r\n');
            }
        });
        client.on('end', function() {
            poller.timer.stop();
            poller.debug(poller.getTime() + "ms - Request Finished");
            poller.callback(undefined, poller.getTime(), res);
        });
        client.on('error', function(e) {
            poller.timer.stop();
            poller.onErrorCallback(e);
        });
    } catch(err) {
        err = err || 'Error connecting to STMP server';
        return poller.onErrorCallback(err);
    }
    //this.request.on('error', this.onErrorCallback.bind(this));
};

// see inherited function BaseHttpPoller.prototype.onResponseCallback
// see inherited function BaseHttpPoller.prototype.onErrorCallback


module.exports = SmtpPoller;