<script setup lang="ts">
import { useCredentials } from '../composables/useCredentials'
import { useEmails } from '../composables/useEmails'
import { watch, onMounted } from 'vue'
const { hasCredentials } = useCredentials()
import { useRouter } from 'vue-router'
const router = useRouter()

const { 
  filteredEmails, 
  allTags, 
  selectedTag, 
  loading, 
  error,
  fetchEmails, 
  setSelectedTag 
} = useEmails()

// Redirect to login if no credentials
watch(hasCredentials, (hasCreds) => {
  if (!hasCreds) {
    router.push('/login')
  }
}, { immediate: true })

onMounted(() => {
  if (hasCredentials.value) {
    fetchEmails()
  }
})

const createEmail = () => {
  // TODO: Navigate to create email page or open modal
  alert('Create email functionality coming soon!')
}
</script>

<template>
  <div class="inbox-container">
    <header class="inbox-header">
      <div class="header-content">
        <h1 class="inbox-title">Inbox</h1>
        <button @click="createEmail" class="create-button">
          <span class="button-icon">✉</span>
          Create Email
        </button>
      </div>
    </header>

    <div class="inbox-content">
      <!-- Tag Filter Section -->
      <div class="tags-section">
        <div class="tags-header">
          <h2 class="tags-title">Filter by Tags</h2>
          <button 
            v-if="selectedTag" 
            @click="setSelectedTag(null)" 
            class="clear-filter-button"
          >
            Clear Filter
          </button>
        </div>
        <div class="tags-list">
          <button
            v-for="tag in allTags"
            :key="tag"
            @click="setSelectedTag(selectedTag === tag ? null : tag)"
            :class="['tag-button', { active: selectedTag === tag }]"
          >
            {{ tag }}
            <span v-if="selectedTag === tag" class="tag-check">✓</span>
          </button>
          <p v-if="allTags.length === 0" class="no-tags">No tags available</p>
        </div>
        <p v-if="selectedTag" class="filter-indicator">
          Showing emails tagged: <strong>{{ selectedTag }}</strong>
        </p>
      </div>

      <!-- Email List -->
      <div class="emails-section">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading emails...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <p class="error-message">{{ error }}</p>
          <button @click="fetchEmails" class="retry-button">Retry</button>
        </div>

        <div v-else-if="filteredEmails.length === 0" class="empty-state">
          <p class="empty-message">
            {{ selectedTag ? `No emails with tag "${selectedTag}"` : 'No emails in inbox' }}
          </p>
        </div>

        <div v-else class="emails-list">
          <EmailCard
            v-for="email in filteredEmails"
            :key="email.id"
            :email="email"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inbox-container {
  min-height: 100vh;
  background: #f7fafc;
}

.inbox-header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 1.5rem 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.inbox-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
}

.create-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.create-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.button-icon {
  font-size: 1.2rem;
}

.inbox-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
}

.tags-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  height: fit-content;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tags-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.tags-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.clear-filter-button {
  padding: 0.25rem 0.75rem;
  background: #fed7d7;
  color: #742a2a;
  border: 1px solid #fc8181;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
}

.clear-filter-button:hover {
  background: #fc8181;
  color: white;
}

.tags-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tag-button {
  padding: 0.5rem 1rem;
  background: #edf2f7;
  color: #2d3748;
  border: 2px solid transparent;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tag-button:hover {
  background: #e2e8f0;
  border-color: #cbd5e0;
}

.tag-button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.tag-check {
  font-weight: bold;
}

.no-tags {
  color: #718096;
  font-size: 0.875rem;
  font-style: italic;
}

.filter-indicator {
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
  color: #4a5568;
  font-size: 0.875rem;
  margin: 0;
}

.emails-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #718096;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  color: #e53e3e;
  margin-bottom: 1rem;
}

.retry-button {
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.empty-message {
  font-size: 1.1rem;
}

.emails-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 768px) {
  .inbox-content {
    grid-template-columns: 1fr;
  }

  .tags-section {
    order: 2;
  }

  .emails-section {
    order: 1;
  }
}
</style>
