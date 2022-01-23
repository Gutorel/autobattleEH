/* eslint-disable no-underscore-dangle */
import chalk from 'chalk';

class Logger {
  constructor(name) {
    this.name = name;
  }

  _log(logLevel, args) {
    const date = new Date();
    const dateText = date.toTimeString().split(' ')[0];
    console.log(`(${dateText})#${this.name}[${logLevel}]: ${args}`);
  }

  info(args) {
    this._log('info', args);
  }

  warn(args) {
    this._log('⚠', chalk.yellow(args));
  }

  debug(args) {
    this._log('🔸', chalk.blue(args));
  }

  error(args) {
    this._log('🛑', chalk.red(args));
  }
}

export default Logger;
