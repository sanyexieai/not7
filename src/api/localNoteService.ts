import { Note, NoteContent } from './noteService';

export class LocalNoteService {
  public dirHandle: FileSystemDirectoryHandle | null = null;
  private metadata: Record<string, any> = {};

  // 让用户选择文件夹
  async selectDirectory() {
    this.dirHandle = await window.showDirectoryPicker();
    await this.loadMetadata();
  }

  // 加载 metadata.json
  private async loadMetadata() {
    if (!this.dirHandle) return;
    try {
      const fileHandle = await this.dirHandle.getFileHandle('metadata.json');
      const file = await fileHandle.getFile();
      this.metadata = JSON.parse(await file.text());
    } catch {
      this.metadata = {};
    }
  }

  // 保存 metadata.json
  private async saveMetadata() {
    if (!this.dirHandle) return;
    const fileHandle = await this.dirHandle.getFileHandle('metadata.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(this.metadata, null, 2));
    await writable.close();
  }

  // 获取所有笔记
  async getNotes(): Promise<Note[]> {
    if (!this.dirHandle) {
      await this.selectDirectory();
      if (!this.dirHandle) return [];
    }
    await this.loadMetadata();
    const notes: Note[] = [];
    for await (const entry of this.dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        const meta = this.metadata[entry.name] || {};
        notes.push({
          id: entry.name,
          key: entry.name,
          bucket_name: 'local',
          size: 0,
          etag: '',
          content_type: 'text/markdown',
          created_at: meta.created_at || '',
          last_modified: meta.updated_at || '',
          user_metadata: meta,
        });
      }
    }
    return notes;
  }

  // 获取笔记内容
  async getNoteContent(key: string): Promise<NoteContent | null> {
    if (!this.dirHandle) {
      await this.selectDirectory();
      if (!this.dirHandle) return null;
    }
    try {
      const fileHandle = await this.dirHandle.getFileHandle(key);
      const file = await fileHandle.getFile();
      const content = await file.text();
      const meta = this.metadata[key] || {};
      return {
        title: meta.title || '',
        content,
        created_at: meta.created_at || '',
        updated_at: meta.updated_at || '',
      };
    } catch {
      return null;
    }
  }

  // 创建新笔记
  async createNote(title: string, content: string = '', parentId: string = '', extraMeta: Record<string, any> = {}): Promise<Note | null> {
    if (!this.dirHandle) {
      await this.selectDirectory();
      if (!this.dirHandle) return null;
    }
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.md`;
    const now = new Date().toISOString();
    this.metadata[key] = {
      title,
      parent_id: parentId,
      ...extraMeta,
      created_at: now,
      updated_at: now,
    };
    await this.saveMetadata();
    await this.saveFile(key, content);
    return {
      id: key,
      key,
      bucket_name: 'local',
      size: content.length,
      etag: '',
      content_type: 'text/markdown',
      created_at: now,
      last_modified: now,
      user_metadata: this.metadata[key],
    };
  }

  // 保存笔记内容
  async saveNote(key: string, title: string, content: string, parentId: string = '', extraMeta: Record<string, any> = {}): Promise<Note | null> {
    if (!this.dirHandle) {
      await this.selectDirectory();
      if (!this.dirHandle) return null;
    }
    const now = new Date().toISOString();
    this.metadata[key] = {
      ...(this.metadata[key] || {}),
      title,
      parent_id: parentId,
      ...extraMeta,
      updated_at: now,
    };
    await this.saveMetadata();
    await this.saveFile(key, content);
    return {
      id: key,
      key,
      bucket_name: 'local',
      size: content.length,
      etag: '',
      content_type: 'text/markdown',
      created_at: this.metadata[key].created_at || now,
      last_modified: now,
      user_metadata: this.metadata[key],
    };
  }

  // 删除笔记
  async deleteNote(key: string): Promise<boolean> {
    if (!this.dirHandle) {
      await this.selectDirectory();
      if (!this.dirHandle) return false;
    }
    try {
      await this.dirHandle.removeEntry(key);
      delete this.metadata[key];
      await this.saveMetadata();
      return true;
    } catch {
      return false;
    }
  }

  // 更新笔记
  async updateNote(key: string, title: string, content: string): Promise<Note | null> {
    return this.saveNote(key, title, content, this.metadata[key]?.parent_id || '');
  }

  // 只更新元数据
  async updateNoteTitle(key: string, title: string, extraMeta: Record<string, any> = {}): Promise<Note | null> {
    if (!this.dirHandle) {
      await this.selectDirectory();
      if (!this.dirHandle) return null;
    }
    this.metadata[key] = {
      ...(this.metadata[key] || {}),
      title,
      ...extraMeta,
      updated_at: new Date().toISOString(),
    };
    await this.saveMetadata();
    return {
      id: key,
      key,
      bucket_name: 'local',
      size: 0,
      etag: '',
      content_type: 'text/markdown',
      created_at: this.metadata[key].created_at || '',
      last_modified: this.metadata[key].updated_at || '',
      user_metadata: this.metadata[key],
    };
  }

  // 获取元数据
  async getNoteMetadata(key: string): Promise<Note | null> {
    if (!this.dirHandle) {
      await this.selectDirectory();
      if (!this.dirHandle) return null;
    }
    const meta = this.metadata[key];
    if (!meta) return null;
    return {
      id: key,
      key,
      bucket_name: 'local',
      size: 0,
      etag: '',
      content_type: 'text/markdown',
      created_at: meta.created_at || '',
      last_modified: meta.updated_at || '',
      user_metadata: meta,
    };
  }

  // 辅助：保存文件
  private async saveFile(key: string, content: string) {
    if (!this.dirHandle) return;
    const fileHandle = await this.dirHandle.getFileHandle(key, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }
}
