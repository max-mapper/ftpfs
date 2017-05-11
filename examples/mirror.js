var mirror = require('mirror-folder')
var ftpfs = require('../')
var ftp = ftpfs({ host: 'ftp.xdc.arm.gov', debug: function (x) {  } })

var progress = mirror({name: '/', fs: ftp}, __dirname + '/mirror', { dryRun: true }, function (err) {
  if (err) throw err
})

progress.on('put', function (src, dest) {
  console.log(JSON.stringify({name: src.name, stat: src.stat}))
})