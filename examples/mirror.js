var mirror = require('mirror-folder')
var ftpfs = require('../')
var ftp = ftpfs({ host: process.argv[2], debug: function (x) {  } })

var progress = mirror({name: '/', fs: ftp}, __dirname + '/mirror', { dryRun: true }, function (err) {
  if (err) throw err
  console.error('all done')
  ftp.end()
})

progress.on('put', function (src, dest) {
  var meta = {name: src.name, stat: src.stat, metadata: src.stat._ftpmetadata}
  delete meta.stat._ftpmetadata
  console.log(JSON.stringify(meta))
})