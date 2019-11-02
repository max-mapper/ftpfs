var path = require('path')
var FTP = require('ftp')
var thunky = require('thunky')
var duplexify = require('duplexify')
var pump = require('pump')
var through = require('through2')
var extend = require('xtend')
var debug = require('debug')('ftpfs')
var Stat = require('./stat.js')
var util = require('util')

module.exports = FTPFS

function FTPFS (opts) {
  if (!(this instanceof FTPFS)) return new FTPFS(opts)
  var ftp = new FTP()
  this.ftp = ftp
  this.cache = {}

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
    debug('readdir', file, {cached: !!self.cache[file]})
    if (self.cache[file]) {
      return cb(null, self.cache[file].map(function (i) {
        return i.name
      }))
    }
    self.ftp.list(file, function (err, list) {
      if (err) return cb(err)
      self.cache[file] = list
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
    
    debug('stat', file, dir, {cached: !!self.cache[dir]})
    if (self.cache[dir]) return createStat(self.cache[dir])
    
    self.ftp.list(dir, function (err, list) {
      if (err) return cb(err)
      self.cache[dir] = list
      createStat(list)
    })
    
    function createStat (list) {
      var match = list.find(function (l) { return l.name === basename })
      info = extend({}, match) // clone
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
      stat._ftpmetadata = match
      cb(null, stat)
    }
  })
  
  function mkstat (info) {
    debug('mkstat', info)
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

FTPFS.prototype.statSync = FTPFS.prototype.lstatSync = async function (file) {
  return await util.promisify(this.stat)(file);
}


FTPFS.prototype.readFile = function (file, encoding, cb) {
  if (arguments.length === 2) cb = encoding;
  var string = '';
  var stream = self.createReadStream(file);
  stream.on('error', cb);
  stream.on('data',function(data){
    string += data.toString();
  });
  stream.on('end',function(){
    cb(null, string);
  });
}

FTPFS.prototype.readFileSync = async function (file, encoding) {
  return await util.promisify(this.readFile)(file, encoding);
};


FTPFS.prototype.mkdir = function (dir, cb) {
  var self = this
  this.connect(function (err) {
    if (err) return cb(err)
    debug('mkdir', dir)

    self.ftp.mkdir(dir, cb)
  })
}

FTPFS.prototype.rmdir = function (dir, cb) {
  var self = this
  this.connect(function (err) {
    if (err) return cb(err)
    debug('rmdir', dir)

    self.ftp.rmdir(dir, cb)
  })
}


FTPFS.prototype.unlink = function (file, cb) {
  var self = this
  this.connect(function (err) {
    if (err) return cb(err)
    debug('unlink', file)

    self.ftp.delete(file, cb)
  })
}

FTPFS.prototype.rename = function (oldPath, newPath, cb) {
  var self = this
  this.connect(function (err) {
    if (err) return cb(err)
    debug('rename', oldPath, newPath)

    self.ftp.rename(oldPath, newPath, cb)
  })
}

FTPFS.prototype.writeFile = function (file, data, options, cb) {
  if (arguments.length === 3) cb = options;
  var self = this
  this.connect(function (err) {
    if (err) return cb(err)
    debug('writeFile', file, options)

    self.ftp.put(file, Buffer.from(data, 'utf-8'), cb)
  })
}