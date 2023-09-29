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
exports.DiscordWebhookClient = void 0;
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => setTimeout(resolve, ms));
    });
}
class DiscordWebhookClient {
    constructor(webhookUrl) {
        const id = webhookUrl.split('/').slice(0, -1).pop();
        const token = webhookUrl.split('/').pop();
        this.baseUrl = `https://discordapp.com/api/webhooks/${id}/${token}`;
        this.rateLimitWaits = {};
    }
    fetchFromApi(path, { type, method, body }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.rateLimitWaits[type] > 0) {
                console.log(`Waiting ${this.rateLimitWaits[type]}ms for rate limit to reset`);
                yield sleep(this.rateLimitWaits[type]);
            }
            const response = yield fetch(`${this.baseUrl}${path}`, {
                method,
                body,
            });
            const { headers } = response;
            const remainingRequests = Number(headers.get('X-RateLimit-Remaining'));
            const resetAfter = Number(headers.get('X-RateLimit-Reset-After'));
            this.rateLimitWaits[type] = remainingRequests === 0 ? resetAfter * 1000 : 0;
            const { status } = response;
            if (status === 429) {
                const responseJson = yield response.json();
                const retryAfter = responseJson.retry_after;
                this.rateLimitWaits[type] = retryAfter * 1000;
                console.log('Rate limit exceeded, retrying');
                return yield this.fetchFromApi(path, { method, body, type });
            }
            if (status >= 400) {
                throw new Error(`Failed to ${type} with status ${status}: ${yield response.text()}`);
            }
            return response;
        });
    }
    sendAttachment(filename, blob) {
        return __awaiter(this, void 0, void 0, function* () {
            const formData = new FormData();
            formData.append('payload_json', JSON.stringify({}));
            formData.append('file', blob, filename);
            const response = yield this.fetchFromApi('?wait=true', {
                type: 'sendAttachment',
                method: 'POST',
                body: formData,
            });
            return yield response.json();
        });
    }
    getMessage(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetchFromApi(`/messages/${id}`, {
                type: 'getMessage',
                method: 'GET',
            });
            return yield response.json();
        });
    }
    deleteMessage(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.fetchFromApi(`/messages/${id}`, {
                type: 'deleteMessage',
                method: 'DELETE',
            });
        });
    }
}
exports.DiscordWebhookClient = DiscordWebhookClient;
