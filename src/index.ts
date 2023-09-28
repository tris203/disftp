// Quick start, create an active ftp server.
import FtpSrv, { FtpConnection, FtpServerOptions } from 'ftp-srv';
import FileSystem from 'ftp-srv';
import Stream from 'stream';
import fs from 'fs';
import { DisboxFileManager } from './DisboxFileManager';

class DiscordFileSystem extends FileSystem {
  connection: any;
  username: string;
  password: string;
  fileManager: any;
  files: any[];
  realcwd: string;
  initalised: Promise<void>;
  root: string;
  cwd: string;

  constructor(
    connection: FtpServerOptions | FtpConnection,
    username: string,
    password: string,
  ) {
    super(connection);
    this.connection = connection;
    this.username = username;
    this.password = password;
    this.root = '/';
    this.files = [];
    this.realcwd = '';
    this.cwd = this.realcwd;
    this.initalised = this.intialiseFileManager(username, password);
  }

  async intialiseFileManager(username: string, password: string) {
    this.fileManager = await DisboxFileManager.create(
      `https://discord.com/api/webhooks/${username}/${password}`,
    );
  }

  currentDirectory() {
    if (this.realcwd === '') {
      return '/';
    }
    return this.realcwd;
  }

  async get(fileName: string) {
    await this.initalised;
    if (fileName === '.') {
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
      if (file.name === fileName) {
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
      return Promise.resolve();
    });
    return Promise.resolve();
  }

  async list() {
    await this.initalised;
    if (this.realcwd === '/') {
      this.files = this.fileManager.getChildren('');
    } else {
      this.files = this.fileManager.getChildren(this.realcwd);
    }
    const fileList = Object.values(this.files).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      atime: file.updated_at,
      mtime: file.updated_at,
      ctime: file.created_at,
      isDirectory: () => file.type === 'directory',
    }));
    return Promise.resolve(fileList);
  }

  chdir(path: string) {
    switch (true) {
      case path === '..':
        this.realcwd = this.realcwd.replace(/\/[^/]+$/, '');
        break;
      case path === '/':
        this.realcwd = '';
        break;
      case path.startsWith('/'):
        this.realcwd = path;
        break;
      default:
        this.realcwd = `${this.realcwd}/${path}`;
        this.realcwd = this.realcwd.replace(/\/+/g, '/'); // remove double slashes
        this.realcwd = this.realcwd.replace(/\/+$/, ''); // remove trailing slash
        break;
    }
    return Promise.resolve('');
  }

  async mkdir(path: string) {
    await this.initalised;
    this.fileManager.createDirectory(`${this.realcwd}/${path}`);
    return Promise.resolve();
  }

  async rename(oldPath: string, newPath: string) {
    await this.initalised;
    const newFilename = newPath.split('/').pop();
    this.fileManager.renameFile(oldPath, newFilename);
    return Promise.resolve();
  }

  async read(fileName: string) {
    await this.initalised;
    const passThrough = new Stream.PassThrough();
    this.fileManager
      .downloadFile(`${this.realcwd}/${fileName}`, passThrough, false, true)
      .then(() => {
        passThrough.end();
        console.log('donwload complete');
      });
    return Promise.resolve(passThrough);
  }

  async write(fileName: string) {
    const localFile = `./tmp/${fileName}`;
    const stream = fs.createWriteStream(localFile);
    await this.initalised;
    stream.once('finish', () => {
      // const blob = new Blob (stream.read());
      // this.fileManager.uploadFile(this.realcwd + '/' + fileName, blob, false).then(() => {
      fs.readFile(localFile, (readerr, data) => {
        if (readerr) throw readerr;
        const blob = new Blob([data]);
        this.fileManager
          .uploadFile(`${this.realcwd}/${fileName}`, blob, false)
          .then(() => {
            console.log('upload complete');

            // clear up local file
            fs.unlink(localFile, (unlinkerr) => {
              if (unlinkerr) throw unlinkerr;
            });
          });
        // }
        // );
      });
    });
    return Promise.resolve(stream);
  }
  delete(fileName: string) {
    return Promise.resolve();
  }
  chmod(fileName: string) {
    return Promise.resolve('');
  }
  getUniqueName(fileName: string) {
    return fileName;
  }
}

const port = 21;
const ftpServer = new FtpSrv({
  // blacklist: ['PORT'],
  url: `ftp://0.0.0.0:${port}`,
  anonymous: true,
});

ftpServer.on('login', ({ connection, username, password }, resolve) =>
  resolve({
    fs: new DiscordFileSystem(connection, username, password),
    cwd: '/',
  }),
);

ftpServer.listen().then(() => {
  // eslint-disable-next-line no-console
  console.log('Ftp server is starting...');
});
