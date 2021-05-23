/*

  BB strategy - okibcn 2018-01-03

 */
// helpers
var _ = require('lodash');
var log = require('../core/log.js');

var BB = require('./indicators/BB.js');
var rsi = require('./indicators/RSI.js');
const TALIBASYNC = require('./indicators/TalibAsync.js');

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function () {
  this.name = 'BWise2';
  this.nsamples = 0;
  this.trend = {
    zone: 'none',  // none, top, high, low, bottom
    duration: 0,
    persisted: false
  };

  this.requiredHistory = this.tradingAdvisor.historySize;
  this.RSIhistory = [];

  // define the indicators we need
  this.addIndicator('bb', 'BB', this.settings.bbands);
  this.addIndicator('rsi', 'RSI', this.settings);
  this.addTalibIndicator('tastochrsi', 'stochrsi', this.settings.stochRsiSettings)
  this.addTulipIndicator('tustoch', 'stoch', this.settings.tuStochSettings)
  this.addIndicator('stoploss', 'StopLoss', this.settings.stoploss)
  this.prevAdvice = 'short'
}

// for debugging purposes log the last
// calculated parameters.
method.log = function (candle) {
  var digits = 8;
  var BB = this.indicators.bb;
  //BB.lower; BB.upper; BB.middle are your line values 

  log.debug('______________________________________');
  log.debug('calculated BB properties for candle ', this.nsamples);

  if (BB.upper > candle.close) log.debug('\t', 'Upper BB:', BB.upper.toFixed(digits));
  if (BB.middle > candle.close) log.debug('\t', 'Mid   BB:', BB.middle.toFixed(digits));
  if (BB.lower >= candle.close) log.debug('\t', 'Lower BB:', BB.lower.toFixed(digits));
  log.debug('\t', 'price:', candle.close.toFixed(digits));
  if (BB.upper <= candle.close) log.debug('\t', 'Upper BB:', BB.upper.toFixed(digits));
  if (BB.middle <= candle.close) log.debug('\t', 'Mid   BB:', BB.middle.toFixed(digits));
  if (BB.lower < candle.close) log.debug('\t', 'Lower BB:', BB.lower.toFixed(digits));
  log.debug('\t', 'Band gap: ', BB.upper.toFixed(digits) - BB.lower.toFixed(digits));

  var rsi = this.indicators.rsi;

  log.debug('calculated RSI properties for candle:');
  log.debug('\t', 'rsi:', rsi.result.toFixed(digits));
  log.debug('\t', 'price:', candle.close.toFixed(digits));
}

method.onTrade = function(event) {
  if ('buy' === event.action && this.settings.stoploss_enabled) {
    this.indicators.stoploss.long(event.price)
  }
  this.prevAction = event.action
  this.prevPrice = event.price
}

method.check = function (candle) {
  var BB = this.indicators.bb;
  var rsi = this.indicators.rsi;
  var price = candle.close;
  var fastk = this.talibIndicators.tastochrsi.result.outFastK
  var fastd = this.talibIndicators.tastochrsi.result.outFastD
  var stochK = this.tulipIndicators.tustoch.result.stochK
  var stochD = this.tulipIndicators.tustoch.result.stochD
  this.nsamples++;

  this.RSIhistory.push(rsi.result);

  if(_.size(this.RSIhistory) > this.interval)
    // remove oldest RSI value
    this.RSIhistory.shift();

  this.lowestRSI = _.min(this.RSIhistory);
  this.highestRSI = _.max(this.RSIhistory);
  this.stochRSI = ((rsi.result - this.lowestRSI) / (this.highestRSI - this.lowestRSI)) * 100;

  if (
    'short' != this.prevAdvice &&
    this.settings.stoploss_enabled &&
    'stoploss' === this.indicators.stoploss.action
  ) {
    this.stoplossCounter++
    this.advice('short')
    this.prevAdvice = 'short'
  }

  // price Zone detection
  var zone = 'none';
  if (price >= BB.upper) zone = 'top';
  if ((price < BB.upper) && (price >= BB.middle)) zone = 'high';
  if ((price > BB.lower) && (price < BB.middle)) zone = 'low';
  if (price <= BB.lower) zone = 'bottom';
  // console.info('price: ', price);
  // console.info('BB upper: ', BB.upper);
  // console.info('BB lower: ', BB.lower);
  var bbPercentage = ((BB.upper - BB.lower) * 100) / (price)

  this.trend = {
    zone: zone,  // none, top, high, low, bottom
    duration: (this.trend.zone == zone ? this.trend.duration + 1 : 0),
    persisted: this.trend.zone == zone
  }

  if ('long' != this.prevAdvice &&
      bbPercentage > 2 && // Enough to trade?
      price <= BB.lower &&
      // rsi.result <= this.settings.thresholds.low &&
      // stochD < stochK &&
      // stochD < 20 &&
      this.stochRSI < 20 &&
      this.trend.duration >= this.settings.thresholds.persistence) {
    console.info('========================================')
    console.info('Buy: ', candle.start.format())
    console.info('price: ', price)
    console.info('BB low:', BB.lower)
    console.info('Stoch D: ', stochD)
    console.info('Stoch K: ', stochK)
    console.info('RSI: ', rsi.result)
    console.info('Stoch RSI: ', this.stochRSI)
    this.advice('long')
    this.prevAdvice = 'long'
  }
  if ('short' != this.prevAdvice &&
      // price >= BB.middle && 
      //rsi.result >= this.settings.thresholds.high &&
      // stochD > stochK &&
      // stochD > 20 &&
      this.stochRSI > 80) {
    console.info('----------------------------------------')
    console.info('Sell: ', candle.start.format())
    console.info('price: ', price)
    console.info('Stoch D: ', stochD)
    console.info('Stoch K: ', stochK)
    console.info('RSI: ', rsi.result)
    console.info('Stoch RSI: ', this.stochRSI)
    this.advice('short')
    this.prevAdvice = 'short'
  }

}

module.exports = method;5
