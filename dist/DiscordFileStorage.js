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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordFileStorage = void 0;
const DiscordWebHookClient_1 = require("./DiscordWebHookClient");
const FILE_CHUNK_SIZE = 25 * 1024 * 1023; // Almost 25MB
function downloadFromAttachmentUrls(attachmentUrls, writeStream, onProgress = (number, filesize) => console.log('onProgress not set'), fileSize = -1, returnBuffer = false) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`downlading ${attachmentUrls} with a returnBuffer of ${returnBuffer}`);
        let bytesDownloaded = 0;
        if (onProgress) {
            onProgress(0, fileSize);
        }
        if (returnBuffer) {
            console.log('returnBuffer is true');
            for (const attachmentUrl of attachmentUrls) {
                const blob = yield (yield fetchUrl(attachmentUrl)).arrayBuffer();
                writeStream.write(Buffer.from(blob));
            }
        }
        if (!returnBuffer) {
            for (const attachmentUrl of attachmentUrls) {
                const blob = yield fetchUrl(attachmentUrl);
                yield writeStream.write(blob);
                bytesDownloaded += blob.size;
                if (onProgress) {
                    onProgress(bytesDownloaded, fileSize);
                }
            }
        }
        if (!returnBuffer) {
            yield writeStream.close();
        }
        else {
            // await writeStream();
        }
    });
}
function fetchUrlFromExtension(url) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            /*try {
                chrome?.runtime.sendMessage(
                  'jklpfhklkhbfgeencifbmkoiaokeieah',
                  { message: { url } },
                  (response) => {
                    if (!response || !('data' in response)) {
                      resolve(null);
                    }
                    resolve(response.data);
                  },
                );
              } catch (e) {
                resolve(null);
              }
            });*/
            resolve(null);
        });
    });
}
function fetchUrlFromProxy(url) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield fetch(url);
    });
}
function fetchUrl(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const extensionResult = yield fetchUrlFromExtension(url);
        if (extensionResult !== null) {
            return yield (yield fetch(extensionResult)).blob();
        }
        return yield (yield fetchUrlFromProxy(url)).blob();
    });
}
function readFile(file, chunkSize) {
    return __asyncGenerator(this, arguments, function* readFile_1() {
        const fileSize = file.size;
        let offset = 0;
        while (offset < fileSize) {
            const blob = file.slice(offset, offset + chunkSize);
            yield yield __await(yield __await(blob.arrayBuffer()));
            offset += chunkSize;
        }
    });
}
class DiscordFileStorage {
    constructor(webhookUrl) {
        this.webhookClient = new DiscordWebHookClient_1.DiscordWebhookClient(webhookUrl);
    }
    getAttachmentUrls(messageIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const attachmentUrls = [];
            for (const id of messageIds) {
                const message = yield this.webhookClient.getMessage(id);
                const url = message.attachments[0].url;
                const urlObj = new URL(url);
                const shortenedUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
                attachmentUrls.push(shortenedUrl);
            }
            return attachmentUrls;
        });
    }
    upload(sourceFile, namePrefix, onProgress = (number, filesize) => console.log('onProgress not set'), sendBuffer = false) {
        var _a, e_1, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`uploading ${sourceFile} with a sendBuffer of ${sendBuffer}`);
            const messageIds = [];
            let uploadedBytes = 0;
            let index = 0;
            if (onProgress) {
                onProgress(0, sourceFile.size);
            }
            try {
                for (var _d = true, _e = __asyncValues(readFile(sourceFile, FILE_CHUNK_SIZE)), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const chunk = _c;
                    let result = yield this.webhookClient.sendAttachment(`${namePrefix}_${index}`, new Blob([chunk]));
                    messageIds.push(result.id);
                    uploadedBytes += chunk.byteLength;
                    index++;
                    if (onProgress) {
                        onProgress(uploadedBytes, sourceFile.size);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return messageIds;
        });
    }
    download(messageIds, writeStream, onProgress = (number, filesize) => console.log('onProgress not set'), fileSize = -1, returnBuffer = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const attachmentUrls = yield this.getAttachmentUrls(messageIds);
            yield downloadFromAttachmentUrls(attachmentUrls, writeStream, onProgress, fileSize, returnBuffer);
        });
    }
    delete(messageIds, onProgress = (number, filesize) => console.log('onProgress not set')) {
        return __awaiter(this, void 0, void 0, function* () {
            let chunksDeleted = 0;
            if (onProgress) {
                onProgress(0, messageIds.length);
            }
            for (const id of messageIds) {
                yield this.webhookClient.deleteMessage(id);
                chunksDeleted++;
                if (onProgress) {
                    onProgress(chunksDeleted, messageIds.length);
                }
            }
        });
    }
}
exports.DiscordFileStorage = DiscordFileStorage;
