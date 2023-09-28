import { DiscordFileStorage } from './DiscordFileStorage';
import { z } from 'zod';
import {
  FileTreeSchema,
  FileTreeArraySchema,
  UpdatableFieldsSchema,
} from './schemas';
import { sha256 } from 'js-sha256';
import { WriteStream } from 'fs';
const FILE_DELIMITER = '/';
const SERVER_URL = 'https://disboxserver.azurewebsites.net';

export class DisboxFileManager {
  userId: string;
  discordFileStorage: DiscordFileStorage;
  fileTree: any;

  static async create(webhookUrl: string) {
    const url = new URL(webhookUrl);
    const fileTrees = {} as z.infer<typeof FileTreeArraySchema>;

    // Handle Discord changing webhook URLs
    for (const hostname of ['discord.com', 'discordapp.com']) {
      url.hostname = hostname;
      const result = await fetch(`${SERVER_URL}/files/get/${sha256(url.href)}`);
      if (result.status === 200) {
        fileTrees[url.href] = await result.json();
      }
    }
    if (Object.keys(fileTrees).length === 0) {
      throw new Error('Failed to get files for user.');
    }

    // If one of them has entries, choose it no matter what the entered URL was.
    const [chosenUrl, fileTree] = Object.entries(fileTrees).sort(
      (f1, f2) => Object.keys(f2[1]).length - Object.keys(f1[1]).length,
    )[0];

    return new this(
      sha256(chosenUrl),
      new DiscordFileStorage(webhookUrl),
      fileTree,
    );
  }

  constructor(
    userId: string,
    storage: DiscordFileStorage,
    fileTree: z.infer<typeof FileTreeSchema>,
  ) {
    this.userId = userId;
    this.discordFileStorage = storage;
    this.fileTree = fileTree;
  }

  getFile(path: string, copy = true): z.infer<typeof FileTreeSchema> | null {
    let file = this.fileTree;
    const pathParts = path.split(FILE_DELIMITER);
    pathParts.shift(); // remove first empty part
    for (let i = 0; i < pathParts.length; i++) {
      if (file.children[pathParts[i]]) {
        file = file.children[pathParts[i]];
      } else {
        return null;
      }
    }
    if (copy) {
      return { ...file, path };
    }
    return file;
  }

  getChildren(path: string) {
    let children = {} as z.infer<typeof FileTreeArraySchema>;
    if (path === '') {
      children = this.fileTree.children || {};
    } else {
      const file = this.getFile(path);
      if (!file) {
        throw new Error(`File not found: ${path}`);
      }
      if (file.type !== 'directory') {
        throw new Error(`File is not a directory: ${path}`);
      }
      children = file.children || {};
    }

    const parsedChildren = {} as z.infer<typeof FileTreeArraySchema>;
    for (const child in children) {
      const childPath = `${path}${FILE_DELIMITER}${child}`;
      parsedChildren[child] = { ...children[child], path: childPath };
    }
    return parsedChildren;
  }

  getParent(path: string) {
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

  async updateFile(
    path: string,
    changes: z.infer<typeof UpdatableFieldsSchema>,
  ) {
    const file = this.getFile(path, false);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    const { id } = file;
    if (!changes.updated_at) {
      changes.updated_at = new Date().toISOString();
    }
    const result = await fetch(
      `${SERVER_URL}/files/update/${this.userId}/${id}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changes),
      },
    );
    if (result.status !== 200) {
      throw new Error(
        `Error updating file: ${result.status} ${result.statusText}`,
      );
    }
    const newFile = await this.getFile(path);
    return newFile;
  }

  async renameFile(path: string, newName: string) {
    const file = this.getFile(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    const newPath = path.replace(file.name, newName);
    const newFile = this.getFile(newPath);
    if (newFile) {
      throw new Error(`File already exists: ${newPath}`);
    }
    const changes = await this.updateFile(file.path, { name: newName });

    const parent = this.getParent(path);
    delete parent.children[file.name];
    //parent.children[changes.name] = changes;

    return this.getFile(newPath);
  }

  async moveFile(path: string, newParentPath: string) {
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
    const changes = await this.updateFile(file.path, {
      parent_id: newParent.id,
    });

    if (newParent.children) {
      delete parent.children[file.name];
      newParent.children[file.name] = file;
    }
    return changes;
  }

  // TODO: Delete a non-empty directory?
  async deleteFile(
    path: string,
    onProgress = (number: number, filesize: number) =>
      console.log('onProgress not set'),
  ) {
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
    const result = await fetch(
      `${SERVER_URL}/files/delete/${this.userId}/${file.id}`,
      {
        method: 'DELETE',
      },
    );
    if (result.status !== 200) {
      throw new Error(
        `Error deleting file: ${result.status} ${result.statusText}`,
      );
    }
    if (file.type === 'file' && file.content) {
      await this.discordFileStorage.delete(
        JSON.parse(file.content),
        onProgress,
      );
      const parent = this.getParent(path);
      delete parent.children[file.name];
      return await result.json();
    }
    if (onProgress) {
      onProgress(1, 1);
    }
  }

  async createDirectory(path: string) {
    await this.createFile(path, 'directory');
  }

  async createFile(path: string, type = 'file') {
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

    const result = await fetch(`${SERVER_URL}/files/create/${this.userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newFile),
    });
    if (result.status !== 200) {
      throw new Error(
        `Error creating file: ${result.status} ${result.statusText}`,
      );
    }
    const newFileId = Number(await result.text());
    parentFile.children[name] = { ...newFile, ...extra, id: newFileId };
    return this.getFile(path);
  }

  async uploadFile(
    path: string,
    fileBlob: Blob,
    onProgress = (number: number, filesize: number) =>
      console.log('onProgress not set'),
    sendBuffer = false,
  ) {
    let file = this.getFile(path);
    while (!file) {
      await this.createFile(path);
      file = this.getFile(path);
    }
    if (file.type === 'directory') {
      throw new Error(`Directory can't have content: ${path}`);
    }
    const contentReferences = await this.discordFileStorage.upload(
      fileBlob,
      file.id.toString(),
      onProgress,
      sendBuffer,
    );
    await this.updateFile(file.path, {
      size: fileBlob.size,
      content: JSON.stringify(contentReferences),
    });

    if (onProgress) {
      onProgress(1, 1);
    }
    return file;
  }

  async downloadFile(
    path: string,
    writeStream: WriteStream,
    onProgress = (number: number, filesize: number) =>
      console.log('onProgress not set'),
    returnBuffer = false,
  ) {
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
    await this.discordFileStorage.download(
      contentReferences,
      writeStream,
      onProgress,
      file.size || 0,
      returnBuffer,
    );

    if (onProgress) {
      // Reconsider this
      onProgress(1, 1);
    }
  }

  async getAttachmentUrls(path: string) {
    const file = this.getFile(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    if (file.type === 'directory') {
      throw new Error(`Cannot share directory: ${path}`);
    }

    const contentReferences = JSON.parse(file.content || '');
    return await this.discordFileStorage.getAttachmentUrls(contentReferences);
  }
}
