<template>
  <div class="app">
    <!-- 侧边栏 -->
    <aside v-if="!sidebarCollapsed" class="sidebar">
      <div class="sidebar-header">
        <h1>Not7</h1>
        <button @click="createNewNote" class="new-note-btn">
          <span>+</span> 新建笔记
        </button>
        <button @click="toggleSidebar" class="sidebar-toggle-btn" title="收起侧边栏">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="notes-list" @contextmenu="showContextMenu($event, null)">
        <NoteTree 
          :notes="notes"
          :selected-note="selectedNote"
          :editing-title="editingTitle"
          @select="selectNote"
          @edit-title="startEditTitle"
          @update-title="updateNoteTitle"
          @cancel-edit="cancelEditTitle"
          @context-menu="showContextMenu"
          @drag-start="handleDragStart"
          @drop="handleDrop"
        />
      </div>
      
      <!-- 右键菜单 -->
      <div 
        v-if="contextMenu.show"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        class="context-menu"
        @click.stop
      >

        <div @click="createNewNoteInContext" class="context-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
          新建笔记
        </div>
        <!-- 只有在右键点击具体项目时才显示重命名和删除选项 -->
        <template v-if="contextMenu.item">
          <div class="context-divider"></div>
          <div @click="renameContextItem" class="context-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            重命名
          </div>
          <div @click="deleteContextItem" class="context-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
            </svg>
            删除
          </div>
        </template>
      </div>
    </aside>
    
    <!-- 主内容区 -->
    <main class="main-content">
      <div v-if="selectedNote" class="editor-container">
        <div class="editor-header">
          <button v-if="sidebarCollapsed" @click="toggleSidebar" class="sidebar-toggle-btn" title="展开侧边栏">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <!-- 笔记标题显示和编辑 -->
          <div class="note-title-display">
            <input
              v-if="editingMainTitle"
              :value="getNoteTitleSync(selectedNote.key)"
              @blur="updateNoteTitle(selectedNote.key, ($event.target as HTMLInputElement).value)"
              @keyup.enter="updateNoteTitle(selectedNote.key, ($event.target as HTMLInputElement).value)"
              @keyup.esc="cancelEditMainTitle"
              class="main-title-input"
            />
            <h2 v-else @dblclick="startEditMainTitle" class="main-title-text">
              {{ getNoteTitleSync(selectedNote.key) }}
            </h2>
          </div>
          
          <div class="editor-actions">
            <div v-if="saveSuccess" class="save-success">✓ 已保存</div>
            <button @click="saveNote" :disabled="isSaving" class="save-btn">
              {{ isSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
        
        <!-- 加载动画 -->
        <div v-if="isNoteLoading" class="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-text">正在加载笔记...</div>
        </div>
        
        <!-- Vditor 编辑器 -->
        <div id="vditor" class="vditor-container"></div>
      </div>
      <div v-else class="empty-state">
        <button v-if="sidebarCollapsed" @click="toggleSidebar" class="sidebar-toggle-btn" title="展开侧边栏">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div class="empty-icon">👋</div>
        <h2>欢迎使用 Not7</h2>
        <p>点击左侧"新建笔记"开始记录你的想法</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { noteService, type Note } from './api/noteService';
import NoteTree from './components/NoteTree.vue';
import 'vditor/dist/index.css';

// 路由相关
const router = useRouter();
const route = useRoute();

// Props
interface Props {
  selectedNoteKey?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  selectedNoteKey: null
});

const notes = ref<Note[]>([]);
const selectedNote = ref<Note | null>(null);
const isLoading = ref(false);
const isNoteLoading = ref(false);
const isSaving = ref(false);
const saveSuccess = ref(false);
const sidebarCollapsed = ref(false);
const vditor = ref<any | null>(null);
const saveTimeout = ref<number | null>(null);
const editingTitle = ref<string | null>(null);
const titleInputs = ref<Map<string, HTMLInputElement>>(new Map());
const editingMainTitle = ref(false);

// 右键菜单相关
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  item: null as Note | null
});

