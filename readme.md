# ftpfs

an ftp client that expose the node fs API

only supports `createReadStream`, `readDir`, `stat` and `lstat` right now

## usage

```js
var ftp = ftpfs({ port: 2121 })

var readStream = ftp.createReadStream('hello.txt')

ftp.readdir('/', function (err, list) {

})

ftp.stat('hello.txt', function (err, stat) {

})

ftp.end()
```