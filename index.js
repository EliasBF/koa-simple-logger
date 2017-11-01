'use strict'

const path = require('path')
const fs = require('fs')
const mkdir = require('mkdirp')
const chalk = require('chalk')

/*
 * Set options
 */
function options (opts) {
  let temp = {
    logDir: opts.logDir || path.join(process.cwd(), 'log')
  }

  let levels = ['info', 'warn', 'error']

  levels.forEach((level) => {
    temp[level] = opts[level]
    ? {
      logToFile: typeof opts[level]['logToFile'] !== 'undefined' ? opts[level]['logToFile'] : false,
      logToStd: typeof opts[level]['logToStd'] !== 'undefined' ? opts[level]['logToStd'] : true,
      rotate: typeof opts[level]['rotate'] !== 'undefined' ? opts[level]['rotate'] : false,
      period: typeof opts[level]['period'] !== 'undefined' ? opts[level]['period'] : '1d'
    }
    : {
      logToFile: false,
      logToStd: true,
      rotate: false,
      period: '1d'
    }
  })

  return temp
}

function makeDir (dir) {
  return new Promise((resolve, reject) => {
    mkdir(dir, (err) => err ? reject(err) : resolve())
  })
}

function readDir (dir) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, files) => err ? reject(err) : resolve(files))
  })
}

/*
 * Wrapper for writable streams. add functionality to change the path of stream each certain time
 */
class RotateStream {
  constructor (dest, opts) {
    this.dest = dest
    this.options = opts
    this.rotAt = null
    this.stream = null

    this.isInit = false
  }

  async init () {
    let files = null

    try {
      files = await readDir(path.dirname(this.dest))
    } catch (err) {
      throw err
    }

    if (files.length === 0) {
      this.rotAt = new Date().getTime()
      this.stream = fs.createWriteStream(
        this.dest.replace('.log', `.${this.rotAt.toString()}.log`),
        { flags: 'a', encoding: 'utf-8' }
      )
    } else {
      let r = new RegExp(`${this.options.level}.(\\d+).log`)

      let levelFiles = files.filter((f) => f.search(this.options.level) === 0)

      if (levelFiles.length === 0) {
        this.rotAt = new Date().getTime()
        this.stream = fs.createWriteStream(
          this.dest.replace('.log', `.${this.rotAt.toString()}.log`),
          { flags: 'a', encoding: 'utf-8' }
        )
      } else {
        let current = levelFiles.reduce((p, c) => {
          return Number(r.exec(p)[1]) < Number(r.exec(c)[1]) ? c : p
        })

        let ms = r.exec(current)

        if (ms) {
          this.rotAt = new Date((Number(r.exec(current)[1]))).getTime()
        } else {
          this.rotAt = new Date().getTime()
          current = `${this.options.level}.${this.rotAt}.log`
        }

        this.stream = fs.createWriteStream(
          path.join(path.dirname(this.dest), current),
          { flags: 'a', encoding: 'utf-8' }
        )
      }
    }

    this.isInit = true
  }

  write (message) {
    if (!this.checkRotate()) {
      this.stream.write(message)
      return
    }

    this.rotateFile()
    this.stream.write(message)
  }

  end () {
    this.stream.end()
  }

  checkRotate () {
    let m = /^([1-9][0-9]*)([hdwmy]|ms)$/.exec(this.options.period)
    let periodNum = m[1]
    let periodScope = m[2]

    let elapsedTime = this.calcElapsedTime(periodScope)
    let rotate = false

    if (elapsedTime >= periodNum) {
      rotate = true
    }

    return rotate
  }

  rotateFile () {
    this.end()

    this.rotAt = new Date().getTime()
    this.stream = fs.createWriteStream(
      this.dest.replace('.log', `.${this.rotAt.toString()}.log`),
      { flags: 'a', encoding: 'utf-8' }
    )
  }

  calcElapsedTime (scope) {
    let date = new Date()
    let elapsedTime = null
    let difference = date.getTime() - this.rotAt

    switch (scope) {
      case 'ms':
        elapsedTime = difference
        break
      case 'h':
        elapsedTime = Math.round(difference / 1000 / 60 / 60)
        break
      case 'd':
        elapsedTime = Math.round(difference / 1000 / 60 / 60 / 24)
        break
      case 'w':
        elapsedTime = Math.round(difference / 1000 / 60 / 60 / 24 / 7)
        break
      case 'm':
        elapsedTime = Math.round(difference / 1000 / 60 / 60 / 24 / 30)
        break
      case 'y':
        elapsedTime = Math.round(difference / 1000 / 60 / 60 / 24 / 365)
        break
    }

    return elapsedTime
  }
}

