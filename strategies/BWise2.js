/*

  BB strategy - okibcn 2018-01-03

 */
// helpers
var _ = require('lodash')
const p = require('proxyquire')
var log = require('../core/log.js')

var BB = require('./indicators/BB.js')
var rsi = require('./indicators/RSI.js')
const TALIBASYNC = require('./indicators/TalibAsync.js')

// let's create our own method
var method = {}

// prepare everything our method needs
method.init = function () {
  this.name = 'BWise2'
  this.nsamples = 0
  this.bbTrend = {
    zone: 'none',  // none, top, high, low, bottom
    duration: 0
  }
  
  this.stochRsiTrend = {
    zone: 'none',  // none, top, middle, bottom
    duration: 0
  }

  this.requiredHistory = this.tradingAdvisor.historySize;
  this.RSIhistory = [];

  // define the indicators we need
  this.addIndicator('bb', 'BB', this.settings.bbands);
  this.addIndicator('rsi', 'RSI', this.settings);
  this.addTalibIndicator('tastochrsi', 'stochrsi', this.settings.stochRsiSettings)
  this.addTalibIndicator('tamacd', 'macd', this.settings.macdSettings)
  this.addTulipIndicator('tustoch', 'stoch', this.settings.tuStochSettings)
  this.addIndicator('stoploss', 'StopLoss', this.settings.stoploss)
  this.prevAdvice = 'short'
  this.prevMACDHist = 1000
  this.prevBBPerc = 0
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
  var macdVal = this.talibIndicators.tamacd.result.outMACD
  var macdSignal = this.talibIndicators.tamacd.result.outMACDSignal
  var macdHist = this.talibIndicators.tamacd.result.outMACDHist
  this.nsamples++;
  //console.info('macd result: ', this.talibIndicators.tamacd.result)

  this.RSIhistory.push(rsi.result);

  if(_.size(this.RSIhistory) > this.interval)
    // remove oldest RSI value
    this.RSIhistory.shift();

  this.lowestRSI = _.min(this.RSIhistory);
  this.highestRSI = _.max(this.RSIhistory);
  this.stochRSI = ((rsi.result - this.lowestRSI) / (this.highestRSI - this.lowestRSI)) * 100;

  // StochRSI zone detection
  var zoneStochRsi = 'none'
  switch (true) {
    case this.stochRSI < this.settings.thresholds.lowStochRsi:
      zoneStochRsi = 'bottom'
      break
    case this.stochRSI < this.settings.thresholds.highStochRsi:
      zoneStochRsi = 'middle'
      break
    default:
      zoneStochRsi = 'top'
      break
  }
  this.stochRsiTrend = {
    zone: zoneStochRsi,
    duration: (this.stochRsiTrend.zone == zoneStochRsi ? this.stochRsiTrend.duration + 1 : 0)
  }

  // price Zone detection
  var zone = 'none'
  switch (true) {
    case price < BB.lower:
      zone = 'bottom'
      break
    case price < BB.middle:
      zone = 'low'
      break
    case price < BB.upper:
      zone = 'high'
      break
    default:
      zone = 'top'
      break
  }
  this.bbTrend = {
    zone: zone,  // none, top, high, low, bottom
    duration: (this.bbTrend.zone == zone ? this.bbTrend.duration + 1 : 0)
  }

  var bbPercentage = ((BB.upper - BB.lower) * 100) / (price)
  var profitPercentage = this.priceBuy === 0 ? 0 : (price - this.priceBuy) / this.priceBuy * 100

  if (
    'short' != this.prevAdvice &&
    this.settings.stoploss_enabled &&
    'stoploss' === this.indicators.stoploss.action
  ) {
    this.stoplossCounter++
    console.info('----------------------------------------')
    console.info('---- StopLoss --------------------------')
    console.info('Sell: ', candle.start.format())
    console.info('price: ', price)
    console.info('Profit: ', profitPercentage)
    console.info('Zone:', this.bbTrend.zone)
    console.info('Stoch D: ', stochD)
    console.info('Stoch K: ', stochK)
    console.info('StochRSI D: ', fastd)
    console.info('StochRSI K: ', fastk)
    console.info('RSI: ', rsi.result)
    console.info('Stoch RSI: ', this.stochRSI)
    console.info('MACD value: ', macdVal)
    console.info('MACD signal: ', macdSignal)
    console.info('MACD hist: ', macdHist)
    console.info('MACD hist previous: ', this.prevMACDHist)
    this.advice('short')
    this.prevAdvice = 'short'
  } else {
    if (
      'long' != this.prevAdvice &&
      // this.prevMACDHist < macdHist &&
      // macdVal > macdSignal &&
      // bbPercentage > 2 && // Enough to trade?
      // bbPercentage > this.prevBBPerc && // Increasing BB
      // price <= BB.lower &&
      this.stochRsiTrend.zone === 'bottom' &&
      this.stochRsiTrend.duration > this.settings.thresholds.persistenceBuy
      // rsi.result <= this.settings.thresholds.low &&
      // (stochK - stochD) > 5  && // should be volatile
      // stochD < stochK &&
      // stochD < 20 &&
      // this.bbTrend.duration >= this.settings.thresholds.persistenceBuy
    ) {
      console.info('========================================')
      console.info('Buy: ', candle.start.format())
      console.info('price: ', price)
      console.info('Zone:', this.bbTrend.zone)
      console.info('Stoch D: ', stochD)
      console.info('Stoch K: ', stochK)
      console.info('StochRSI D: ', fastd)
      console.info('StochRSI K: ', fastk)
      console.info('RSI: ', rsi.result)
      console.info('Stoch RSI: ', this.stochRSI)
      console.info('MACD value: ', macdVal)
      console.info('MACD signal: ', macdSignal)
      console.info('MACD hist: ', macdHist)
      console.info('MACD hist previous: ', this.prevMACDHist)
      this.advice('long')
      this.prevAdvice = 'long'
      this.priceBuy = price
    }
    if (
      // profitPercentage < -2 || ( // Accept 2% loss
      // price >= BB.middle && 
      this.stochRsiTrend.zone === 'top' &&
      this.stochRsiTrend.duration > this.settings.thresholds.persistenceSell &&
        //rsi.result >= this.settings.thresholds.high &&
      // stochD > stochK &&
      // stochD > 20 &&
      // this.prevMACDHist > macdHist &&
      'short' != this.prevAdvice
    ) {
      console.info('----------------------------------------')
      console.info('Sell: ', candle.start.format())
      console.info('price: ', price)
      console.info('Profit: ', profitPercentage)
      console.info('Zone:', this.bbTrend.zone)
      // console.info('Stoch D: ', stochD)
      // console.info('Stoch K: ', stochK)
      console.info('RSI: ', rsi.result)
      console.info('Stoch RSI: ', this.stochRSI)
      console.info('MACD value: ', macdVal)
      console.info('MACD signal: ', macdSignal)
      console.info('MACD hist: ', macdHist)
      console.info('MACD hist previous: ', this.prevMACDHist)
      this.advice('short')
      this.prevAdvice = 'short'
    }
  }
  this.prevBBPerc = bbPercentage
  this.prevMACDHist = macdHist
}

module.exports = method;5
