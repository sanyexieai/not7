<template>
  <div class="notes-tree">
    <div 
      v-for="note in rootNotes" 
      :key="note.id"
      class="note-tree-item"
    >
      <NoteTreeNode 
        :note="note" 
        :all-notes="notes"
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
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Note } from '../api/noteService';
import NoteTreeNode from './NoteTreeNode.vue';

interface Props {
  notes: Note[];
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

// 获取根笔记（没有父级的笔记）
const rootNotes = computed(() => {
  return props.notes.filter(note => !note.user_metadata?.parent_id);
});

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
.notes-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.note-tree-item {
  width: 100%;
}
</style> 