const getNoteTitleSync = (key: string) => {
  // 从笔记列表中查找对应的笔记，获取其 user_metadata 中的标题
  const note = notes.value.find(n => n.key === key);
  if (note && note.user_metadata && note.user_metadata.title) {
    return note.user_metadata.title;
  }
  // 如果无法从元数据获取，返回默认标题
  return '新笔记';
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

const initVditor = async () => {
  if (vditor.value) {
    try {
      vditor.value.destroy();
    } catch (error) {
      console.warn('Error destroying Vditor:', error);
    }
  }
  
  try {
    // 动态导入 Vditor
    const { default: Vditor } = await import('vditor');
    
    return new Promise<void>((resolve) => {
      vditor.value = new Vditor('vditor', {
        height: '100%',
        mode: 'ir', // 回到即时渲染模式
        placeholder: '在这里输入你的笔记内容...',
        theme: 'classic',
        icon: 'material',
        cache: { enable: false },
        counter: { enable: true },
        toolbar: [
          'emoji', 'headings', 'bold', 'italic', 'strike', 'link', 
          '|', 'list', 'ordered-list', 'check', 'outdent', 'indent',
          '|', 'quote', 'line', 'code', 'inline-code', 'insert-before', 'insert-after',
          '|', 'undo', 'redo',
          '|', 'edit-mode', 'content-theme', 'code-theme', 'export',
          '|', 'fullscreen', 'preview'
        ],
        after: () => {
          resolve(); // 在 after 回调中解析 Promise
        },
        input: () => {
          if (saveTimeout.value) {
            clearTimeout(saveTimeout.value);
          }
          saveTimeout.value = setTimeout(() => {
            saveNote();
          }, 2000);
        }
      });
    });
  } catch (error) {
    console.error('Failed to initialize Vditor:', error);
    throw error;
  }
};

const selectNote = async (note: Note) => {
  selectedNote.value = note;
  
  // 更新路由
  if (route.name === 'Note') {
    router.push({ name: 'Note', params: { key: note.key } });
  } else {
    router.push({ name: 'Home', query: { note: note.key } });
  }
  
  isNoteLoading.value = true; // 开始加载
  await nextTick();
  
  try {
    // 先获取笔记内容，确保文件完全下载
    const content = await noteService.getNoteContent(note.key);
    
    // 确保 Vditor 已初始化
    if (!vditor.value) {
      await initVditor(); // 等待 Vditor 完全初始化
    }
    
    if (vditor.value) {
      // 确保内容是字符串类型
      const contentText = content?.content || '';
      
      try {
        vditor.value.setValue(contentText);
        vditor.value.focus();
      } catch (setValueError) {
        console.error('Error setting Vditor value:', setValueError);
        // 如果设置值失败，尝试重新初始化
        await initVditor();
        if (vditor.value) {
          vditor.value.setValue(contentText);
          vditor.value.focus();
        }
      }
    }
  } catch (error) {
    console.error('Failed to load note content:', error);
    if (vditor.value) {
      try {
        vditor.value.setValue('');
      } catch (setValueError) {
        console.error('Error setting empty value:', setValueError);
      }
    }
  } finally {
    isNoteLoading.value = false; // 结束加载
  }
};

const createNewNote = async () => {
  try {
    isNoteLoading.value = true; // 开始加载
    
    // 计算新笔记的排序权重（放在最后）
    const rootNotes = notes.value.filter(n => !n.user_metadata?.parent_id);
    const newOrder = calculateNewOrder(rootNotes, null, 'after');
    
    const newNote = await noteService.createNote('新笔记', '', { order: newOrder });
    if (newNote) {
      // 重新加载笔记列表以确保数据一致性
      await loadNotes();
      // 找到新创建的笔记并选择它
      const createdNote = notes.value.find(n => n.key === newNote.key);
      if (createdNote) {
        await selectNote(createdNote);
      } else {
        console.error('Created note not found in list');
      }
    } else {
      console.error('Failed to create new note');
    }
  } catch (error) {
    console.error('Failed to create new note:', error);
  } finally {
    isNoteLoading.value = false; // 结束加载
  }
};

const saveNote = async () => {
  if (!selectedNote.value || !vditor.value) return;
  try {
    isSaving.value = true;
    saveSuccess.value = false;
    
    const content = vditor.value.getValue();
    // 使用当前笔记的标题，而不是从内容中提取
    const currentTitle = getNoteTitleSync(selectedNote.value.key);
    const updatedNote = await noteService.updateNote(
      selectedNote.value.key,
      currentTitle,
      content
    );
    if (updatedNote) {
      const index = notes.value.findIndex(n => n.key === selectedNote.value!.key);
      if (index !== -1) {
        notes.value[index] = updatedNote;
      }
      // 显示保存成功提示
      saveSuccess.value = true;
      setTimeout(() => {
        saveSuccess.value = false;
      }, 2000);
    }
  } catch (error) {
    console.error('Failed to save note:', error);
  } finally {
    isSaving.value = false;
  }
};

const deleteCurrentNote = async () => {
  if (!selectedNote.value) return;
  if (confirm('确定要删除这个笔记吗？')) {
    try {
      isNoteLoading.value = true; // 开始加载
      const success = await noteService.deleteNote(selectedNote.value.key);
      if (success) {
        notes.value = notes.value.filter(n => n.key !== selectedNote.value!.key);
        selectedNote.value = null;
        if (vditor.value) {
          vditor.value.setValue('');
        }
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      isNoteLoading.value = false; // 结束加载
    }
  }
};

const startEditTitle = async (key: string) => {
  editingTitle.value = key;
  // 等待两个 tick 确保 DOM 完全更新
  await nextTick();
  await nextTick();
  
  // 尝试多种方式获取输入框
  let input = titleInputs.value.get(key);
  if (!input) {
    // 如果 Map 中没有，尝试通过 DOM 查询
    input = document.querySelector(`[data-note-key="${key}"] .title-input`) as HTMLInputElement;
  }
  
  if (input) {
    input.focus();
    // 光标放在文字末尾，不自动全选
    input.setSelectionRange(input.value.length, input.value.length);
  }
};

const updateNoteTitle = async (key: string, newTitle: string) => {
  try {
    // 使用专门的更新标题API
    const updatedNote = await noteService.updateNoteTitle(key, newTitle);
    if (updatedNote) {
      const index = notes.value.findIndex(n => n.key === key);
      if (index !== -1) {
        notes.value[index] = updatedNote;
      }
    }
    editingTitle.value = null;
  } catch (error) {
    console.error('Failed to update note title:', error);
  }
};

const cancelEditTitle = () => {
  editingTitle.value = null;
};

const startEditMainTitle = async () => {
  editingMainTitle.value = true;
  await nextTick();
  const input = document.querySelector('.main-title-input') as HTMLInputElement;
  if (input) {
    input.focus();
    // 光标放在文字末尾，不自动全选
    input.setSelectionRange(input.value.length, input.value.length);
  }
};

const cancelEditMainTitle = () => {
  editingMainTitle.value = false;
};

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

// 右键菜单相关方法
    const showContextMenu = (event: MouseEvent, note: Note | null) => {
      event.preventDefault();
      contextMenu.value = {
        show: true,
        x: event.clientX,
        y: event.clientY,
        item: note
      };
    };

const createNewNoteInContext = async () => {
  try {
    // 如果右键点击的是笔记，则在该笔记下创建子笔记
    const parentId = contextMenu.value.item?.key || '';
    
    // 计算新笔记的排序权重
    const siblingNotes = notes.value.filter(n => n.user_metadata?.parent_id === parentId);
    const newOrder = calculateNewOrder(siblingNotes, null, 'after');
    
    const newNote = await noteService.createNote('新笔记', '', parentId, { order: newOrder });
    if (newNote) {
      await loadNotes();
      const createdNote = notes.value.find(n => n.key === newNote.key);
      if (createdNote) {
        await selectNote(createdNote);
      }
    }
  } catch (error) {
    console.error('Failed to create new note:', error);
  }
  contextMenu.value.show = false;
};



const renameContextItem = () => {
  if (contextMenu.value.item) {
    startEditTitle(contextMenu.value.item.key);
  }
  contextMenu.value.show = false;
};

const deleteContextItem = async () => {
  if (contextMenu.value.item) {
    if (confirm('确定要删除这个项目吗？')) {
      try {
        const success = await noteService.deleteNote(contextMenu.value.item.key);
        if (success) {
          notes.value = notes.value.filter(n => n.key !== contextMenu.value.item!.key);
          if (selectedNote.value?.key === contextMenu.value.item.key) {
            selectedNote.value = null;
            if (vditor.value) {
              vditor.value.setValue('');
            }
          }
        }
      } catch (error) {
        console.error('Failed to delete item:', error);
      }
    }
  }
  contextMenu.value.show = false;
};

// 计算新的排序权重
const calculateNewOrder = (notes: Note[], targetNote: Note | null, position: 'before' | 'after' | 'inside'): string => {
  // 按现有排序权重排序
  const sortedNotes = [...notes].sort((a, b) => {
    const orderA = a.user_metadata?.order || '0';
    const orderB = b.user_metadata?.order || '0';
    return orderA.localeCompare(orderB);
  });
  
  if (position === 'inside') {
    // 放在最后
    if (sortedNotes.length === 0) {
      return '1';
    }
    const lastOrder = sortedNotes[sortedNotes.length - 1].user_metadata?.order || '0';
    return (parseInt(lastOrder) + 1).toString();
  }
  
  if (!targetNote) {
    // 没有目标笔记，放在最后
    if (sortedNotes.length === 0) {
      return '1';
    }
    const lastOrder = sortedNotes[sortedNotes.length - 1].user_metadata?.order || '0';
    return (parseInt(lastOrder) + 1).toString();
  }
  
  // 找到目标笔记在排序列表中的位置
  const targetIndex = sortedNotes.findIndex(n => n.key === targetNote.key);
  if (targetIndex === -1) {
    // 目标笔记不在列表中，放在最后
    if (sortedNotes.length === 0) {
      return '1';
    }
    const lastOrder = sortedNotes[sortedNotes.length - 1].user_metadata?.order || '0';
    return (parseInt(lastOrder) + 1).toString();
  }
  
  if (position === 'before') {
    // 放在目标笔记前面
    if (targetIndex === 0) {
      // 目标笔记是第一个，放在最前面
      const firstOrder = sortedNotes[0].user_metadata?.order || '0';
      return (parseInt(firstOrder) - 1).toString();
    } else {
      // 放在前一个笔记和目标笔记之间
      const prevOrder = sortedNotes[targetIndex - 1].user_metadata?.order || '0';
      const targetOrder = sortedNotes[targetIndex].user_metadata?.order || '0';
      return ((parseInt(prevOrder) + parseInt(targetOrder)) / 2).toString();
    }
  } else {
    // 放在目标笔记后面
    if (targetIndex === sortedNotes.length - 1) {
      // 目标笔记是最后一个，放在最后面
      const lastOrder = sortedNotes[sortedNotes.length - 1].user_metadata?.order || '0';
      return (parseInt(lastOrder) + 1).toString();
    } else {
      // 放在目标笔记和后一个笔记之间
      const targetOrder = sortedNotes[targetIndex].user_metadata?.order || '0';
      const nextOrder = sortedNotes[targetIndex + 1].user_metadata?.order || '0';
      return ((parseInt(targetOrder) + parseInt(nextOrder)) / 2).toString();
    }
  }
};

// 拖拽事件处理
const handleDragStart = (note: Note) => {
  // 可以在这里添加拖拽开始时的逻辑
  console.log('开始拖拽笔记:', note.key);
};

const handleDrop = async (data: { draggedKey: string; targetKey: string; position: 'before' | 'after' | 'inside' }) => {
  try {
    const { draggedKey, targetKey, position } = data;
    
    // 获取拖拽的笔记
    const draggedNote = notes.value.find(n => n.key === draggedKey);
    if (!draggedNote) return;
    
    // 如果 targetKey 为空，表示拖拽到根级别
    if (!targetKey) {
      // 获取当前笔记的完整元数据
      const currentMetadata = draggedNote.user_metadata || {};
      
      // 计算新的排序权重（放在最后）
      const rootNotes = notes.value.filter(n => !n.user_metadata?.parent_id);
      const newOrder = calculateNewOrder(rootNotes, null, 'after');
      
      // 更新笔记的父级关系为根级别（空字符串）
      const updatedNote = await noteService.updateNoteTitle(
        draggedKey, 
        currentMetadata.title || '新笔记', 
        {
          ...currentMetadata,
          parent_id: '',
          order: newOrder
        }
      );
      
      if (updatedNote) {
        await loadNotes();
      }
      return;
    }
    
    // 获取目标笔记
    const targetNote = notes.value.find(n => n.key === targetKey);
    if (!targetNote) return;
    
    // 防止拖拽到自己或自己的子笔记
    if (draggedKey === targetKey) return;
    
    // 检查是否拖拽到自己的子笔记
    const isChildOfDragged = (noteKey: string, parentKey: string): boolean => {
      const note = notes.value.find(n => n.key === noteKey);
      if (!note) return false;
      const parentId = note.user_metadata?.parent_id;
      if (!parentId) return false;
      if (parentId === parentKey) return true;
      return isChildOfDragged(parentId, parentKey);
    };
    
    if (isChildOfDragged(targetKey, draggedKey)) {
      console.log('不能拖拽到自己的子笔记下');
      return;
    }
    
    // 计算新的父级ID和排序权重
    let newParentId = '';
    let newOrder = '';
    
    if (position === 'inside') {
      // 拖拽到笔记内部，成为子笔记
      newParentId = targetKey;
      // 计算在目标笔记下的新排序权重
      const childNotes = notes.value.filter(n => n.user_metadata?.parent_id === targetKey);
      newOrder = calculateNewOrder(childNotes, null, 'after');
    } else {
      // 拖拽到笔记前后，保持与目标笔记相同的父级
      newParentId = targetNote.user_metadata?.parent_id || '';
      // 计算在同一父级下的新排序权重
      const siblingNotes = notes.value.filter(n => n.user_metadata?.parent_id === newParentId);
      newOrder = calculateNewOrder(siblingNotes, targetNote, position);
    }
    
    // 获取当前笔记的完整元数据
    const currentMetadata = draggedNote.user_metadata || {};
    
    // 更新笔记的父级关系和排序权重，保持其他元数据不变
    const updatedNote = await noteService.updateNoteTitle(
      draggedKey, 
      currentMetadata.title || '新笔记', 
      {
        ...currentMetadata,
        parent_id: newParentId,
        order: newOrder
      }
    );
    
    if (updatedNote) {
      // 重新加载笔记列表以反映新的层级结构
      await loadNotes();
    }
  } catch (error) {
    console.error('Failed to handle drop:', error);
  }
};

// 点击外部关闭右键菜单
const handleClickOutside = (event: MouseEvent) => {
  if (contextMenu.value.show) {
    contextMenu.value.show = false;
  }
};

// 键盘快捷键处理
const handleKeydown = (event: KeyboardEvent) => {
  // Ctrl+S 保存
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault(); // 阻止浏览器默认的保存行为
    if (selectedNote.value && !isSaving.value) {
      saveNote();
    }
  }
};

onMounted(() => {
  loadNotes();
  // 添加键盘事件监听器
  document.addEventListener('keydown', handleKeydown);
  // 添加点击外部关闭右键菜单监听器
  document.addEventListener('click', handleClickOutside);
});

// 监听路由变化
watch(() => props.selectedNoteKey, async (newKey) => {
  if (newKey) {
    const note = notes.value.find(n => n.key === newKey);
    if (note) {
      await selectNote(note);
    }
  } else {
    selectedNote.value = null;
    if (vditor.value) {
      vditor.value.setValue('');
    }
  }
}, { immediate: true });

// 监听笔记列表变化，如果当前选中的笔记不在列表中，清除选择
watch(notes, () => {
  if (selectedNote.value && !notes.value.find(n => n.key === selectedNote.value?.key)) {
    selectedNote.value = null;
    if (vditor.value) {
      vditor.value.setValue('');
    }
  }
});

onUnmounted(() => {
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value);
  }
  if (vditor.value) {
    vditor.value.destroy();
  }
  // 移除键盘事件监听器
  document.removeEventListener('keydown', handleKeydown);
  // 移除点击外部关闭右键菜单监听器
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.app {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: var(--bg-main, #f6f8fa);
  color: var(--text-main, #222);
  transition: background 0.2s, color 0.2s;
  overflow: hidden;
}

.sidebar {
  width: 280px;
  min-width: 280px;
  max-width: 280px;
  background: var(--sidebar-bg, #fff);
  border-right: 1px solid #e5e7eb;
  box-shadow: 2px 0 8px 0 rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
  z-index: 2;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(0);
  flex-shrink: 0;
}

.sidebar.collapsed {
  transform: translateX(-100%);
  box-shadow: none;
  width: 0;
  min-width: 0;
  max-width: 0;
}

.sidebar-header {
  position: relative;
  padding: 24px 20px 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: var(--sidebar-bg, #fff);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
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

.sidebar-toggle-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.8);
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.sidebar-toggle-btn:hover {
  background: rgba(255, 255, 255, 1);
  color: #333;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.sidebar-toggle-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.notes-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0 10px 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.note-item {
  padding: 14px 24px 10px 24px;
  margin-bottom: 6px;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  background: transparent;
  transition: background 0.18s, color 0.18s;
  border-left: 3px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
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
  display: flex;
  align-items: center;
  min-width: 0;
}

.title-text {
  cursor: pointer;
  display: block;
  width: 100%;
}

.title-input {
  width: 100%;
  border: none;
  background: transparent;
  font-weight: 600;
  font-size: 16px;
  color: inherit;
  outline: none;
  padding: 2px 4px;
  margin: -2px -4px;
  font-family: inherit;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.title-input:focus {
  background: rgba(25, 118, 210, 0.1);
  outline: 2px solid rgba(25, 118, 210, 0.3);
  outline-offset: 2px;
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
  width: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 0;
  overflow: hidden;
}

.editor-header {
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--editor-bg, #fff);
  border-radius: 0 12px 0 0;
  flex-shrink: 0;
  min-height: 0;
}

.note-title-display {
  flex: 1;
  min-width: 0;
}

.main-title-text {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main, #222);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}

.main-title-text:hover {
  color: var(--primary, #1976d2);
}

.main-title-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main, #222);
  outline: none;
  padding: 0;
  margin: 0;
  font-family: inherit;
}

.main-title-input:focus {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;
}

.editor-actions {
  display: flex;
  align-items: center;
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

.save-success {
  color: #43a047;
  font-size: 14px;
  font-weight: 500;
  animation: fadeInOut 2s ease-in-out;
}

.save-hint {
  color: #666;
  font-size: 12px;
  font-weight: 400;
  opacity: 0.8;
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 160px;
  padding: 4px 0;
}

.context-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  transition: background 0.2s;
}

.context-item:hover {
  background: #f8f9fa;
}

.context-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0; }
  20%, 80% { opacity: 1; }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #b0b0b0;
  position: relative;
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

.main-content .sidebar-toggle-btn,
.empty-state .sidebar-toggle-btn {
  position: static;
  margin-right: 12px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--primary-light, #e3f2fd);
  color: var(--primary, #1976d2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.15);
}

.main-content .sidebar-toggle-btn:hover,
.empty-state .sidebar-toggle-btn:hover {
  background: var(--primary, #1976d2);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(25, 118, 210, 0.25);
}

.empty-state .sidebar-toggle-btn {
  position: absolute;
  top: 20px;
  left: 20px;
  margin-right: 0;
}

.vditor-container {
  flex: 1;
  border-radius: 0 0 12px 0;
  position: relative;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar.collapsed ~ .main-content .vditor-container {
  border-radius: 0 0 12px 12px;
  width: 100% !important;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 0 0 12px 0;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--primary, #1976d2);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.loading-text {
  color: var(--text-main, #222);
  font-size: 14px;
  font-weight: 500;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 深色模式下的加载动画 */
@media (prefers-color-scheme: dark) {
  .loading-overlay {
    background: rgba(35, 39, 46, 0.9);
  }
  
  .loading-spinner {
    border-color: #404040;
    border-top-color: var(--primary, #90caf9);
  }
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
  .editor-header {
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
  
  .main-title-input:focus {
    background: rgba(255, 255, 255, 0.05);
  }
  
  .title-input:focus {
    background: rgba(255, 255, 255, 0.05);
  }
  
  .save-hint {
    color: #aaa;
  }
  
  .context-menu {
    background: #2d3748;
    border-color: #4a5568;
  }
  
  .context-item:hover {
    background: #4a5568;
  }
  
  .context-divider {
    background: #4a5568;
  }
  
  .sidebar-toggle-btn {
    background: rgba(35, 39, 46, 0.8) !important;
    color: #ccc !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
  }
  
  .sidebar-toggle-btn:hover {
    background: rgba(35, 39, 46, 1) !important;
    color: #fff !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
  }
  
  .main-content .sidebar-toggle-btn,
  .empty-state .sidebar-toggle-btn {
    background: var(--primary-light, #1e293b) !important;
    color: var(--primary, #90caf9) !important;
    box-shadow: 0 2px 8px rgba(144, 202, 249, 0.15) !important;
  }
  
  .main-content .sidebar-toggle-btn:hover,
  .empty-state .sidebar-toggle-btn:hover {
    background: var(--primary, #90caf9) !important;
    color: #1e293b !important;
    box-shadow: 0 4px 16px rgba(144, 202, 249, 0.25) !important;
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
/* Vditor 样式覆盖 */
#vditor {
  border: none !important;
  border-radius: 0 0 12px 0 !important;
}

.sidebar.collapsed ~ .main-content #vditor {
  border-radius: 0 0 12px 12px !important;
  width: 100% !important;
}

#vditor .vditor-toolbar {
  border-bottom: 1px solid #e5e7eb !important;
  background: #fff !important;
}

#vditor .vditor-ir,
#vditor .vditor-wysiwyg,
#vditor .vditor-sv {
  background: #fff !important;
  color: #222 !important;
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  #vditor .vditor-toolbar {
    background: #23272e !important;
    border-bottom-color: #404040 !important;
  }
  
  #vditor .vditor-ir,
  #vditor .vditor-wysiwyg,
  #vditor .vditor-sv {
    background: #23272e !important;
    color: #e3e3e3 !important;
  }
}
</style>