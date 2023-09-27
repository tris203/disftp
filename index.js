// Quick start, create an active ftp server.
const FtpSrv = require('ftp-srv');
const FileSystem = require('ftp-srv');
const DiscordFileManager = require('./disbox-file-manager.js');
const Stream = require('stream');
const fs = require('fs');

class discordFileSystem extends FileSystem {
  constructor(connection, username, password) {
    super(connection, { root: './', cwd: '/' });
    this.connection = connection;
    this.username = username;
    this.password = password;
    this.files = [];
    this.realcwd = '';
    this._initalised = this.intialiseFileManager(username, password);
  }

  async intialiseFileManager(username, password) {
    this.fileManager = await DiscordFileManager.create(
      `https://discord.com/api/webhooks/${username}/${password}`,
    );
  }

  currentDirectory() {
    if (this.realcwd == '') {
      return '/';
    }
    return this.realcwd;
  }

  async get(fileName) {
    console.log('get', fileName);
    await this._initalised;
    if (fileName == '.') {
      return Promise.resolve({
        name: '.',
        size: 0,
        type: 'directory',
        atime: new Date(),
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: () => true,
      });
    }
    this.files = this.fileManager.getChildren('');
    Object.values(this.files).map((file) => {
      if (file.name == fileName) {
        return Promise.resolve({
          name: file.name,
          size: file.size,
          type: file.type,
          atime: file.updated_at,
          mtime: file.updated_at,
          ctime: file.created_at,
          isDirectory: () => file.type === 'directory',
        });
      }
    });
  }

  async list(path) {
    await this._initalised;
    console.log('list', path);
    if (this.realcwd == '/') {
      this.files = this.fileManager.getChildren('');
    } else {
      this.files = this.fileManager.getChildren(this.realcwd);
    }
    let fileList = Object.values(this.files).map((file) => {
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        atime: file.updated_at,
        mtime: file.updated_at,
        ctime: file.created_at,
        isDirectory: () => file.type === 'directory',
      };
    });
    return Promise.resolve(fileList);
  }
  chdir(path) {
    switch (true) {
      case path == '..':
        this.realcwd = this.realcwd.replace(/\/[^\/]+$/, '');
        break;
      case path == '/':
        this.realcwd = '';
        break;
      case path.startsWith('/'):
        this.realcwd = path;
        break;
      default:
        this.realcwd = this.realcwd + '/' + path;
        this.realcwd = this.realcwd.replace(/\/+/g, '/'); //remove double slashes
        this.realcwd = this.realcwd.replace(/\/+$/, ''); //remove trailing slash
        console.log(this.realcwd);
        break;
    }
    return Promise.resolve();
  }
  async mkdir(path) {
    await this._initalised;
    this.fileManager.createDirectory(this.realcwd + '/' + path);
    return Promise.resolve();
  }
  async rename(oldPath, newPath) {
    await this._initalised;
    const newFilename = newPath.split('/').pop();
    this.fileManager.renameFile(oldPath, newFilename);
    return Promise.resolve();
  }
  async read(fileName, position, length) {
    await this._initalised;
    const passThrough = new Stream.PassThrough();
    this.fileManager
      .downloadFile(this.realcwd + '/' + fileName, passThrough, false, true)
      .then(() => {
        passThrough.end();
        console.log('donwload complete');
      });
    return Promise.resolve(passThrough);
  }
  async write(fileName, { append, start, end }) {
    console.log('write', fileName, append, start, end);
    const localFile = './tmp/' + fileName;
    const stream = fs.createWriteStream(localFile);
    await this._initalised;
    stream.once('finish', () => {
      //const blob = new Blob (stream.read());
      //this.fileManager.uploadFile(this.realcwd + '/' + fileName, blob, false).then(() => {
      fs.readFile(localFile, (err, data) => {
        if (err) throw err;
        const blob = new Blob([data]);

        console.log(blob);
        this.fileManager
          .uploadFile(this.realcwd + '/' + fileName, blob, false)
          .then(() => {
            console.log('upload complete');

            //clear up local file
            fs.unlink(localFile, (err) => {
              if (err) throw err;
              console.log('successfully cleared ' + localFile);
            });
          });
        // }
        // );
      });
    });
    return Promise.resolve(stream);
  }
}

const port = 21;
const ftpServer = new FtpSrv({
  // blacklist: ['PORT'],
  url: 'ftp://0.0.0.0:' + port,
  anonymous: true,
});

ftpServer.on('login', ({ connection, username, password }, resolve, reject) => {
  return resolve({
    fs: new discordFileSystem(connection, username, password),
    cwd: '/',
  });
});

ftpServer.listen().then(() => {
  console.log('Ftp server is starting...');
});
