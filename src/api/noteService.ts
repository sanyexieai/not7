import axios from 'axios';

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
      return [];
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
      
      // 返回完整的 Markdown 内容，标题存储在元数据中
      return {
        title: '', // 标题存储在 user_metadata 中，由前端获取
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
  async createNote(title: string, content: string = '', parentId: string = ''): Promise<Note | null> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    // 使用随机ID作为文件名
    const key = `${randomId}.md`;
    
    // 直接保存内容，标题存储在元数据中
    return await this.saveNote(key, title, content, parentId);
  }

  // 保存笔记
  async saveNote(key: string, title: string, content: string, parentId: string = ''): Promise<Note | null> {
    await this.ensureBucketExists();
    
    try {
      // 先上传内容
      const response = await apiClient.put(
        `/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}?deduplication_mode=allow`,
        content,
        {
          headers: {
            'Content-Type': 'text/markdown'
          }
        }
      );
      
      // 然后更新元数据，添加标题和父级ID
      if (response.data.data) {
        await this.updateNoteTitle(key, title, { parent_id: parentId });
        // 重新获取更新后的对象信息
        const metadataResponse = await apiClient.get(`/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}/metadata`);
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
    // 先获取当前笔记的元数据以保持 parent_id
    try {
      const metadataResponse = await apiClient.get(`/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}/metadata`);
      const currentNote = metadataResponse.data.data;
      const parentId = currentNote?.user_metadata?.parent_id || '';
      return await this.saveNote(key, title, content, parentId);
    } catch (error) {
      // 如果获取元数据失败，使用空字符串作为 parent_id
      return await this.saveNote(key, title, content, '');
    }
  }

  // 更新笔记标题（只更新元数据）
  async updateNoteTitle(key: string, title: string, extraMeta: Record<string, any> = {}): Promise<Note | null> {
    try {
      const user_metadata = { title, ...extraMeta };
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

export const noteService = new NoteService();
