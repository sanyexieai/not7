<template>
  <div class="note-tree">
    <div class="tree-header">
      <button @click="createFolder" class="create-folder-btn" title="新建文件夹">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-5l-2-2H5a2 2 0 0 0-2 2z"></path>
        </svg>
        新建文件夹
      </button>
    </div>
    
    <div class="tree-content">
      <div 
        v-for="item in treeData" 
        :key="item.key"
        :class="['tree-item', { 
          'active': selectedNote?.key === item.key,
          'folder': item.user_metadata.type === 'folder',
          'note': item.user_metadata.type === 'note'
        }]"
        :style="{ paddingLeft: `${(item.level || 0) * 20 + 16}px` }"
        @click="handleItemClick(item)"
        @contextmenu="handleContextMenu($event, item)"
        draggable="true"
        @dragstart="handleDragStart($event, item)"
        @dragover="handleDragOver($event, item)"
        @drop="handleDrop($event, item)"
        @dragenter="handleDragEnter($event, item)"
        @dragleave="handleDragLeave($event, item)"
      >
        <!-- 展开/折叠图标 -->
        <div 
          v-if="item.user_metadata.type === 'folder' && item.children?.length"
          @click.stop="toggleFolder(item)"
          class="expand-icon"
          :class="{ expanded: item.user_metadata.is_expanded }"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
        </div>
        
        <!-- 文件夹/笔记图标 -->
        <div class="item-icon">
          <svg v-if="item.user_metadata.type === 'folder'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-5l-2-2H5a2 2 0 0 0-2 2z"></path>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
        </div>
        
        <!-- 标题 -->
        <div class="item-title">
          <input
            v-if="editingItem?.key === item.key"
            :value="item.user_metadata.title"
            @blur="finishEditTitle(item, ($event.target as HTMLInputElement).value)"
            @keyup.enter="finishEditTitle(item, ($event.target as HTMLInputElement).value)"
            @keyup.esc="cancelEditTitle"
            ref="titleInput"
            class="title-input"
          />
          <span v-else @dblclick="startEditTitle(item)" class="title-text">
            {{ item.user_metadata.title }}
          </span>
        </div>
        
        <!-- 操作按钮 -->
        <div class="item-actions" v-if="hoveredItem?.key === item.key">
          <button @click.stop="showContextMenu($event, item)" class="action-btn" title="更多操作">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 右键菜单 -->
    <div 
      v-if="contextMenu.show"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      class="context-menu"
      @click.stop
    >
      <div @click="renameItem" class="context-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        重命名
      </div>
      <div @click="deleteItem" class="context-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"></polyline>
          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
        </svg>
        删除
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import type { NoteItem, DragOperation } from '../types/note';

interface Props {
  notes: NoteItem[];
  selectedNote: NoteItem | null;
}

interface Emits {
  (e: 'select', note: NoteItem): void;
  (e: 'create-folder', parentId?: string): void;
  (e: 'create-note', parentId?: string): void;
  (e: 'rename', item: NoteItem, newTitle: string): void;
  (e: 'delete', item: NoteItem): void;
  (e: 'move', operation: DragOperation): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 响应式数据
const editingItem = ref<NoteItem | null>(null);
const titleInput = ref<HTMLInputElement | null>(null);
const hoveredItem = ref<NoteItem | null>(null);
const draggedItem = ref<NoteItem | null>(null);
const dragTarget = ref<NoteItem | null>(null);
const dragPosition = ref<'before' | 'after' | 'inside'>('after');

// 右键菜单
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  item: null as NoteItem | null
});

// 计算树形数据
const treeData = computed(() => {
  return buildTree(props.notes);
});

// 构建树形结构
function buildTree(notes: NoteItem[]): NoteItem[] {
  const noteMap = new Map<string, NoteItem>();
  const rootItems: NoteItem[] = [];
  
  // 创建映射
  notes.forEach(note => {
    noteMap.set(note.key, { ...note, children: [], level: 0 });
  });
  
  // 构建树形结构
  notes.forEach(note => {
    const item = noteMap.get(note.key)!;
    const parentId = note.user_metadata.parent_id;
    
    if (parentId && noteMap.has(parentId)) {
      const parent = noteMap.get(parentId)!;
      parent.children!.push(item);
      item.level = (parent.level || 0) + 1;
    } else {
      rootItems.push(item);
    }
  });
  
  // 递归排序
  function sortItems(items: NoteItem[]): NoteItem[] {
    return items.sort((a, b) => {
      // 文件夹在前，笔记在后
      if (a.user_metadata.type !== b.user_metadata.type) {
        return a.user_metadata.type === 'folder' ? -1 : 1;
      }
      // 按 order 排序
      const orderA = a.user_metadata.order || 0;
      const orderB = b.user_metadata.order || 0;
      return orderA - orderB;
    }).map(item => {
      if (item.children && item.children.length > 0) {
        item.children = sortItems(item.children);
      }
      return item;
    });
  }
  
  return sortItems(rootItems);
}

