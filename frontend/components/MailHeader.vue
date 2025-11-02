<template>
  <header class="bg-white border-b border-gray-200 shadow-sm">
    <div class="container mx-auto px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h1 class="text-2xl font-bold text-indigo-600">CrazyMail</h1>
          <div class="flex-1 max-w-md">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search emails..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-gray-700 font-medium">{{ user?.username }}</span>
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
</template>

<script setup lang="ts">
// Nuxt auto-imports: useAuth, ref, watch
const { user, logout } = useAuth()

const searchQuery = ref('')
const emit = defineEmits<{
  search: [query: string]
}>()

const handleLogout = () => {
  logout()
}

// Watch for search query changes with debounce
let searchTimeout: NodeJS.Timeout | null = null
watch(searchQuery, (newQuery) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    emit('search', newQuery)
  }, 300) // Debounce for 300ms
})
</script>
