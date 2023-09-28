import { WriteStream } from 'fs';
import { DiscordWebhookClient } from './DiscordWebHookClient';
const FILE_CHUNK_SIZE = 25 * 1024 * 1023; // Almost 25MB

async function downloadFromAttachmentUrls(
  attachmentUrls: string[],
  writeStream: WriteStream,
  onProgress = (number: number, filesize: number) =>
    console.log('onProgress not set'),
  fileSize = -1,
  returnBuffer = false,
) {
  console.log(
    `downlading ${attachmentUrls} with a returnBuffer of ${returnBuffer}`,
  );
  let bytesDownloaded = 0;
  if (onProgress) {
    onProgress(0, fileSize);
  }
  if (returnBuffer) {
    console.log('returnBuffer is true');
    for (const attachmentUrl of attachmentUrls) {
      const blob = await (await fetchUrl(attachmentUrl)).arrayBuffer();
      writeStream.write(Buffer.from(blob));
    }
  }

  if (!returnBuffer) {
    for (const attachmentUrl of attachmentUrls) {
      const blob = await fetchUrl(attachmentUrl);
      await writeStream.write(blob);
      bytesDownloaded += blob.size;
      if (onProgress) {
        onProgress(bytesDownloaded, fileSize);
      }
    }
  }
  if (!returnBuffer) {
    await writeStream.close();
  } else {
    // await writeStream();
  }
}

async function fetchUrlFromExtension(url: string): Promise<string | null> {
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
}

async function fetchUrlFromProxy(url: string) {
  return await fetch(url);
}

async function fetchUrl(url: string): Promise<Blob> {
  const extensionResult = await fetchUrlFromExtension(url);
  if (extensionResult !== null) {
    return await (await fetch(extensionResult)).blob();
  }
  return await (await fetchUrlFromProxy(url)).blob();
}

async function* readFile(file: Blob, chunkSize: number) {
  const fileSize = file.size;
  let offset = 0;

  while (offset < fileSize) {
    const blob = file.slice(offset, offset + chunkSize);
    yield await blob.arrayBuffer();
    offset += chunkSize;
  }
}

export class DiscordFileStorage {
  webhookClient: DiscordWebhookClient;

  constructor(webhookUrl: string) {
    this.webhookClient = new DiscordWebhookClient(webhookUrl);
  }

  async getAttachmentUrls(messageIds: string[]) {
    const attachmentUrls = [];
    for (const id of messageIds) {
      const message = await this.webhookClient.getMessage(id);
      attachmentUrls.push(message.attachments[0].url);
    }
    return attachmentUrls;
  }

  async upload(
    sourceFile: Blob,
    namePrefix: string,
    onProgress = (number: number, filesize: number) =>
      console.log('onProgress not set'),
    sendBuffer = false,
  ) {
    console.log(`uploading ${sourceFile} with a sendBuffer of ${sendBuffer}`);
    const messageIds = [];
    let uploadedBytes = 0;
    let index = 0;
    if (onProgress) {
      onProgress(0, sourceFile.size);
    }
    for await (const chunk of readFile(sourceFile, FILE_CHUNK_SIZE)) {
      let result = await this.webhookClient.sendAttachment(
        `${namePrefix}_${index}`,
        new Blob([chunk]),
      );
      messageIds.push(result.id);
      uploadedBytes += chunk.byteLength;
      index++;
      if (onProgress) {
        onProgress(uploadedBytes, sourceFile.size);
      }
    }
    return messageIds;
  }

  async download(
    messageIds: string[],
    writeStream: WriteStream,
    onProgress = (number: number, filesize: number) =>
      console.log('onProgress not set'),
    fileSize = -1,
    returnBuffer = false,
  ) {
    const attachmentUrls = await this.getAttachmentUrls(messageIds);
    await downloadFromAttachmentUrls(
      attachmentUrls,
      writeStream,
      onProgress,
      fileSize,
      returnBuffer,
    );
  }

  async delete(
    messageIds: any,
    onProgress = (number: number, filesize: number) =>
      console.log('onProgress not set'),
  ) {
    let chunksDeleted = 0;
    if (onProgress) {
      onProgress(0, messageIds.length);
    }
    for (const id of messageIds) {
      await this.webhookClient.deleteMessage(id);
      chunksDeleted++;
      if (onProgress) {
        onProgress(chunksDeleted, messageIds.length);
      }
    }
  }
}
