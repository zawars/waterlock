'use strict';

var _ = require('lodash');

/**
 * This engine is responsible for
 * finding, creating and updating auth objects
 *
 * @return {Object} engine functions
 */
module.exports = function() {
	var waterlock = this;

	return {

		/**
		 * Simple wrapper for Auth find/populate method
		 *
		 * @param  {Object}   criteria should be id to find the auth by
		 * @param  {Function} cb         function to be called when the auth has been
		 *                               found or an error has occurred
		 * @api public
		 */
		findAuth: function(criteria, cb) {
			var self = this;
			waterlock.Auth.findOne(criteria)
				.populate('user')
				.exec(function(err, auth) {
					cb(err, self._invertAuth(auth));
				});
		},

		/**
		 * This will create a user and auth object if one is not found
		 *
		 * @param  {Object}   criteria   should be id to find the auth by
		 * @param  {Object}   attributes auth attributes
		 * @param  {Function} cb         function to be called when the auth has been
		 *                               found or an error has occurred
		 * @api private
		 */
		_attachAuthToUser: function(auth, cb) {
			var self = this;

			// create the user
			if (!auth.user) {




				// this is where we want to figure out if the auth we have here can be attached to an existing user
				// scenario 1:

				// - user has authenticated local auth with 1@1.com and uname:
				// - the user now has:
				// - - 1 auth object with 1@1.com and uname
				// - - 1 user object with uname
				// - user authenticates with 1@1.com using facebook
				// - we need to create the auth object with facebook provider and attach them to the existing user associated with the other auth object of the same email address


				// scenario 2:
				// - user has authenticated local auth with 1@1.com and uname:
				// - the user now has:
				// - - 1 auth object with 1@1.com and uname
				// - - 1 user object with uname
				// - user authenticates with 1@1.com using spotify but with a completely different email address but they are logged in
				//   we can assume they are linking the auths


				// check to see if there is another auth we can merge with:

					waterlock.Auth.findOne({email: auth.email})
						.populate('user')
						.exec(function(err, found){
							if (err) {
								waterlock.logger.debug(err);
								return cb(err);
							}

							if (found && found.id !== auth.id) {
								// update the auth object
								waterlock.Auth.update(auth.id, {
										user: found.user.id
									})
									.exec(function(err, auth) {
										if (err) {
											waterlock.logger.debug(err);
											return cb(err);
										}
										found.user.auths.push(auth.shift());
										cb(err, found.user);
									});

							}else {
								waterlock.User.create({
										auths: [auth.id],
										username: auth.username,
										email: auth.email
									})
									.exec(function(err, user) {
										if (err) {
											waterlock.logger.debug(err);
											return cb(err);
										}

										// update the auth object
										waterlock.Auth.update(auth.id, {
												user: user.id
											})
											.exec(function(err, auth) {
												if (err) {
													waterlock.logger.debug(err);
													return cb(err);
												}
												if (!user.auths) {
													user.auths = [];
												}
												user.auths.push(auth.shift());
												cb(err, user);
											});
									});
							}
						});
			} else {
				// just fire off update to user object so we can get the
				// backwards association going.
				// if (!_.some(auth.user.auths, {
				// 		provider: auth.provider
				// 	})) {
				// 	waterlock.User.update(auth.user.id, {
				// 			auths: [{
				// 				id: auth.id
				// 			}]
				// 		})
				// 		.exec(function() {});
				// }

				cb(null, self._invertAuth(auth));
			}
		},

		/**
		 * Find or create the auth then pass the results to _attachAuthToUser
		 *
		 * @param  {Object}   criteria   should be id to find the auth by
		 * @param  {Object}   attributes auth attributes
		 * @param  {Function} cb         function to be called when the auth has been
		 *                               found or an error has occurred
		 *
		 * @api public
		 */
		findOrCreateAuth: function(criteria, attributes, cb) {
			var self = this;
			waterlock.Auth.findOrCreate(criteria, attributes)
				.exec(function(err, newAuth) {
					if (err) {
						waterlock.logger.debug(err);
						return cb(err);
					}

					waterlock.Auth.findOne(newAuth.id)
						.populate('user')
						.exec(function(err, auth) {
							if (err) {
								waterlock.logger.debug(err);
								return cb(err);
							}

							self._attachAuthToUser(auth, cb);
						});
				});
		},

		/**
		 * Attach given auth attributes to user
		 *
		 * @param  {Object}   attributes auth attributes
		 * @param  {Object}   user       user instance
		 * @param  {Function} cb         function to be called when the auth has been
		 *                               attached or an error has occurred
		 * @api public
		 */
		attachAuthToUser: function(attributes, user, cb) {
			var self = this;
			attributes.user = user.id;

			waterlock.User.findOne(user.id)
			.populate('auths')
				.exec(function(err, user) {
					if (err) {
						waterlock.logger.debug(err);
						return cb(err);
					}

					var foundAuth = _.find(user.auths, function(o){
			      return o.provider === attributes.provider;
			    });

					if (foundAuth) {

						delete(attributes.auth);
						//update existing auth
						waterlock.Auth.findOne(foundAuth.id)
							.exec(function(err, auth) {
								if (err) {
									waterlock.logger.debug(err);
									return cb(err);
								}

								// Check if any attribtues have changed if so update them
								if (self._updateAuth(auth, attributes)) {
									auth.save(function(err) {
										if (err) {
											waterlock.logger.debug(err);
											return cb(err);
										}
										user.auths.push(auth);
										cb(err, user);
									});
								} else {
									user.auths.push(auth);
									cb(err, user);
								}

							});
					} else {
						// force create by pass of user id
						//self.findOrCreateAuth(user.id, attributes, cb);
						self.findOrCreateAuth({user: user.id, provider: attributes['provider']}, attributes, cb);
					}
				});
		},

		/**
		 * Inverts the auth object so we don't need to run another query
		 *
		 * @param  {Object} auth Auth object
		 * @return {Object}      User object
		 * @api private
		 */
		_invertAuth: function(auth) {
			// nothing to invert
			if (!auth || !auth.user) {
				return auth;
			}

			var u = auth.user;
			delete(auth.user);
			u.auths = [auth];
			return u;
		},

		/**
		 * Decorates the auth object with values of the attributes object
		 * where the attributes differ from the auth
		 *
		 * @param  {Object} auth       waterline Auth instance
		 * @param  {Object} attributes used to update auth with
		 * @return {Boolean}           true if any values were updated
		 */
		_updateAuth: function(auth, attributes) {
			if (!_.isEqual(auth, attributes)) {
				_.merge(auth, attributes);
				return true;
			}
			return false;
		}
	};
};
