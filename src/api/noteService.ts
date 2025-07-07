import axios from 'axios';
import { LocalNoteService } from './localNoteService';
import { ref } from 'vue';

const API_BASE = 'http://127.0.0.1:8000/api';
const BUCKET_NAME = 'not7';

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export interface Note {
  id: string;
  key: string;
  bucket_name: string;
  size: number;
  etag: string;
  content_type: string;
  created_at: string;
  last_modified: string;
  user_metadata: Record<string, any>;
}

export interface NoteContent {
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ========== 自动切换逻辑 ===========
export type NoteServiceType = 'remote' | 'local';

export const currentMode = ref<NoteServiceType>('remote');
const localNoteService = new LocalNoteService();
let remoteNoteService: NoteService | null = null;

export function getNoteService() {
  return currentMode.value === 'remote' ? remoteNoteService : localNoteService;
}

export function setNoteServiceMode(mode: NoteServiceType) {
  currentMode.value = mode;
}

export function getNoteServiceMode() {
  return currentMode.value;
}

export async function trySwitchToLocalMode() {
  setNoteServiceMode('local');
}

// ========== NoteService 原有实现 ===========
class NoteService {
  private bucketName = BUCKET_NAME;

  // 确保桶存在
  async ensureBucketExists(): Promise<void> {
    try {
      await apiClient.get(`/buckets/${this.bucketName}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // 桶不存在，创建它
        await apiClient.post('/buckets', { name: this.bucketName });
        console.log('Bucket created successfully');
      } else {
        throw error;
      }
    }
  }

  // 获取所有笔记列表
  async getNotes(): Promise<Note[]> {
    await this.ensureBucketExists();
    try {
      const response = await apiClient.get(`/buckets/${this.bucketName}/objects`);
      return response.data.data.objects || [];
    } catch (error) {
      console.error('Failed to get notes:', error);
      throw error;
    }
  }

  // 获取笔记内容
  async getNoteContent(key: string): Promise<NoteContent | null> {
    try {
      console.log('Downloading note content for key:', key);
      const url = `/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}`;
      console.log('Request URL:', url);
      const response = await apiClient.get(url, { responseType: 'text' });
      const content = response.data;
      console.log('Downloaded content length:', content?.length || 0);
      return {
        title: '',
        content: content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get note content:', error);
      return null;
    }
  }

  // 创建新笔记
  async createNote(title: string, content: string = '', parentId: string = '', extraMeta: Record<string, any> = {}): Promise<Note | null> {
    console.log('Creating new note with params:', { title, content, parentId, extraMeta });
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const key = `${randomId}.md`;
    console.log('Generated key:', key);
    const result = await this.saveNote(key, title, content, parentId, extraMeta);
    console.log('Create note result:', result);
    return result;
  }

  // 保存笔记
  async saveNote(key: string, title: string, content: string, parentId: string = '', extraMeta: Record<string, any> = {}): Promise<Note | null> {
    console.log('Saving note with key:', key);
    await this.ensureBucketExists();
    try {
      console.log('Uploading content...');
      const response = await apiClient.put(
        `/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}?deduplication_mode=allow`,
        content,
        {
          headers: {
            'Content-Type': 'text/markdown'
          }
        }
      );
      console.log('Content upload response:', response.data);
      if (response.data.data) {
        const updatedMetadata = {
          title,
          parent_id: parentId,
          ...extraMeta
        };
        console.log('Updating metadata:', updatedMetadata);
        await this.updateNoteTitle(key, title, updatedMetadata);
        const metadataResponse = await apiClient.get(`/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}/metadata`);
        console.log('Final metadata response:', metadataResponse.data);
        return metadataResponse.data.data;
      }
      return response.data.data;
    } catch (error) {
      console.error('Failed to save note:', error);
      return null;
    }
  }

  // 删除笔记
  async deleteNote(key: string): Promise<boolean> {
    try {
      await apiClient.delete(`/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}`);
      return true;
    } catch (error) {
      console.error('Failed to delete note:', error);
      return false;
    }
  }

  // 更新笔记
  async updateNote(key: string, title: string, content: string): Promise<Note | null> {
    try {
      const metadataResponse = await apiClient.get(`/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}/metadata`);
      const currentNote = metadataResponse.data.data;
      const parentId = currentNote?.user_metadata?.parent_id || '';
      return await this.saveNote(key, title, content, parentId);
    } catch (error) {
      return await this.saveNote(key, title, content, '');
    }
  }

  // 更新笔记标题（只更新元数据）
  async updateNoteTitle(key: string, title: string, extraMeta: Record<string, any> = {}): Promise<Note | null> {
    try {
      const user_metadata = extraMeta.title !== undefined ? extraMeta : { title, ...extraMeta };
      const response = await apiClient.put(
        `/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}/metadata`,
        {
          user_metadata: user_metadata
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to update note title:', error);
      return null;
    }
  }

  // 获取笔记元数据
  async getNoteMetadata(key: string): Promise<Note | null> {
    try {
      const response = await apiClient.get(`/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}/metadata`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get note metadata:', error);
      return null;
    }
  }
}

remoteNoteService = new NoteService();
