'use strict';

/**
 * User
 *
 * @module      :: Model
 * @description :: This is the base user model
 * @docs        :: http://waterlock.ninja/documentation
 */
var _ = require('lodash');

module.exports = {

  attributes: require('waterlock').models.user.attributes({

    /* e.g.
    nickname: 'string'
    */

  }),
  
  findAuthOfType: function(provider){
    return _.find(this.auths, function(o){
      return o.provider === provider;
    });
  },

  beforeCreate: require('waterlock').models.user.beforeCreate,
  beforeUpdate: require('waterlock').models.user.beforeUpdate
};
