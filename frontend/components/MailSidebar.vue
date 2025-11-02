<template>
  <aside class="w-48 bg-gray-50 border-r border-gray-200 h-full">
    <nav class="p-4">
      <ul class="space-y-2">
        <li>
          <button
            @click="$emit('navigate', 'inbox')"
            :class="[
              'w-full text-left px-4 py-2 rounded-md transition-colors',
              activeView === 'inbox'
                ? 'bg-indigo-600 text-white font-medium'
                : 'text-gray-700 hover:bg-gray-200'
            ]"
          >
            Inbox
          </button>
        </li>
        <li>
          <button
            @click="$emit('navigate', 'sent')"
            :class="[
              'w-full text-left px-4 py-2 rounded-md transition-colors',
              activeView === 'sent'
                ? 'bg-indigo-600 text-white font-medium'
                : 'text-gray-700 hover:bg-gray-200'
            ]"
          >
            Sent
          </button>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  activeView: 'inbox' | 'sent'
}>()

defineEmits<{
  navigate: [view: 'inbox' | 'sent']
}>()
</script>
