/* eslint-disable no-undef */
'use strict'

const chai = require('chai')
const expect = chai.expect
const axios = require('axios')
const rmdir = require('rmdir')

const spawn = require('child_process').spawn
const fs = require('fs')

describe('koa-simple-logger', function () {
  this.timeout(0)

  let server

  let infoRegex = /\[INFO\]\[\d{4}-\d{1,2}-\d{1,2} \d{2}:\d{2}:\d{2}\] GET \/info -> \d+ms \(\d{3}\)/
  let warnRegex = /\[WARN\]\[\d{4}-\d{1,2}-\d{1,2} \d{2}:\d{2}:\d{2}\] GET \/warn -> \d+ms \(\d{3}\)/
  let errorRegex = /\[ERROR\]\[\d{4}-\d{1,2}-\d{1,2} \d{2}:\d{2}:\d{2}\] GET \/error -> ERROR \(500\)\n(?:.+\n?){1,}/

  let wrapAsync = (fn) => fn()

  describe('log to std', function () {
    beforeEach((done) => {
      server = spawn('node', ['test-server.js'])
      // Wait server initialization
      setTimeout(() => { done() }, 500)
    })

    afterEach((done) => {
      server.on('exit', () => done())
      server.stdout.removeAllListeners()
      server.stderr.removeAllListeners()

      fs.rmdirSync(process.cwd() + '/log')
      process.kill(server.pid)
    })

    it('should create log dir', (done) => {
      wrapAsync(async () => {
        try {
          await axios.get('http://127.0.0.1:5000/info')

          let info = fs.statSync(process.cwd() + '/log')
          expect(info.isDirectory()).to.be.equal(true)

          done()
        } catch (err) {
          done(err)
        }
      })
    })

    it('should log a request of info level to stdout', (done) => {
      wrapAsync(async () => {
        let response = null

        server.stdout.on('data', (data) => {
          setTimeout(() => {
            expect(response.status).to.be.equal(200)
            expect(infoRegex.test(data.toString())).to.be.equal(true)

            done()
          }, 0) // Wait for response assignment
        })

        try {
          response = await axios.get('http://127.0.0.1:5000/info')
        } catch (err) {
          done(err)
        }
      })
    })

    it('should log a request of warn level to stdout', (done) => {
      wrapAsync(async () => {
        let response = null

        server.stdout.on('data', (data) => {
          setTimeout(() => {
            expect(response.status).to.be.equal(404)
            expect(warnRegex.test(data.toString())).to.be.equal(true)

            done()
          }, 0) // Wait for response assignment
        })

        try {
          response = await axios.get('http://127.0.0.1:5000/warn', {
            validateStatus: (status) => status < 500
          })
        } catch (err) {
          done(err)
        }
      })
    })

    it('should log a request of error level to stderr', (done) => {
      wrapAsync(async () => {
        let response = null

        server.stderr.on('data', (data) => {
          setTimeout(() => {
            expect(response.status).to.be.equal(500)
            expect(errorRegex.test(data.toString())).to.be.equal(true)

            done()
          }, 100) // Wait for response assignment
        })

        try {
          await axios.get('http://127.0.0.1:5000/error', {
            validateStatus: (status) => status < 500
          })
        } catch (err) {
          if (err.response) {
            response = err.response
          } else {
            done(err)
          }
        }
      })
    })
  })

  describe('log to file', function () {
    beforeEach((done) => {
      server = spawn('node', ['test-server.js', '--file'])
      // Wait server initialization
      setTimeout(() => { done() }, 500)
    })

    afterEach((done) => {
      server.on('exit', () => done())

      rmdir(process.cwd() + '/log', (err) => err ? done(err) : null)
      process.kill(server.pid)
    })

    it('should log a request of info level to file', (done) => {
      wrapAsync(async () => {
        try {
          let response = await axios.get('http://127.0.0.1:5000/info')
          expect(response.status).to.be.equal(200)

          setTimeout(() => {
            let data = fs.readFileSync(process.cwd() + '/log/info.log', 'utf-8')
            expect(infoRegex.test(data)).to.be.equal(true)

            done()
          }, 100) // Wait log files creation
        } catch (err) {
          done(err)
        }
      })
    })

    it('should log a request of warn level to file', (done) => {
      wrapAsync(async () => {
        try {
          let response = await axios.get('http://127.0.0.1:5000/warn', {
            validateStatus: (status) => status < 500
          })
          expect(response.status).to.be.equal(404)

          setTimeout(() => {
            let data = fs.readFileSync(process.cwd() + '/log/warn.log', 'utf-8')
            expect(warnRegex.test(data)).to.be.equal(true)

            done()
          }, 100) // Wait log files creation
        } catch (err) {
          done(err)
        }
      })
    })

    it('should log a request of error level to file', (done) => {
      wrapAsync(async () => {
        try {
          await axios.get('http://127.0.0.1:5000/error', {
            validateStatus: (status) => status < 500
          })
        } catch (err) {
          if (err.response) {
            setTimeout(() => {
              let data = fs.readFileSync(process.cwd() + '/log/error.log', 'utf-8')
              expect(errorRegex.test(data)).to.be.equal(true)

              done()
            }, 100) // Wait log files creation
          } else {
            done(err)
          }
        }
      })
    })
  })

  describe('rotate files', function () {
    beforeEach((done) => {
      server = spawn('node', ['test-server.js', '--file', '--rotate'])
      // Wait server initialization
      setTimeout(() => { done() }, 500)
    })

    afterEach((done) => {
      server.on('exit', () => done())
      rmdir(process.cwd() + '/log', (err) => err ? done(err) : null)
      process.kill(server.pid)
    })

    it('rotate in 1000ms', (done) => {
      try {
        let steps = 0

        const step = async () => {
          if (steps === 3) {
            done()
            return
          }

          let response = await axios.get('http://127.0.0.1:5000/info')
          expect(response.status).to.be.equal(200)

          setTimeout(() => {
            let files = fs.readdirSync(process.cwd() + '/log')
            expect(steps + 1).to.be.equal(files.length)

            steps++

            setTimeout(step, 900) // Logging after 1000 milliseconds
          }, 100) // Wait log files creation
        }

        step()
      } catch (err) {
        done(err)
      }
    })
  })
})