// 事件处理
function handleItemClick(item: NoteItem) {
  if (item.user_metadata.type === 'note') {
    emit('select', item);
  } else if (item.user_metadata.type === 'folder') {
    toggleFolder(item);
  }
}

function handleContextMenu(event: MouseEvent, item: NoteItem) {
  event.preventDefault();
  showContextMenu(event, item);
}

function showContextMenu(event: MouseEvent, item: NoteItem) {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    item
  };
}

function handleDragStart(event: DragEvent, item: NoteItem) {
  draggedItem.value = item;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.key);
  }
}

function handleDragOver(event: DragEvent, item: NoteItem) {
  event.preventDefault();
  if (!draggedItem.value || draggedItem.value.key === item.key) return;
  
  dragTarget.value = item;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const y = event.clientY - rect.top;
  const height = rect.height;
  
  if (item.user_metadata.type === 'folder' && y > height * 0.3 && y < height * 0.7) {
    dragPosition.value = 'inside';
  } else if (y < height / 2) {
    dragPosition.value = 'before';
  } else {
    dragPosition.value = 'after';
  }
}

function handleDrop(event: DragEvent, item: NoteItem) {
  event.preventDefault();
  if (!draggedItem.value) return;
  
  emit('move', {
    draggedItem: draggedItem.value,
    targetItem: item,
    position: dragPosition.value
  });
  
  draggedItem.value = null;
  dragTarget.value = null;
}

function handleDragEnter(event: DragEvent, item: NoteItem) {
  event.preventDefault();
}

function handleDragLeave(event: DragEvent, item: NoteItem) {
  event.preventDefault();
}

function toggleFolder(item: NoteItem) {
  if (item.user_metadata.type === 'folder') {
    item.user_metadata.is_expanded = !item.user_metadata.is_expanded;
  }
}

function createFolder() {
  emit('create-folder');
}

function startEditTitle(item: NoteItem) {
  editingItem.value = item;
  nextTick(() => {
    if (titleInput.value) {
      titleInput.value.focus();
      titleInput.value.select();
    }
  });
}

function finishEditTitle(item: NoteItem, newTitle: string) {
  if (newTitle.trim() && newTitle !== item.user_metadata.title) {
    emit('rename', item, newTitle.trim());
  }
  editingItem.value = null;
}

function cancelEditTitle() {
  editingItem.value = null;
}

function renameItem() {
  if (contextMenu.value.item) {
    startEditTitle(contextMenu.value.item);
  }
  contextMenu.value.show = false;
}

function deleteItem() {
  if (contextMenu.value.item) {
    emit('delete', contextMenu.value.item);
  }
  contextMenu.value.show = false;
}

// 点击外部关闭右键菜单
function handleClickOutside(event: MouseEvent) {
  if (contextMenu.value.show) {
    contextMenu.value.show = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.note-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tree-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.create-folder-btn {
  width: 100%;
  padding: 8px 12px;
  background: #f8f9fa;
  color: #666;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.create-folder-btn:hover {
  background: #e9ecef;
  color: #333;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
  min-height: 36px;
}

.tree-item:hover {
  background: #f8f9fa;
}

.tree-item.active {
  background: var(--primary-light, #e3f2fd);
  color: var(--primary, #1976d2);
}

.tree-item.folder {
  font-weight: 500;
}

.tree-item.note {
  font-weight: 400;
}

.expand-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
  cursor: pointer;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.item-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.tree-item.active .item-icon {
  color: var(--primary, #1976d2);
}

.item-title {
  flex: 1;
  min-width: 0;
}

.title-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  outline: none;
  padding: 0;
  margin: 0;
  font-family: inherit;
}

.item-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.tree-item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #333;
}

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

/* 拖拽指示器 */
.tree-item.drag-over {
  background: rgba(25, 118, 210, 0.1);
}

.tree-item.drag-over-before {
  border-top: 2px solid var(--primary, #1976d2);
}

.tree-item.drag-over-after {
  border-bottom: 2px solid var(--primary, #1976d2);
}

.tree-item.drag-over-inside {
  background: rgba(25, 118, 210, 0.1);
  border: 2px dashed var(--primary, #1976d2);
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .create-folder-btn {
    background: #2d3748;
    color: #e2e8f0;
    border-color: #4a5568;
  }
  
  .create-folder-btn:hover {
    background: #4a5568;
    color: #f7fafc;
  }
  
  .tree-item:hover {
    background: #2d3748;
  }
  
  .context-menu {
    background: #2d3748;
    border-color: #4a5568;
  }
  
  .context-item:hover {
    background: #4a5568;
  }
}
</style> 