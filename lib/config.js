'use strict';

var path = require('path');
var _ = require('lodash');

/**
 * Tries to require the waterlock config
 *
 * @return {object} waterlock config file
 */
module.exports = function() {
	var config;
	try {
		var configPath = path.normalize(__dirname + '/../../../config/waterlock.js');
		config = require(configPath)
			.waterlock;
		//Merge the sails config in.
		if (typeof sails !== 'undefined') {
			if (typeof sails.config !== 'undefined' && typeof sails.config.waterlock !== 'undefined') {
				var sailsConfig = sails.config.waterlock;
				config = _.merge(config, sailsConfig, function(a, b) {
					if (_.isArray(a)) {
						return a.concat(b);
					}
				});
			}
		}
	} catch (e) {
		var error = new Error('No config file defined, try running [waterlock generate config]\n\n' + e);
		throw error;
	}

	return config;
};
