'use strict';

const { Contract } = require('fabric-contract-api');
const ConsentContract = require('./lib/consentContract');

module.exports.ConsentContract = ConsentContract;
module.exports.contracts = [ConsentContract];
