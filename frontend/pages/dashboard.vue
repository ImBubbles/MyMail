<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <!-- Header with title, username, and logout -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-indigo-600">CrazyMail</h1>
          <div class="flex items-center space-x-4">
            <span class="text-gray-700 font-medium">{{ user?.email || user?.username }}</span>
            <button
              @click="handleLogout"
              class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main content area -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <MailSidebar :active-view="activeView" @navigate="handleNavigate" />
      
      <!-- Main content: Search bar on top, emails below -->
      <main class="flex-1 bg-white flex flex-col overflow-hidden">
        <!-- Search bar at the top -->
        <div class="bg-white border-b border-gray-200 p-4">
          <div class="max-w-2xl">
            <input
              v-model="searchQuery"
              @input="handleSearchInput"
              type="text"
              placeholder="Search emails..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Email list below search bar -->
        <MailList
          :emails="emails"
          :loading="loading"
          :error="error"
          :view="activeView"
          @select="handleSelectEmail"
        />
      </main>
    </div>

    <!-- Floating Send Email Button -->
    <button
      @click="showComposeModal = true"
      class="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors z-40"
      aria-label="Compose Email"
      title="Compose Email"
    >
      <svg
        class="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        />
      </svg>
    </button>

    <!-- Compose Email Modal -->
    <ComposeEmailModal
      :is-open="showComposeModal"
      @close="showComposeModal = false"
      @sent="handleEmailSent"
    />
  </div>
</template>

<script setup lang="ts">
// Nuxt auto-imports: definePageMeta, useAuth, useMail, ref, onMounted
import type { Mail } from '~/composables/useMail'

definePageMeta({
  layout: 'default',
})

const { user, logout } = useAuth()
const { getInbox, getSent, searchEmails } = useMail()

const activeView = ref<'inbox' | 'sent'>('inbox')
const emails = ref<Mail[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const showComposeModal = ref(false)

// Debounce search
let searchTimeout: NodeJS.Timeout | null = null

const loadEmails = async () => {
  loading.value = true
  error.value = null

  try {
    let response
    if (searchQuery.value.trim()) {
      response = await searchEmails(searchQuery.value)
    } else {
      response = activeView.value === 'inbox' ? await getInbox() : await getSent()
    }
    emails.value = response.emails
  } catch (err: any) {
    error.value = err.message || 'Failed to load emails'
    emails.value = []
  } finally {
    loading.value = false
  }
}

const handleNavigate = (view: 'inbox' | 'sent') => {
  activeView.value = view
  searchQuery.value = '' // Clear search when switching views
  loadEmails()
}

const handleSearchInput = () => {
  // Debounce search input
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    loadEmails()
  }, 300) // 300ms debounce
}

const handleLogout = () => {
  logout()
}

const handleSelectEmail = (uid: string) => {
  // TODO: Navigate to email detail page or show email content
  console.log('Selected email:', uid)
}

const handleEmailSent = () => {
  // Refresh the sent emails list after sending
  if (activeView.value === 'sent') {
    loadEmails()
  }
  // Switch to sent view to see the newly sent email
  activeView.value = 'sent'
  loadEmails()
}

onMounted(() => {
  loadEmails()
})
</script>

