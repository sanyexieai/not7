<template>
  <div class="note-tree-node">
    <div 
      :class="['note-item', { active: selectedNote?.key === note.key }]"
      :data-note-key="note.key"
      @click="handleClick"
      @contextmenu.stop="handleContextMenu"
    >
      <div class="note-title">
        <input
          v-if="editingTitle === note.key"
          :value="getNoteTitle(note)"
          @keyup.enter="updateTitle(note.key, ($event.target as HTMLInputElement).value)"
          @keyup.esc="cancelEdit"
          @blur="updateTitle(note.key, ($event.target as HTMLInputElement).value)"
          :ref="(el) => { if (el) titleInputs.set(note.key, el as HTMLInputElement); }"
          class="title-input"
          :data-note-key="note.key"
        />
        <span v-else class="title-text">
          {{ getNoteTitle(note) }}
        </span>
      </div>
      <div class="note-meta">
        {{ formatDate(note.last_modified) }}
      </div>
    </div>
    
    <!-- 子笔记 -->
    <div v-if="childNotes.length > 0" class="child-notes">
      <div 
        v-for="childNote in childNotes" 
        :key="childNote.id"
        class="note-tree-node"
        :style="{ marginLeft: '20px' }"
      >
        <NoteTreeNode 
          :note="childNote" 
          :all-notes="allNotes"
          :selected-note="selectedNote"
          :editing-title="editingTitle"
          @select="selectNote"
          @edit-title="startEditTitle"
          @update-title="updateNoteTitle"
          @cancel-edit="cancelEditTitle"
          @context-menu="showContextMenu"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Note } from '../api/noteService';

interface Props {
  note: Note;
  allNotes: Note[];
  selectedNote: Note | null;
  editingTitle: string | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'select', note: Note): void;
  (e: 'edit-title', key: string): void;
  (e: 'update-title', key: string, title: string): void;
  (e: 'cancel-edit'): void;
  (e: 'context-menu', event: MouseEvent, note: Note | null): void;
}

const emit = defineEmits<Emits>();

const titleInputs = ref<Map<string, HTMLInputElement>>(new Map());

// 获取子笔记
const childNotes = computed(() => {
  return props.allNotes.filter(note => note.user_metadata?.parent_id === props.note.key);
});

// 获取笔记标题
const getNoteTitle = (note: Note) => {
  if (note.user_metadata && note.user_metadata.title) {
    return note.user_metadata.title;
  }
  return '新笔记';
};

// 格式化日期
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 事件处理
const handleClick = () => {
  emit('select', props.note);
};

const handleContextMenu = (event: MouseEvent) => {
  emit('context-menu', event, props.note);
};

const startEdit = (key: string) => {
  emit('edit-title', key);
};

const updateTitle = (key: string, title: string) => {
  emit('update-title', key, title);
};

const cancelEdit = () => {
  emit('cancel-edit');
};

const selectNote = (note: Note) => {
  emit('select', note);
};

const startEditTitle = (key: string) => {
  emit('edit-title', key);
};

const updateNoteTitle = (key: string, title: string) => {
  emit('update-title', key, title);
};

const cancelEditTitle = () => {
  emit('cancel-edit');
};

const showContextMenu = (event: MouseEvent, note: Note | null) => {
  emit('context-menu', event, note);
};
</script>

<style scoped>
.note-tree-node {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  background: rgba(0, 0, 0, 0.05);
}

.note-item.active:hover {
  background: var(--primary-light, #e3f2fd);
}

.note-title {
  font-size: 15px;
  font-weight: 500;
  color: inherit;
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

.child-notes {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style> 