<template>
  <div class="flex-1 overflow-y-auto">
    <div v-if="loading" class="p-8 text-center text-gray-500">
      <div class="flex flex-col items-center space-y-3">
        <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600">Loading your emails...</p>
      </div>
    </div>
    <div v-else-if="error" class="p-8 text-center">
      <div class="flex flex-col items-center space-y-3">
        <svg class="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-red-600 font-medium">{{ error }}</p>
      </div>
    </div>
    <div v-else-if="emails.length === 0" class="p-8 text-center">
      <div class="flex flex-col items-center space-y-3">
        <svg class="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p class="text-gray-500 text-lg">No emails found</p>
        <p class="text-gray-400 text-sm">Your inbox is empty</p>
      </div>
    </div>
    <div v-else class="divide-y divide-gray-200">
      <button
        v-for="email in emails"
        :key="email.uid"
        @click="$emit('select', email.uid)"
        class="w-full text-left px-6 py-4 hover:bg-indigo-50 transition-all border-b border-gray-100 last:border-b-0"
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
            <p class="text-sm font-semibold text-gray-900 truncate mb-1">
              {{ getSubject(email) }}
            </p>
            <p class="text-sm text-gray-600 truncate line-clamp-2">
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

const getSubject = (email: Mail): string => {
  if (!email.headers || typeof email.headers !== 'object') {
    return '(No Subject)'
  }
  
  // Try different case variations of Subject header
  // First try common variations
  let subject = email.headers.Subject || 
                 email.headers.subject || 
                 email.headers.SUBJECT ||
                 email.headers['subject'] ||
                 email.headers['Subject'] ||
                 email.headers['SUBJECT']
  
  // If not found, search through all keys case-insensitively
  if (!subject) {
    const headerKeys = Object.keys(email.headers)
    const subjectKey = headerKeys.find(key => 
      key.toLowerCase() === 'subject'
    )
    if (subjectKey) {
      subject = email.headers[subjectKey]
    }
  }
  
  // Ensure subject is a string
  if (typeof subject !== 'string') {
    return '(No Subject)'
  }
  
  return subject.trim() || '(No Subject)'
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