class KoaRequestLogger {
  constructor (opts) {
    this.options = opts
    this.streams = {}
    this.logDir = opts.logDir
    this.isInit = false
  }

  async init () {
    try {
      await makeDir(this.logDir)
    } catch (err) {
      throw err
    }

    delete this.options.logDir

    // Initialize streams
    Object.keys(this.options).forEach((level) => {
      let opts = this.options[level]
      opts['level'] = level

      this.streams[level] = opts.logToFile && opts.logToStd
      ? [level === 'error'
        ? process.stderr
        : process.stdout, (opts.rotate
          ? new RotateStream(path.join(this.logDir, `${level}.log`), opts)
          : fs.createWriteStream(path.join(this.logDir, `${level}.log`), { flags: 'a', encoding: 'utf-8' }))]
      : (opts.logToStd
        ? (level === 'error'
          ? process.stderr
          : process.stdout)
        : (opts.rotate
          ? new RotateStream(path.join(this.logDir, `${level}.log`), opts)
          : fs.createWriteStream(path.join(this.logDir, `${level}.log`), { flags: 'a', encoding: 'utf-8' })))
    })

    this.isInit = true
  }

  /*
   * Level from current request based on his http status code
   */
  logLevel (status) {
    return status >= 500
    ? 'error'
    : (status >= 400
      ? 'warn'
      : 'info')
  }

  /*
   * Colorize message based on log level
   */
  colorize (level, msg) {
    return level === 'error'
    ? chalk.red(msg)
    : (level === 'warn'
      ? chalk.yellow(msg)
      : chalk.green(msg))
  }

  formatMessage (ctx, requestTime, level, color) {
    let message = `[${level.toUpperCase()}][${new Date().toLocaleString()}] ${ctx.method} ${ctx.url} -> ${requestTime}ms (${ctx.status})\n`
    return color ? this.colorize(level, message) : message
  }

  formatErrorMessage (ctx, error, color) {
    let message = `[ERROR][${new Date().toLocaleString()}] ${ctx.method} ${ctx.url} -> ERROR (500)\n${error.stack}\n\n`
    return color ? this.colorize('error', message) : message
  }

  // TODO: refactorize this method
  async log (ctx, level, requestTime, error) {
    let stream = this.streams[level]
    let isColorized = false

    if (Array.isArray(stream)) {
      stream.forEach(async (s) => {
        if ((s instanceof RotateStream)) {
          if (!s.isInit) {
            await s.init()
          }
          isColorized = false
        } else {
          if ('mode' in s) {
            isColorized = false
          } else {
            isColorized = true
          }
        }

        const message = error
        ? this.formatErrorMessage(ctx, error, isColorized)
        : this.formatMessage(ctx, requestTime, level, isColorized)

        s.write(message)
      })
      return
    }

    if ((stream instanceof RotateStream)) {
      if (!stream.isInit) {
        await stream.init()
      }
      isColorized = false
    } else {
      if ('mode' in stream) {
        isColorized = false
      } else {
        isColorized = true
      }
    }

    const message = error
    ? this.formatErrorMessage(ctx, error, isColorized)
    : this.formatMessage(ctx, requestTime, level, isColorized)

    stream.write(message)
  }

  async logging (ctx, requestTime, error) {
    const level = this.logLevel(ctx.status)
    await this.log(ctx, level, requestTime, error)
  }
}

module.exports = function (opts = {}) {
  /* eslint-disable no-unused-vars */
  let klogger = new KoaRequestLogger(options(opts))
  /* eslint-enable no-unused-vars */

  return async function logger (ctx, next) {
    const start = Date.now()

    try {
      await next()

      const end = Date.now() - start

      if (!klogger.isInit) {
        await klogger.init()
      }

      await klogger.logging(ctx, end)
    } catch (err) {
      if (!klogger.isInit) {
        await klogger.init()
      }

      // This ensures that the log level is error
      ctx.status = 500

      await klogger.logging(ctx, null, err)

      // RETHROW
      // This ensures that the default error handler is done
      throw err
    }
  }
}
