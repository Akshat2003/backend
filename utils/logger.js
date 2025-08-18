const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logFile = process.env.LOG_FILE || 'logs/app.log';
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(data && { data })
    };

    return JSON.stringify(logEntry);
  }

  writeToFile(level, message, data = null) {
    const logEntry = this.formatMessage(level, message, data);
    fs.appendFileSync(this.logFile, logEntry + '\n');
  }

  writeToConsole(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[35m', // Magenta
      reset: '\x1b[0m'   // Reset
    };

    const color = colors[level] || colors.info;
    const resetColor = colors.reset;
    
    let logMessage = `${color}[${timestamp}] ${level.toUpperCase()}: ${message}${resetColor}`;
    
    if (data) {
      logMessage += `\n${color}Data: ${JSON.stringify(data, null, 2)}${resetColor}`;
    }

    console.log(logMessage);
  }

  shouldLog(level) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = levels[this.logLevel] || 2;
    const messageLevel = levels[level] || 2;
    return messageLevel <= currentLevel;
  }

  log(level, message, data = null) {
    if (!this.shouldLog(level)) return;

    // Always write to console in development
    if (process.env.NODE_ENV !== 'production') {
      this.writeToConsole(level, message, data);
    }

    // Write to file in production or when LOG_FILE is specified
    if (process.env.NODE_ENV === 'production' || process.env.LOG_FILE) {
      try {
        this.writeToFile(level, message, data);
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }

  // Log HTTP requests
  request(req) {
    const { method, url, ip, headers } = req;
    this.info(`${method} ${url}`, {
      ip,
      userAgent: headers['user-agent'],
      contentType: headers['content-type']
    });
  }

  // Log HTTP responses
  response(req, res, responseTime) {
    const { method, url } = req;
    const { statusCode } = res;
    
    const level = statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${url} - ${statusCode}`, {
      responseTime: `${responseTime}ms`,
      statusCode
    });
  }
}

module.exports = new Logger();