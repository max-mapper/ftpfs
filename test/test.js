var test = require('tape')
var child = require('child_process')
var concat = require('concat-stream')
var ftpd = require('ftpd')
var connections = require('connections')
var ftpfs = require('../')

var server
var sockets = []
var ftp = ftpfs({ port: 2121 })

test('start test server', function (t) {
  server = new ftpd.FtpServer('127.0.0.1', {
  	getInitialCwd: function () { return  './' },
  	getRoot: function() { return __dirname }
  })
  
  server.connections = connections(server.server)
  server.debugging = 2
  
  server.on('client:connected', function (connection) {
    sockets.push(connection.socket)
  	connection.on('command:user', function (user, success, failure) {
      success()
    })
  	connection.on('command:pass', function (user, success, failure) {
      success('anonymous')
    })
  })

  server.listen(2121, function () {
    t.ok(true, 'server listening')
    t.end()
  })
})

test('readdir', function (t) {
  ftp.readdir('/', function (err, list) {
    t.ifErr(err, 'no err')
    t.deepEqual(list, ['hello.txt', 'test.js'])
    t.end()
  })
})

test('createReadStream', function (t) {
  var rs = ftp.createReadStream('hello.txt')
  rs.pipe(concat(function (data) {
    t.equals(data.toString(), 'hello')
    t.end()
  }))
})

test('stat', function (t) {
  ftp.stat('hello.txt', function (err, stat) {
    t.ifErr(err, 'no err')
    t.equals(stat.mode, 33188)
    t.equals(stat.size, 5)
    t.end()
  })
})

test('teardown', function (t) {
  server.close()
  ftp.end()
  t.ok(true, 'tearing down')
  t.end()
  process.exit(0) // hack, open socket somewhere in server (couldnt figure it out)
})
