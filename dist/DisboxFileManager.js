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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisboxFileManager = void 0;
const DiscordFileStorage_1 = require("./DiscordFileStorage");
const js_sha256_1 = require("js-sha256");
const FILE_DELIMITER = '/';
const SERVER_URL = 'https://disboxserver.azurewebsites.net';
class DisboxFileManager {
    static create(webhookUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = new URL(webhookUrl);
            const fileTrees = {};
            // Handle Discord changing webhook URLs
            for (const hostname of ['discord.com', 'discordapp.com']) {
                url.hostname = hostname;
                const result = yield fetch(`${SERVER_URL}/files/get/${(0, js_sha256_1.sha256)(url.href)}`);
                if (result.status === 200) {
                    fileTrees[url.href] = yield result.json();
                }
            }
            if (Object.keys(fileTrees).length === 0) {
                throw new Error('Failed to get files for user.');
            }
            // If one of them has entries, choose it no matter what the entered URL was.
            const [chosenUrl, fileTree] = Object.entries(fileTrees).sort((f1, f2) => Object.keys(f2[1]).length - Object.keys(f1[1]).length)[0];
            return new this((0, js_sha256_1.sha256)(chosenUrl), new DiscordFileStorage_1.DiscordFileStorage(webhookUrl), fileTree);
        });
    }
    constructor(userId, storage, fileTree) {
        this.userId = userId;
        this.discordFileStorage = storage;
        this.fileTree = fileTree;
    }
    getFile(path, copy = true) {
        let file = this.fileTree;
        let pathParts = path.split(FILE_DELIMITER);
        pathParts.shift(); // remove first empty part
        for (let i = 0; i < pathParts.length; i++) {
            if (file.children[pathParts[i]]) {
                file = file.children[pathParts[i]];
            }
            else {
                return null;
            }
        }
        if (copy) {
            return Object.assign(Object.assign({}, file), { path });
        }
        else {
            return file;
        }
    }
    getChildren(path) {
        let children = {};
        if (path === '') {
            children = this.fileTree.children || {};
        }
        else {
            const file = this.getFile(path);
            if (!file) {
                throw new Error(`File not found: ${path}`);
            }
            if (file.type !== 'directory') {
                throw new Error(`File is not a directory: ${path}`);
            }
            children = file.children || {};
        }
        const parsedChildren = {};
        for (const child in children) {
            const childPath = `${path}${FILE_DELIMITER}${child}`;
            parsedChildren[child] = Object.assign(Object.assign({}, children[child]), { path: childPath });
        }
        return parsedChildren;
    }
    getParent(path) {
        if (!path.includes(FILE_DELIMITER)) {
            return null;
        }
        if (path.split(FILE_DELIMITER).length === 2) {
            return this.fileTree;
        }
        const parentPath = path
            .split(FILE_DELIMITER)
            .slice(0, -1)
            .join(FILE_DELIMITER);
        return this.getFile(parentPath);
    }
    updateFile(path, changes, newPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.getFile(path, false);
            if (!file) {
                throw new Error(`File not found: ${path}`);
            }
            const { id } = file;
            if (!changes.updated_at) {
                changes.updated_at = new Date().toISOString();
            }
            const result = yield fetch(`${SERVER_URL}/files/update/${this.userId}/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(changes),
            });
            if (result.status !== 200) {
                throw new Error(`Error updating file: ${result.status} ${result.statusText}`);
            }
            const newFile = yield this.getFile(newPath || path);
            return newFile;
        });
    }
    renameFile(path, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.getFile(path);
            if (!file) {
                throw new Error(`File not found: ${path}`);
            }
            const newPath = path.replace(file.name, newName);
            const newFile = this.getFile(newPath);
            if (newFile) {
                throw new Error(`File already exists: ${newPath}`);
            }
            const changes = yield this.updateFile(file.path, { name: newName });
            const parent = this.getParent(path);
            delete parent.children[file.name];
            parent.children[newName] = changes;
            parent.children[newName].name = newName;
            return this.getFile(newPath);
        });
    }
    moveFile(path, newParentPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.getFile(path);
            if (!file) {
                throw new Error(`File not found: ${path}`);
            }
            const parent = this.getParent(path);
            const newParent = this.getFile(newParentPath);
            if (!newParent) {
                throw new Error(`Parent directory not found: ${newParentPath}`);
            }
            if (newParent.type !== 'directory') {
                throw new Error(`Parent is not a directory: ${newParentPath}`);
            }
            const newPath = newParentPath + FILE_DELIMITER + file.name;
            const newFile = this.getFile(newPath);
            if (newFile) {
                throw new Error(`File already exists: ${newPath}`);
            }
            const changes = yield this.updateFile(file.path, {
                parent_id: newParent.id,
            });
            if (newParent.children) {
                delete parent.children[file.name];
                newParent.children[file.name] = file;
            }
            return changes;
        });
    }
    // TODO: Delete a non-empty directory?
    deleteFile(path, onProgress = (number, filesize) => console.log('onProgress not set')) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.getFile(path);
            if (!file) {
                throw new Error(`File not found: ${path}`);
            }
            if (file.type === 'directory') {
                const children = this.getChildren(path);
                if (Object.keys(children).length > 0) {
                    throw new Error(`Directory is not empty: ${path}`);
                }
            }
            const result = yield fetch(`${SERVER_URL}/files/delete/${this.userId}/${file.id}`, {
                method: 'DELETE',
            });
            if (result.status !== 200) {
                throw new Error(`Error deleting file: ${result.status} ${result.statusText}`);
            }
            if (file.type === 'file' && file.content) {
                yield this.discordFileStorage.delete(JSON.parse(file.content), onProgress);
                const parent = this.getParent(path);
                delete parent.children[file.name];
                return yield result.json();
            }
            if (onProgress) {
                onProgress(1, 1);
            }
        });
    }
    createDirectory(path) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createFile(path, 'directory');
        });
    }
    createFile(path, type = 'file') {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.getFile(path);
            if (file) {
                throw new Error(`File already exists: ${path}`);
            }
            const name = path.split(FILE_DELIMITER).slice(-1)[0];
            const parentFile = this.getParent(path);
            const extra = type === 'directory' ? { children: {} } : {};
            const newFile = {
                parent_id: parentFile.id,
                name,
                type,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const result = yield fetch(`${SERVER_URL}/files/create/${this.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newFile),
            });
            if (result.status !== 200) {
                throw new Error(`Error creating file: ${result.status} ${result.statusText}`);
            }
            const newFileId = Number(yield result.text());
            parentFile.children[name] = Object.assign(Object.assign(Object.assign({}, newFile), extra), { id: newFileId });
            return this.getFile(path);
        });
    }
    uploadFile(path, fileBlob, onProgress = (number, filesize) => console.log('onProgress not set'), sendBuffer = false) {
        return __awaiter(this, void 0, void 0, function* () {
            let file = this.getFile(path);
            while (!file) {
                yield this.createFile(path);
                file = this.getFile(path);
            }
            if (file.type === 'directory') {
                throw new Error(`Directory can't have content: ${path}`);
            }
            const contentReferences = yield this.discordFileStorage.upload(fileBlob, file.id.toString(), onProgress, sendBuffer);
            yield this.updateFile(file.path, {
                size: fileBlob.size,
                content: JSON.stringify(contentReferences),
            });
            if (onProgress) {
                onProgress(1, 1);
            }
            return file;
        });
    }
    downloadFile(path, writeStream, onProgress = (number, filesize) => console.log('onProgress not set'), returnBuffer = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.getFile(path);
            if (!file) {
                throw new Error(`File not found: ${path}`);
            }
            if (file.type === 'directory') {
                throw new Error(`Cannot download content from directory: ${path}`);
            }
            if (file.content === null) {
                throw new Error(`File has no content: ${path}`);
            }
            const contentReferences = JSON.parse(file.content);
            yield this.discordFileStorage.download(contentReferences, writeStream, onProgress, file.size || 0, returnBuffer);
            if (onProgress) {
                // Reconsider this
                onProgress(1, 1);
            }
        });
    }
    getAttachmentUrls(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.getFile(path);
            if (!file) {
                throw new Error(`File not found: ${path}`);
            }
            if (file.type === 'directory') {
                throw new Error(`Cannot share directory: ${path}`);
            }
            const contentReferences = JSON.parse(file.content || '');
            return yield this.discordFileStorage.getAttachmentUrls(contentReferences);
        });
    }
}
exports.DisboxFileManager = DisboxFileManager;
