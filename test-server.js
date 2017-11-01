'use strict'

const Koa = require('koa')
const logger = require('./')
const minimist = require('minimist')

let args = minimist(process.argv)

function routes (ctx, next) {
  switch (ctx.path) {
    case '/info':
      ctx.status = 200
      break
    case '/warn':
      ctx.status = 404
      break
    case '/error':
      throw new Error('boom!')
  }

  ctx.res.end()
  next()
}

const server = new Koa()

let opts = args['file']
? {
  info: { logToFile: true, logToStd: false, rotate: args['rotate'] || false, period: '1000ms' },
  warn: { logToFile: true, logToStd: false, rotate: args['rotate'] || false, period: '1000ms' },
  error: { logToFile: true, logToStd: false, rotate: args['rotate'] || false, period: '1000ms' }
}
: undefined

server.use(logger(opts))
server.use(routes)

// Disable default error logging in koa
server.on('error', () => {})

server.listen(5000)
