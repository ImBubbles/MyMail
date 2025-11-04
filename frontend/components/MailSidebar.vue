<template>
  <aside class="w-56 bg-white border-r border-gray-200 h-full">
    <nav class="p-4">
      <ul class="space-y-2">
        <li>
          <button
            @click="$emit('navigate', 'inbox')"
            :class="[
              'w-full text-left px-4 py-3 rounded-lg transition-all flex items-center space-x-3',
              activeView === 'inbox'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium shadow-md'
                : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
            ]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Inbox</span>
          </button>
        </li>
        <li>
          <button
            @click="$emit('navigate', 'sent')"
            :class="[
              'w-full text-left px-4 py-3 rounded-lg transition-all flex items-center space-x-3',
              activeView === 'sent'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium shadow-md'
                : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
            ]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span>Sent</span>
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
