var path = require('path')
var FTP = require('ftp')
var thunky = require('thunky')
var duplexify = require('duplexify')
var pump = require('pump')
var through = require('through2')

module.exports = FTPFS

function FTPFS (opts) {
  if (!(this instanceof FTPFS)) return new FTPFS(opts)
  var ftp = new FTP()
  this.ftp = ftp

  this.connect = thunky(function (cb) {
    function onErr (err) {
      cb(err)
    }
    ftp.once('error', onErr)
    ftp.once('ready', function () {
      ftp.removeListener('error', onErr)
      cb()
    })
    ftp.connect(opts)
  })
  
  this.end = ftp.end.bind(ftp)
}

FTPFS.prototype.readdir = function (file, cb) {
  var self = this
  this.connect(function (err) {
    if (err) return cb(err)
    self.ftp.list(file, function (err, list) {
      if (err) return cb(err)
      cb(null, list.map(function (i) { return i.name }))
    })
  })
}

FTPFS.prototype.createReadStream = function (file) {
  var self = this
  var duplex = duplexify()
  
  this.connect(function (err) {
    if (err) return duplex.destroy(err)
    self.ftp.get(file, function (err, reader) {
      if (err) return duplex.destroy(err)
      
      // i without proxy, reader doesnt work, weird stream impl i guess
      var proxy = through()
      pump(reader, proxy, function (err) {
        if (err) return duplex.destroy(err)
      })
      
      duplex.setReadable(proxy)
    })
  })
  
  return duplex
}

FTPFS.prototype.stat = FTPFS.prototype.lstat = function (file, cb) {
  var self = this
  this.connect(function (err) {
    if (err) return cb(err)
    var dir = path.dirname(file)
    var basename = path.basename(file)
    self.ftp.list(dir, function (err, list) {
      if (err) return cb(err)
      var info = list.find(function (l) { return l.name === basename })
      if (!info) return cb(new Error('file not found'))
      var stat = {
        dev: 1,
        mode: 33188,
        nlink: 1,
        uid: 1,
        gid: 1,
        rdev: 1,
        blksize: 4096,
        ino: 1,
        size: info.size,
        blocks: 1,
        atime: info.date,
        mtime: info.date,
        ctime: info.date,
        birthtime: info.date
      }
      cb(null, stat)
    })
  })
}
