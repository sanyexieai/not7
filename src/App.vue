<template>
  <div class="app">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>Not7</h1>
        <button @click="createNewNote" class="new-note-btn">
          <span>+</span> 新建笔记
        </button>
      </div>
      <div class="notes-list">
        <div 
          v-for="note in notes" 
          :key="note.id"
          :class="['note-item', { active: selectedNote?.key === note.key }]"
          @click="selectNote(note)"
        >
          <div class="note-title">{{ getNoteTitleSync(note.key) }}</div>
          <div class="note-meta">
            {{ formatDate(note.last_modified) }}
          </div>
        </div>
      </div>
    </aside>
    <!-- 主内容区 -->
    <main class="main-content">
      <div v-if="selectedNote" class="editor-container">
        <div class="editor-header">
          <div class="editor-actions">
            <button @click="saveNote" class="save-btn">保存</button>
            <button @click="deleteCurrentNote" class="delete-btn">删除</button>
          </div>
        </div>
        
        <!-- Typora风格的编辑器 -->
        <div class="typora-editor">
          <div class="editor-content" contenteditable="true" 
               @input="handleContentInput" 
               @blur="saveNote"
               ref="editorRef">
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">📝</div>
        <h2>欢迎使用 Not7</h2>
        <p>点击左侧"新建笔记"开始记录你的想法</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import { noteService, type Note } from './api/noteService';
import { marked } from 'marked';

const notes = ref<Note[]>([]);
const selectedNote = ref<Note | null>(null);
const editingContent = ref('');
const isLoading = ref(false);
const editorRef = ref<HTMLElement>();

// 配置marked选项
marked.setOptions({
  breaks: true,
  gfm: true
});

// 计算属性：可编辑的HTML内容
const editableContent = computed(() => {
  if (!editingContent.value) return '<h1>新笔记</h1><p><br></p>';
  
  // 将Markdown转换为HTML，但保持可编辑
  const html = marked(editingContent.value);
  return html;
});

const getNoteTitle = async (key: string) => {
  // 如果是当前选中的笔记，从编辑内容中获取标题
  if (selectedNote.value && selectedNote.value.key === key) {
    const title = extractTitleFromContent();
    return title || '新笔记';
  }
  
  // 否则从服务中获取标题
  try {
    return await noteService.getNoteTitle(key);
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
};

// 同步的标题获取方法（用于模板显示）
const getNoteTitleSync = (key: string) => {
  // 如果是当前选中的笔记，从编辑内容中获取标题
  if (selectedNote.value && selectedNote.value.key === key) {
    const title = extractTitleFromContent();
    return title || '新笔记';
  }
  
  // 否则从文件名获取（作为后备方案）
  const fileName = key.replace('.md', '');
  const parts = fileName.split('_');
  
  if (parts.length >= 3) {
    const titleParts = parts.slice(0, -2);
    return titleParts.join('_') || 'Untitled';
  }
  
  return fileName || 'Untitled';
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const loadNotes = async () => {
  isLoading.value = true;
  try {
    notes.value = await noteService.getNotes();
  } catch (error) {
    console.error('Failed to load notes:', error);
  } finally {
    isLoading.value = false;
  }
};

const selectNote = async (note: Note) => {
  selectedNote.value = note;
  
  try {
    const content = await noteService.getNoteContent(note.key);
    if (content) {
      editingContent.value = content.content;
      // 设置编辑器的初始内容
      nextTick(() => {
        if (editorRef.value) {
          editorRef.value.innerHTML = marked(`# ${content.title}\n\n${content.content}`);
        }
      });
    } else {
      editingContent.value = '';
      nextTick(() => {
        if (editorRef.value) {
          editorRef.value.innerHTML = '<h1>新笔记</h1><p><br></p>';
        }
      });
    }
  } catch (error) {
    editingContent.value = '';
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.innerHTML = '<h1>新笔记</h1><p><br></p>';
      }
    });
  }
};

const createNewNote = async () => {
  const newNote = await noteService.createNote('新笔记', '');
  if (newNote) {
    notes.value.unshift(newNote);
    selectNote(newNote);
  }
};

const saveNote = async () => {
  if (!selectedNote.value) return;
  
  try {
    // 从编辑器内容中提取标题和内容
    const title = extractTitleFromContent();
    const content = extractContentFromEditor();
    
    const updatedNote = await noteService.updateNote(
      selectedNote.value.key,
      title,
      content
    );
    
    if (updatedNote) {
      // 更新列表中的笔记
      const index = notes.value.findIndex(n => n.key === selectedNote.value!.key);
      if (index !== -1) {
        notes.value[index] = updatedNote;
      }
    }
  } catch (error) {
    console.error('Failed to save note:', error);
  }
};

const deleteCurrentNote = async () => {
  if (!selectedNote.value) return;
  
  if (confirm('确定要删除这个笔记吗？')) {
    const success = await noteService.deleteNote(selectedNote.value.key);
    if (success) {
      notes.value = notes.value.filter(n => n.key !== selectedNote.value!.key);
      selectedNote.value = null;
      editingContent.value = '';
    }
  }
};

