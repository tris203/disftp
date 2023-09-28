import {
  RESTPostAPIWebhookWithTokenWaitResult,
  RESTGetAPIWebhookWithTokenMessageResult,
} from 'discord-api-types/v10';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DiscordWebhookClient {
  baseUrl: string;
  rateLimitWaits: { [key: string]: number };

  constructor(webhookUrl: string) {
    const id = webhookUrl.split('/').slice(0, -1).pop();
    const token = webhookUrl.split('/').pop();
    this.baseUrl = `https://discordapp.com/api/webhooks/${id}/${token}`;
    this.rateLimitWaits = {};
  }

  async fetchFromApi(
    path: string,
    { type, method, body }: { type: string; method: string; body?: FormData },
  ): Promise<Response> {
    if (this.rateLimitWaits[type] > 0) {
      console.log(
        `Waiting ${this.rateLimitWaits[type]}ms for rate limit to reset`,
      );
      await sleep(this.rateLimitWaits[type]);
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      body,
    });
    const { headers } = response;
    const remainingRequests = Number(headers.get('X-RateLimit-Remaining'));
    const resetAfter = Number(headers.get('X-RateLimit-Reset-After'));
    this.rateLimitWaits[type] = remainingRequests === 0 ? resetAfter * 1000 : 0;

    const { status } = response;
    if (status === 429) {
      const responseJson = await response.json();
      const retryAfter = responseJson.retry_after;
      this.rateLimitWaits[type] = retryAfter * 1000;
      console.log('Rate limit exceeded, retrying');
      return await this.fetchFromApi(path, { method, body, type });
    }
    if (status >= 400) {
      throw new Error(
        `Failed to ${type} with status ${status}: ${await response.text()}`,
      );
    }
    return response;
  }

  async sendAttachment(
    filename: string,
    blob: Blob,
  ): Promise<RESTPostAPIWebhookWithTokenWaitResult> {
    const formData = new FormData();
    formData.append('payload_json', JSON.stringify({}));
    formData.append('file', blob, filename);
    const response = await this.fetchFromApi('?wait=true', {
      type: 'sendAttachment',
      method: 'POST',
      body: formData,
    });
    return await response.json();
  }

  async getMessage(
    id: string,
  ): Promise<RESTGetAPIWebhookWithTokenMessageResult> {
    const response = await this.fetchFromApi(`/messages/${id}`, {
      type: 'getMessage',
      method: 'GET',
    });
    return await response.json();
  }

  async deleteMessage(id: number): Promise<void> {
    await this.fetchFromApi(`/messages/${id}`, {
      type: 'deleteMessage',
      method: 'DELETE',
    });
  }
}
