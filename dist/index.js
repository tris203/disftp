"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Quick start, create an active ftp server.
const ftp_srv_1 = __importDefault(require("ftp-srv"));
const ftp_srv_2 = __importDefault(require("ftp-srv"));
const stream_1 = __importDefault(require("stream"));
const fs_1 = __importDefault(require("fs"));
const DisboxFileManager_1 = require("./DisboxFileManager");
class DiscordFileSystem extends ftp_srv_2.default {
    constructor(connection, username, password) {
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
    intialiseFileManager(username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            this.fileManager = yield DisboxFileManager_1.DisboxFileManager.create(`https://discord.com/api/webhooks/${username}/${password}`);
        });
    }
    currentDirectory() {
        if (this.realcwd === '') {
            return '/';
        }
        return this.realcwd;
    }
    get(fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initalised;
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
            this.files = yield this.fileManager.getChildren('');
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
        });
    }
    list(path) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initalised;
            if (this.realcwd === '/') {
                this.files = yield this.fileManager.getChildren('');
            }
            else {
                this.files = yield this.fileManager.getChildren(this.realcwd);
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
        });
    }
    chdir(path) {
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
        return Promise.resolve(this.realcwd);
    }
    mkdir(path) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initalised;
            yield this.fileManager.createDirectory(`${this.realcwd}/${path}`);
            return Promise.resolve();
        });
    }
    rename(oldPath, newPath) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initalised;
            const newFilename = newPath.split('/').pop();
            yield this.fileManager.renameFile(oldPath, newFilename);
        });
    }
    read(fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initalised;
            const passThrough = new stream_1.default.PassThrough();
            this.fileManager
                .downloadFile(`${this.realcwd}/${fileName}`, passThrough, false, true)
                .then(() => {
                passThrough.end();
                console.log('download complete');
            });
            return Promise.resolve(passThrough);
        });
    }
    write(fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const localFile = `./tmp/${fileName}`;
            const stream = fs_1.default.createWriteStream(localFile);
            yield this.initalised;
            stream.once('finish', () => {
                // const blob = new Blob (stream.read());
                // this.fileManager.uploadFile(this.realcwd + '/' + fileName, blob, false).then(() => {
                fs_1.default.readFile(localFile, (readerr, data) => {
                    if (readerr)
                        throw readerr;
                    const blob = new Blob([data]);
                    this.fileManager
                        .uploadFile(`${this.realcwd}/${fileName}`, blob, false)
                        .then(() => {
                        console.log('upload complete');
                        // clear up local file
                        fs_1.default.unlink(localFile, (unlinkerr) => {
                            if (unlinkerr)
                                throw unlinkerr;
                        });
                    });
                    // }
                    // );
                });
            });
            return Promise.resolve(stream);
        });
    }
    delete(fileName) {
        return Promise.resolve('');
    }
    chmod(fileName) {
        return Promise.resolve('');
    }
    getUniqueName(fileName) {
        return fileName;
    }
}
const port = 21;
const hostname = '0.0.0.0';
const ftpServer = new ftp_srv_1.default({
    // blacklist: ['PORT'],
    url: `ftp://${hostname}:${port}`,
    pasv_url: `${process.env.PASV_HOSTNAME}`,
    pasv_min: 65500,
    pasv_max: 65515,
});
ftpServer.on('login', ({ connection, username, password }, resolve) => resolve({
    fs: new DiscordFileSystem(connection, username, password),
    cwd: '/',
}));
ftpServer.listen().then(() => {
    // eslint-disable-next-line no-console
    console.log('Ftp server is starting...');
    console.log(`Listening on ${hostname}:${port} with pasv on ${process.env.PASV_HOSTNAME}`);
});
