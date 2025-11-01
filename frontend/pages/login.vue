<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCredentials } from '../composables/useCredentials'

const { saveCredentials: saveCreds, getCredentials, clearCredentials: clearCreds, hasCredentials } = useCredentials()
const router = useRouter()

const username = ref('')
const password = ref('')

// Load saved credentials on mount
const savedCredentials = computed(() => getCredentials())

const saveCredentials = async () => {
  if (!username.value || !password.value) {
    alert('Please fill in both username and password')
    return
  }

  saveCreds(username.value, password.value)
  
  // Navigate to homepage after saving credentials
  await router.push('/')
}

const clearCredentials = () => {
  username.value = ''
  password.value = ''
  clearCreds()
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="title">Account Setup</h1>
      <p class="subtitle">Create a username and password:</p>

      <form @submit.prevent="saveCredentials" class="login-form">
        <div class="form-group">
          <label for="username" class="label">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            class="input"
            placeholder="Enter your username"
            required
          />
        </div>

        <div class="form-group">
          <label for="password" class="label">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="input"
            placeholder="Enter your password"
            required
          />
        </div>

        <button type="submit" class="submit-button">Save Credentials</button>
      </form>

      <div v-if="hasCredentials" class="saved-info">
        <div class="saved-badge">
          <span class="check-icon">✓</span>
          <span>Credentials saved</span>
        </div>
        <p class="saved-text">Username: <strong>{{ savedCredentials?.username }}</strong></p>
        <button @click="clearCredentials" class="clear-button">Clear & Enter New</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.login-card {
  background: white;
  border-radius: 16px;
  padding: 2.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 450px;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 0.5rem;
  text-align: center;
}

.subtitle {
  color: #718096;
  text-align: center;
  margin-bottom: 2rem;
  font-size: 0.95rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  font-weight: 600;
  color: #2d3748;
  font-size: 0.9rem;
}

.input {
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  outline: none;
}

.input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.submit-button {
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-top: 0.5rem;
}

.submit-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.submit-button:active {
  transform: translateY(0);
}

.saved-info {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f0fff4;
  border: 2px solid #9ae6b4;
  border-radius: 8px;
}

.saved-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #22543d;
  font-weight: 600;
  margin-bottom: 1rem;
}

.check-icon {
  background: #48bb78;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}

.saved-text {
  color: #2d3748;
  margin-bottom: 1rem;
}

.clear-button {
  padding: 0.5rem 1rem;
  background: #fed7d7;
  color: #742a2a;
  border: 1px solid #fc8181;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.clear-button:hover {
  background: #fc8181;
  color: white;
}
</style>
