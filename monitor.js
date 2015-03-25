if (!process.env.NODE_ENV && process.argv.length == 3) {
	var _env = process.argv[2];
	if(process.argv[2].length){
	    process.env.NODE_ENV = _env;
	}
}

var fs      = require('fs');
var config  = require('config');
var Monitor = require('./lib/monitor');

// start the monitor
config.monitor.selfSigned = config.ssl && config.ssl.selfSigned ? true : false;
monitor = Monitor.createMonitor(config.monitor);

// load plugins
config.plugins.forEach(function(pluginName) {
  var plugin = require(pluginName);
  if (typeof plugin.initMonitor !== 'function') return;
  console.log('loading plugin %s on monitor', pluginName);
  plugin.initMonitor({
    monitor: monitor,
    config:  config
  });
});

monitor.start();

module.exports = monitor;
