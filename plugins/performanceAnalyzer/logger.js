// log trade performance results

const _ = require('lodash');
const moment = require('moment');
const humanizeDuration = require('humanize-duration');

const util = require('../../core/util.js');
const dirs = util.dirs();
const mode = util.gekkoMode();
const log = require(dirs.core + 'log');
const colors = require('colors/safe');

const config = util.getConfig();
const perfConfig = config.performanceAnalyzer;
const shortTrading = perfConfig.shortTrading != undefined ? perfConfig.shortTrading : false;

const Logger = function(watchConfig) {
  this.currency = watchConfig.currency;
  this.asset = watchConfig.asset;

  this.roundtrips = [];
}

Logger.prototype.round = function(amount) {
  return amount.toFixed(8);
}

// used for:
// - realtime logging (per advice)
// - backtest logging (on finalize)
Logger.prototype.logReport = function(trade, report) {
  // ignore the trade

  var start = this.round(report.startBalance);
  var current = this.round(report.balance);

  log.info(`(PROFIT REPORT) original balance:\t\t ${start} ${this.currency}`);
  log.info(`(PROFIT REPORT) current balance:\t\t ${current} ${this.currency}`);
  log.info(
    `(PROFIT REPORT) profit:\t\t\t\t ${this.round(report.profit)} ${this.currency}`,
    `(${report.relativeProfit > 0 ? colors.green(this.round(report.relativeProfit)+'%') : colors.green(this.round(report.relativeProfit)+'%')})`
  );
}

Logger.prototype.logRoundtripHeading = function() {
  log.info('(ROUNDTRIP)', 'entry date (UTC)  \texit date (UTC)  \texposed duration\tP&L \tprofit');
}

Logger.prototype.logRoundtrip = function(rt) {
  if (rt.entryAt && rt.exitAt) {
    const display = [
      rt.entryAt.utc().format('YYYY-MM-DD HH:mm'),
      rt.exitAt.utc().format('YYYY-MM-DD HH:mm'),
      (moment.duration(rt.duration).humanize() + "           ").slice(0, 16),
      rt.pnl.toFixed(2),
      rt.profit.toFixed(2)
    ];
  
    log.info('(ROUNDTRIP)', display.join('\t'));  
  } else {
    log.info('Missing entryAt and/or exitAt of Roundtrip')
  }
}

if(mode === 'backtest') {
  // we only want to log a summarized one line report, like:
  // 2016-12-19 20:12:00: Paper trader simulated a BUY 0.000 USDT => 1.098 BTC
  Logger.prototype.handleTrade = function(trade) {
    if(trade.action !== 'sell' && trade.action !== 'buy')
      return;

    var at = trade.date.format('YYYY-MM-DD HH:mm:ss');


    if (!shortTrading) {
      if(trade.action === 'sell') {
          let tradeType = trade.trigger.origin != undefined && trade.trigger.origin != 'advice' ? trade.trigger.origin : '';
          let trailPercent = tradeType == 'trailingStop' ? ' ' + trade.trigger.trailPercentage + '%' : '';
          let trailSLInfo = tradeType !== '' && trailPercent !== '' ? ` (${tradeType}${trailPercent})` : '';

          log.info(
            `${at}: Paper trader simulated a SELL${trailSLInfo} @ ${trade.price.toFixed(2)} ${this.currency}`,
            `\t${this.round(trade.portfolio.currency)}`,
            `${this.currency} <= ${this.round(trade.portfolio.asset)}`,
            `${this.asset}`
          );
      }
      else if(trade.action === 'buy') {
        log.info(
          `${at}: Paper trader simulated a BUY @ ${trade.price.toFixed(2)} ${this.currency}`,
          `\t\t${this.round(trade.portfolio.currency)}`,
          `${this.currency}\t=> ${this.round(trade.portfolio.asset)}`,
          `${this.asset}`
        );
      }
    }

    if (shortTrading) {
      if(trade.action === 'sell') {
        let tradeType = trade.trigger.origin != undefined && trade.trigger.origin != 'advice' ? trade.trigger.origin : '';
        let trailPercent = tradeType == 'trailingStop' ? ' ' + trade.trigger.trailPercentage + '%' : '';
        let trailSLInfo = tradeType !== '' && trailPercent !== '' ? ` (${tradeType}${trailPercent})` : '';

        log.info(
          `${at}: Paper trader simulated an OPEN SHORT position${trailSLInfo} @ ${trade.price.toFixed(2)} ${this.currency}`,
          `\t${this.round(trade.portfolio.currency)}`,
          `${this.currency} <= ${this.round(trade.portfolio.asset)}`,
          `${this.asset}`
        );
      }
      else if(trade.action === 'buy') {
        log.info(
          `${at}: Paper trader simulated a CLOSE SHORT position @ ${trade.price.toFixed(2)} ${this.currency}`,
          `\t\t${this.round(trade.portfolio.currency)}`,
          `${this.currency}\t=> ${this.round(trade.portfolio.asset)}`,
          `${this.asset}`
        );
      }
    }
  }

  Logger.prototype.finalize = function(report) {

    log.info();
    log.info('(ROUNDTRIP) REPORT:');

    this.logRoundtripHeading();
    _.each(this.roundtrips, this.logRoundtrip, this);

    log.info()
    log.info(`(PROFIT REPORT) start time:\t\t\t ${report.startTime}`);
    log.info(`(PROFIT REPORT) end time:\t\t\t ${report.endTime}`);
    log.info(`(PROFIT REPORT) timespan:\t\t\t ${report.timespan}`);
    log.info(`(PROFIT REPORT) exposure:\t\t\t ${report.exposure}`);
    log.info();
    log.info(`(PROFIT REPORT) start price:\t\t\t ${report.startPrice} ${this.currency}`);
    log.info(`(PROFIT REPORT) end price:\t\t\t ${report.endPrice} ${this.currency}`);
    log.info(`(PROFIT REPORT) Market:\t\t\t\t ${report.market > 0 ? colors.green(this.round(report.market)) : colors.red(this.round(report.market)+'%')}`);
    log.info();
    log.info(`(PROFIT REPORT) amount of trades:\t\t ${report.trades}`);

    this.logReport(null, report);

    log.info(`(PROFIT REPORT) alpha:\t\t\t\t ${report.alpha}%`);
    log.info(
      `(PROFIT REPORT) simulated yearly profit:\t ${report.yearlyProfit}`,
      `${this.currency} (${report.relativeYearlyProfit}%)`
    );

    log.info(`(PROFIT REPORT) sharpe ratio:\t\t\t ${report.sharpe}`);
    log.info(`(PROFIT REPORT) expected downside:\t\t ${report.downside}`);

    if (report.relativeProfit > 300) {
      log.info(`(PROFIT REPORT) ${colors.yellow('Ole, Ole, Ole, dicke (• )( •) Kartoffelsalat, Lambo time :-)')}`);
    }
  
    log.info(`(PROFIT REPORT) ratio roundtrips:\t\t ${report.ratioRoundTrips}%`);
  }

  Logger.prototype.handleRoundtrip = function(rt) {
    this.roundtrips.push(rt);
  }

} else if(mode === 'realtime') {
  Logger.prototype.handleTrade = Logger.prototype.logReport;

  Logger.prototype.handleRoundtrip = function(rt) {
    this.logRoundtripHeading();
    this.logRoundtrip(rt);
  }

}




module.exports = Logger;