// 处理内容输入
const handleContentInput = () => {
  if (!editorRef.value) return;
  
  // 将HTML内容转换回Markdown
  const html = editorRef.value.innerHTML;
  const markdown = htmlToMarkdown(html);
  
  // 只在内容真正改变时才更新
  if (markdown !== editingContent.value) {
    editingContent.value = markdown;
    
    // 触发响应式更新，让左侧列表标题更新
    if (selectedNote.value) {
      const index = notes.value.findIndex(n => n.key === selectedNote.value!.key);
      if (index !== -1) {
        notes.value[index] = { ...notes.value[index] };
      }
    }
    
    // 延迟保存，避免频繁保存
    clearTimeout(saveTimeout.value);
    saveTimeout.value = setTimeout(() => {
      saveNote();
    }, 1000);
  }
};

// 添加防抖定时器
const saveTimeout = ref<number>();

// 从编辑器内容中提取标题
const extractTitleFromContent = (): string => {
  if (!editorRef.value) return '新笔记';
  
  const firstElement = editorRef.value.querySelector('h1, h2, h3, h4, h5, h6');
  if (firstElement) {
    return firstElement.textContent || '新笔记';
  }
  
  // 如果没有标题，取第一行作为标题
  const firstLine = editorRef.value.textContent?.split('\n')[0];
  return firstLine?.trim() || '新笔记';
};

// 从编辑器中提取内容
const extractContentFromEditor = (): string => {
  if (!editorRef.value) return '';
  
  // 将HTML转换为Markdown
  return htmlToMarkdown(editorRef.value.innerHTML);
};

