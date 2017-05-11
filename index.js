var path = require('path')
var FTP = require('ftp')
var thunky = require('thunky')
var duplexify = require('duplexify')
var pump = require('pump')
var through = require('through2')
var debug = require('debug')('ftpfs')
var Stat = require('./stat.js')

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
      debug('ftp connected')
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
    debug('readdir', file)
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
    debug('createReadStream', file)
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
    
    var isFolder = false
    if (!basename) {
      isFolder = true
      if (dir === '/') return cb(null, mkstat({
        size: 136,
        type: 'directory',
        mode: 16877,
        date: new Date(0)
      }))
      basename = path.split('/').pop()
      dir = path.resolve(dir, '..')
    }
    
    debug('stat', file, dir)
    self.ftp.list(dir, function (err, list) {
      if (err) return cb(err)
      var info = list.find(function (l) { return l.name === basename })
      if (!info) {
        debug('file not found', list)
        return cb(new Error('file not found'))
      }
      if (info.type === 'd') {
        info.size = 136
        info.mode = 16877
        info.type = 'directory'
      } else {
        info.type = 'file'
      }
      var stat = mkstat(info)
      cb(null, stat)
    })
  })
  
  function mkstat (info) {
    return new Stat({
      mode: info.mode || 33188,
      type: info.type,
      size: info.size,
      atime: info.date,
      mtime: info.date,
      ctime: info.date,
      birthtime: info.date
    })
  }
}
