<template>
  <div class="flex-1 overflow-y-auto">
    <div v-if="loading" class="p-8 text-center text-gray-500">
      Loading emails...
    </div>
    <div v-else-if="error" class="p-8 text-center text-red-500">
      {{ error }}
    </div>
    <div v-else-if="emails.length === 0" class="p-8 text-center text-gray-500">
      No emails found
    </div>
    <div v-else class="divide-y divide-gray-200">
      <button
        v-for="email in emails"
        :key="email.uid"
        @click="$emit('select', email.uid)"
        class="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2 mb-1">
              <span class="text-sm font-medium text-gray-900">
                {{ view === 'inbox' ? email.sender : email.recipient }}
              </span>
              <span class="text-xs text-gray-500">
                {{ formatDate(email.createdAt) }}
              </span>
            </div>
            <p class="text-sm font-semibold text-gray-900 truncate">
              {{ email.headers?.Subject || '(No Subject)' }}
            </p>
            <p class="text-sm text-gray-600 truncate mt-1">
              {{ truncateMessage(getDisplayText(email)) }}
            </p>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Mail } from '~/composables/useMail'
import { getEmailDisplayText } from '~/utils/emailParser'

defineProps<{
  emails: Mail[]
  loading: boolean
  error: string | null
  view: 'inbox' | 'sent'
}>()

defineEmits<{
  select: [uid: string]
}>()

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return 'Yesterday'
  } else if (days < 7) {
    return `${days} days ago`
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

const getDisplayText = (email: Mail) => {
  return getEmailDisplayText(email)
}

const truncateMessage = (message: string, maxLength: number = 100) => {
  if (!message) return ''
  if (message.length <= maxLength) return message
  return message.substring(0, maxLength) + '...'
}
</script>
