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
      const response = await apiClient.get(
        `/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}`,
        { responseType: 'text' }
      );
      
      const content = response.data;
      
      // 只读取第一行作为标题，其余作为内容
      const lines = content.split('\n');
      let title = 'Untitled';
      let noteContent = '';
      
      if (lines.length > 0) {
        // 第一行作为标题（去掉Markdown标记）
        const firstLine = lines[0].trim();
        if (firstLine.startsWith('# ')) {
          title = firstLine.substring(2); // 去掉 "# "
        } else {
          title = firstLine || 'Untitled';
        }
        
        // 其余行作为内容
        noteContent = lines.slice(1).join('\n').trim();
      }
      
      return {
        title,
        content: noteContent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get note content:', error);
      return null;
    }
  }

  // 创建新笔记
  async createNote(title: string, content: string = ''): Promise<Note | null> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    // 使用标题作为文件名，确保一致性
    const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50);
    const key = `${safeTitle}_${timestamp}_${randomId}.md`;
    
    return await this.saveNote(key, title, content);
  }

  // 保存笔记
  async saveNote(key: string, title: string, content: string): Promise<Note | null> {
    await this.ensureBucketExists();
    
    try {
      // 将内容保存为Markdown格式
      const fileContent = `# ${title}\n\n${content}`;
      
      const response = await apiClient.put(
        `/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}?deduplication_mode=allow`,
        fileContent,
        {
          headers: {
            'Content-Type': 'text/markdown'
          }
        }
      );
      
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
    return await this.saveNote(key, title, content);
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

  // 获取笔记标题（只读取第一行）
  async getNoteTitle(key: string): Promise<string> {
    try {
      // 只获取文件的前几行来提取标题
      const response = await apiClient.get(
        `/buckets/${this.bucketName}/objects/${encodeURIComponent(key)}`,
        { 
          responseType: 'text',
          headers: {
            'Range': 'bytes=0-1024' // 只读取前1KB，足够获取标题
          }
        }
      );
      
      const content = response.data;
      const firstLine = content.split('\n')[0].trim();
      
      if (firstLine.startsWith('# ')) {
        return firstLine.substring(2); // 去掉 "# "
      }
      
      return firstLine || 'Untitled';
    } catch (error) {
      // 如果获取失败，从文件名获取
      const fileName = key.replace('.md', '');
      const parts = fileName.split('_');
      
      if (parts.length >= 3) {
        const titleParts = parts.slice(0, -2);
        return titleParts.join('_') || 'Untitled';
      }
      
      return fileName || 'Untitled';
    }
  }
}

export const noteService = new NoteService();
