var mirror = require('mirror-folder')
var ftpfs = require('../')
var ftp = ftpfs({ host: 'ftp.xdc.arm.gov', debug: function (x) { console.log('debug', x) } })

mirror({name: '/', fs: ftp}, __dirname, function (err) {
  if (err) throw err
  console.log('Folder was mirrored')
})