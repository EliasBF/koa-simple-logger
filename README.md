# koa-simple-logger

Koa middleware for logging, support rotate files

# Installation

```
$ npm install koa-simple-logger
```

# Documentation

## Options

``` js
// Default values

{
  // Destination directory for log files
  logDir: path.join(process.cwd(), 'log'),
  info: {
    // Logging this level to file
    logToFile: false,
    // Logging this level to standard output (error level to standard error)
    logToStd: true,
    // Rotate the log file each period of time
    rotate: false,
    // Period the time for rotate the log file, range of time permitted:
    // milliseconds: ms (1000ms, 10000ms, etc)
    // hours: h (1h, 10h, etc)
    // days: d (1d, 10d, etc)
    // weeks: w (1w, 10w, etc)
    // months: m (1m, 3m, etc)
    // years: y (1y, 5y, etc)
    period: '1d'
  },
  warn: {
    logToFile: false,
    logToStd: true,
    rotate: false,
    period: '1d'
  },
  error: {
    logToFile: false,
    logToStd: true,
    rotate: false,
    period: '1d'
  }
}
```

# Example

``` js
const logger = require('koa-simple-logger')
const Koa = require('koa')

const server = new Koa()
server.use(logger())
```

# Notes

Recommended that you ```.use()``` this middleware near the top to "wrap" all subsequent middleware.

# License

MIT
