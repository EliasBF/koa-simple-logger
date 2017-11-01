const logger = require('./')
const Koa = require('koa')

const server = new Koa()

// Log errors to file
server.use(logger({
  error: {
    logToFile: true
  }
}))

// info

server.use((ctx, next) => {
  if (ctx.path === '/info') {
    ctx.status = 200
  } else {
    return next()
  }
})

// warn

server.use((ctx, next) => {
  if (ctx.path === '/warn') {
    ctx.status = 404
  } else {
    return next()
  }
})

// error

server.use((ctx, next) => {
  if (ctx.path === '/error') {
    throw new Error('An error ocurred')
  } else {
    return next()
  }
})

/* eslint-disable handle-callback-err */
server.on('error', (err) => {
  // You custom error handler

  // koa-simple-logger print logging errors to standard output for default
  // Disable this behavior in koa for avoid duplicate logs
})

server.listen(3000)
console.log('Server listening on https://localhost:3000')
