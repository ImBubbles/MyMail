<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
    <!-- Header with title, username, and logout -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h1 class="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">MyMail</h1>
          </div>
          <div class="flex items-center space-x-4">
            <div class="text-right">
              <p class="text-sm text-gray-500">Welcome back</p>
              <span class="text-gray-800 font-medium">{{ user?.email || user?.username }}</span>
            </div>
            <button
              @click="handleLogout"
              class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors shadow-sm hover:shadow-md"
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
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                v-model="searchQuery"
                @input="handleSearchInput"
                type="text"
                placeholder="Search your emails..."
                class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
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
      class="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-110 z-40"
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
          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
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