// 简单的HTML到Markdown转换
const htmlToMarkdown = (html: string): string => {
  let markdown = html;
  
  // 转换标题
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n');
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n');
  
  // 转换段落
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  
  // 转换粗体和斜体
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  
  // 转换列表
  markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
  });
  markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    let index = 1;
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${index++}. $1\n`) + '\n';
  });
  
  // 转换代码
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n');
  
  // 转换链接
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // 清理HTML标签
  markdown = markdown.replace(/<[^>]*>/g, '');
  
  // 清理多余的空行
  markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return markdown.trim();
};

onMounted(() => {
  loadNotes();
});
</script>

<style scoped>
.app {
  display: flex;
  height: 100vh;
  background: var(--bg-main, #f6f8fa);
  color: var(--text-main, #222);
  transition: background 0.2s, color 0.2s;
}

.sidebar {
  width: 280px;
  background: var(--sidebar-bg, #fff);
  border-right: 1px solid #e5e7eb;
  box-shadow: 2px 0 8px 0 rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
  z-index: 2;
}

.sidebar-header {
  padding: 24px 20px 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: var(--sidebar-bg, #fff);
}
.sidebar-header h1 {
  margin: 0 0 18px 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--primary, #1976d2);
}
.new-note-btn {
  width: 100%;
  padding: 10px 0;
  background: var(--primary, #1976d2);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  box-shadow: 0 2px 8px 0 rgba(25, 118, 210, 0.08);
}
.new-note-btn:hover {
  background: #1251a3;
}

.notes-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0 10px 0;
}
.note-item {
  padding: 14px 24px 10px 24px;
  margin-bottom: 6px;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  background: transparent;
  transition: background 0.18s, color 0.18s;
  border-left: 3px solid transparent;
}
.note-item.active {
  background: var(--primary-light, #e3f2fd);
  color: var(--primary, #1976d2);
  border-left: 3px solid var(--primary, #1976d2);
}
.note-item:hover {
  background: #f0f4fa;
}
.note-title {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.note-meta {
  font-size: 12px;
  color: #888;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--main-bg, #f6f8fa);
  min-width: 0;
}
.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--editor-bg, #fff);
  border-radius: 0 12px 12px 0;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.04);
  margin: 24px 24px 24px 0;
  padding: 0;
}
.editor-header {
  padding: 24px 24px 12px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 15px;
  background: var(--editor-bg, #fff);
  border-radius: 0 12px 0 0;
}
.editor-actions {
  display: flex;
  gap: 10px;
}
.save-btn, .delete-btn {
  padding: 8px 18px;
  border: none;
  border-radius: 4px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.18s;
}
.save-btn {
  background: #43a047;
  color: #fff;
}
.save-btn:hover {
  background: #2e7031;
}
.delete-btn {
  background: #e53935;
  color: #fff;
}
.delete-btn:hover {
  background: #a02725;
}
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #b0b0b0;
}
.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}
.empty-state h2 {
  margin: 0 0 10px 0;
  color: #888;
}
.empty-state p {
  margin: 0;
  font-size: 16px;
}

.typora-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--editor-bg, #fff);
  border-radius: 0 0 12px 0;
}
.editor-content {
  flex: 1;
  padding: 24px;
  outline: none;
  border: none;
  background: transparent;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  color: var(--text-main, #222);
  overflow-y: auto;
  cursor: text;
}
.editor-content:focus {
  outline: none;
}
.editor-content h1,
.editor-content h2,
.editor-content h3,
.editor-content h4,
.editor-content h5,
.editor-content h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
  cursor: text;
}
.editor-content h1 {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}
.editor-content h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}
.editor-content h3 {
  font-size: 1.25em;
}
.editor-content p {
  margin-bottom: 16px;
  cursor: text;
}
.editor-content ul,
.editor-content ol {
  margin-bottom: 16px;
  padding-left: 2em;
}
.editor-content li {
  margin-bottom: 4px;
  cursor: text;
}
.editor-content blockquote {
  margin: 0 0 16px 0;
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  cursor: text;
}
.editor-content code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  cursor: text;
}
.editor-content pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 3px;
  margin-bottom: 16px;
  cursor: text;
}
.editor-content pre code {
  padding: 0;
  background-color: transparent;
}
.editor-content table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 16px;
}
.editor-content th,
.editor-content td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
  cursor: text;
}
.editor-content th {
  background-color: #f6f8fa;
  font-weight: 600;
}
.editor-content img {
  max-width: 100%;
  height: auto;
}
.editor-content hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #e1e4e8;
  border: 0;
}

@media (max-width: 900px) {
  .sidebar {
    width: 100vw;
    min-width: 0;
    max-width: 100vw;
    border-radius: 0;
    box-shadow: none;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
    flex-direction: row;
    height: 70px;
    align-items: center;
  }
  .sidebar-header {
    flex: 1;
    padding: 10px 10px 10px 16px;
    border-bottom: none;
    border-right: 1px solid #e5e7eb;
    background: none;
  }
  .notes-list {
    flex: 2;
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 10px;
  }
  .note-item {
    min-width: 120px;
    margin-right: 8px;
    border-radius: 8px;
    padding: 10px 10px 8px 10px;
  }
  .main-content {
    margin: 0;
  }
  .editor-container {
    margin: 0;
    border-radius: 0;
  }
}

@media (max-width: 600px) {
  .editor-header, .editor-content {
    padding: 10px;
  }
}

:root {
  --primary: #1976d2;
  --primary-light: #e3f2fd;
  --bg-main: #f6f8fa;
  --sidebar-bg: #fff;
  --main-bg: #f6f8fa;
  --editor-bg: #fff;
  --text-main: #222;
}

@media (prefers-color-scheme: dark) {
  :root {
    --primary: #90caf9;
    --primary-light: #1e293b;
    --bg-main: #181c20;
    --sidebar-bg: #23272e;
    --main-bg: #181c20;
    --editor-bg: #23272e;
    --text-main: #e3e3e3;
  }
  .note-item.active {
    background: var(--primary-light, #1e293b);
    color: var(--primary, #90caf9);
    border-left: 3px solid var(--primary, #90caf9);
  }
  .note-item:hover {
    background: #23272e;
  }
}

::-webkit-scrollbar {
  width: 7px;
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #bdbdbd;
}
</style>

<style>
/* Markdown预览样式 */
.markdown-preview h1,
.markdown-preview h2,
.markdown-preview h3,
.markdown-preview h4,
.markdown-preview h5,
.markdown-preview h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-preview h1 {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.markdown-preview h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.markdown-preview h3 {
  font-size: 1.25em;
}

.markdown-preview p {
  margin-bottom: 16px;
}

.markdown-preview ul,
.markdown-preview ol {
  margin-bottom: 16px;
  padding-left: 2em;
}

.markdown-preview li {
  margin-bottom: 4px;
}

.markdown-preview blockquote {
  margin: 0 0 16px 0;
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
}

.markdown-preview code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.markdown-preview pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 3px;
  margin-bottom: 16px;
}

.markdown-preview pre code {
  padding: 0;
  background-color: transparent;
}

.markdown-preview table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 16px;
}

.markdown-preview th,
.markdown-preview td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

.markdown-preview th {
  background-color: #f6f8fa;
  font-weight: 600;
}

.markdown-preview img {
  max-width: 100%;
  height: auto;
}

.markdown-preview hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #e1e4e8;
  border: 0;
}

.empty-content {
  color: #b0b0b0;
  font-style: italic;
}

/* 深色模式下的Markdown样式 */
@media (prefers-color-scheme: dark) {
  .markdown-preview h1,
  .markdown-preview h2 {
    border-bottom-color: #404040;
  }
  
  .markdown-preview blockquote {
    color: #8b949e;
    border-left-color: #404040;
  }
  
  .markdown-preview code {
    background-color: rgba(177, 186, 196, 0.12);
  }
  
  .markdown-preview pre {
    background-color: #161b22;
  }
  
  .markdown-preview th,
  .markdown-preview td {
    border-color: #404040;
  }
  
  .markdown-preview th {
    background-color: #161b22;
  }
  
  .markdown-preview hr {
    background-color: #404040;
  }
}
</style>
