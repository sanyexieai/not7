<template>
  <div v-if="isLocalMode" class="local-mode-tip">
    <button @click="chooseLocalDir" class="new-note-btn" style="margin-top: 8px; background: #f5f5f5; color: #1976d2;">
      📂 选择本地文件夹
    </button>
    <span v-if="dirName" style="margin-left: 10px; color: #888;">当前文件夹：{{ dirName }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { getNoteService, getNoteServiceMode } from '../api/noteService';
import { LocalNoteService } from '../api/localNoteService';

const isLocalMode = computed(() => getNoteServiceMode() === 'local');
const dirName = ref('');

const emit = defineEmits(['local-dir-chosen']);

const chooseLocalDir = async () => {
  const localService = getNoteService() as LocalNoteService;
  await localService.selectDirectory();
  // 取文件夹名显示
  if ((localService as any).dirHandle?.name) {
    dirName.value = (localService as any).dirHandle.name;
  }
  emit('local-dir-chosen');
};
</script>

<style scoped>
.local-mode-tip {
  margin-top: 8px;
  display: flex;
  align-items: center;
}
</style> 