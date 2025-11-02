<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCredentials } from '../composables/useCredentials'

const router = useRouter()
const { getCredentials, hasCredentials } = useCredentials()

const subject = ref('')
const to = ref('')
const cc = ref('')
const bcc = ref('')
const body = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

// Redirect to login if no credentials
onMounted(() => {
  if (!hasCredentials.value) {
    router.push('/login')
  }
})

const sendMail = async () => {
  // Validation
  if (!to.value.trim()) {
    error.value = 'Recipient email is required'
    return
  }
  
  if (!subject.value.trim()) {
    error.value = 'Subject is required'
    return
  }
  
  if (!body.value.trim()) {
    error.value = 'Email body is required'
    return
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(to.value.trim())) {
    error.value = 'Please enter a valid recipient email address'
    return
  }

  // Validate CC emails if provided
  if (cc.value.trim()) {
    const ccEmails = cc.value.split(',').map(email => email.trim()).filter(email => email)
    for (const email of ccEmails) {
      if (!emailRegex.test(email)) {
        error.value = `Invalid email address in CC: ${email}`
        return
      }
    }
  }

  // Validate BCC emails if provided
  if (bcc.value.trim()) {
    const bccEmails = bcc.value.split(',').map(email => email.trim()).filter(email => email)
    for (const email of bccEmails) {
      if (!emailRegex.test(email)) {
        error.value = `Invalid email address in BCC: ${email}`
        return
      }
    }
  }

  loading.value = true
  error.value = null
  success.value = false

  try {
    const config = useRuntimeConfig()
    const baseURL = config.public.apiBase || 'http://localhost:3000'
    const credentials = getCredentials()
    
    // Parse CC and BCC into arrays
    const ccArray = cc.value.trim() 
      ? cc.value.split(',').map(email => email.trim()).filter(email => email)
      : []
    const bccArray = bcc.value.trim()
      ? bcc.value.split(',').map(email => email.trim()).filter(email => email)
      : []

    // Prepare email data
    const emailData = {
      to: to.value.trim(),
      subject: subject.value.trim(),
      body: body.value.trim(),
      cc: ccArray,
      bcc: bccArray,
      from: credentials?.username ? `${credentials.username}@crazymail.com` : 'unknown@crazymail.com',
      date: new Date().toISOString(),
      tags: [] // Can be extended later
    }

    // Send email to backend
    const response = await $fetch(`${baseURL}/api/emails`, {
      method: 'POST',
      body: emailData,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    success.value = true
    
    // Redirect to inbox and refresh emails after a short delay
    setTimeout(() => {
      router.push('/')
      // Trigger email refresh on the inbox page
      // The inbox will refetch when it mounts if needed
    }, 1500)
    
  } catch (err: any) {
    console.error('Error sending email:', err)
    error.value = err?.message || err?.data?.message || 'Failed to send email. Please try again.'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/')
}
</script>

<template>
  <div class="compose-container">
    <div class="compose-card">
      <div class="header">
        <button @click="goBack" class="back-button" aria-label="Go back">
          ← Back
        </button>
        <h1 class="title">Compose Email</h1>
      </div>

      <form @submit.prevent="sendMail" class="compose-form">
        <div class="form-group">
          <label for="to" class="label">To</label>
          <input
            type="email"
            id="to"
            v-model="to"
            class="input"
            placeholder="recipient@example.com"
            :disabled="loading"
            required
          />
        </div>

        <div class="form-group">
          <label for="cc" class="label">CC <span class="label-optional">(optional)</span></label>
          <input
            type="text"
            id="cc"
            v-model="cc"
            class="input"
            placeholder="cc1@example.com, cc2@example.com"
            :disabled="loading"
          />
          <span class="field-hint">Separate multiple emails with commas</span>
        </div>

        <div class="form-group">
          <label for="bcc" class="label">BCC <span class="label-optional">(optional)</span></label>
          <input
            type="text"
            id="bcc"
            v-model="bcc"
            class="input"
            placeholder="bcc1@example.com, bcc2@example.com"
            :disabled="loading"
          />
          <span class="field-hint">Separate multiple emails with commas</span>
        </div>

        <div class="form-group">
          <label for="subject" class="label">Subject</label>
          <input
            type="text"
            id="subject"
            v-model="subject"
            class="input"
            placeholder="Email subject"
            :disabled="loading"
            required
          />
        </div>

        <div class="form-group">
          <label for="body" class="label">Message</label>
          <textarea
            id="body"
            v-model="body"
            class="textarea"
            placeholder="Write your message here..."
            rows="12"
            :disabled="loading"
            required
          ></textarea>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="success" class="success-message">
          <div class="success-content">
            <span class="success-icon">✓</span>
            <span>Email sent successfully! Redirecting to inbox...</span>
          </div>
        </div>

        <div class="form-actions">
          <button
            type="button"
            @click="goBack"
            class="cancel-button"
            :disabled="loading"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="submit-button"
            :disabled="loading || !to.trim() || !subject.trim() || !body.trim()"
          >
            <span v-if="loading" class="button-content">
              <span class="spinner-small"></span>
              Sending...
            </span>
            <span v-else class="button-content">
              Send Email
            </span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
<style scoped>
.compose-container {
  min-height: 100vh;
  background: #f7fafc;
  padding: 2rem;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.compose-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 800px;
  margin-top: 2rem;
}

.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.back-button {
  padding: 0.5rem 1rem;
  background: transparent;
  color: #4a5568;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button:hover:not(:disabled) {
  background: #f7fafc;
  border-color: #cbd5e0;
}

.back-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
}

.compose-form {
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

.label-optional {
  font-weight: 400;
  color: #718096;
  font-size: 0.85rem;
}

.field-hint {
  font-size: 0.75rem;
  color: #718096;
  margin-top: 0.25rem;
}

.input,
.textarea {
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  outline: none;
  font-family: inherit;
  resize: vertical;
}

.textarea {
  min-height: 200px;
  line-height: 1.6;
}

.input:focus,
.textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input:disabled,
.textarea:disabled {
  background: #f7fafc;
  cursor: not-allowed;
  opacity: 0.7;
}

.error-message {
  padding: 1rem;
  background: #fed7d7;
  border: 1px solid #fc8181;
  border-radius: 8px;
  color: #742a2a;
  font-size: 0.875rem;
}

.success-message {
  padding: 1rem;
  background: #f0fff4;
  border: 1px solid #9ae6b4;
  border-radius: 8px;
}

.success-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #22543d;
  font-weight: 500;
}

.success-icon {
  background: #48bb78;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
}

.cancel-button {
  padding: 0.75rem 1.5rem;
  background: white;
  color: #4a5568;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-button:hover:not(:disabled) {
  background: #f7fafc;
  border-color: #cbd5e0;
}

.cancel-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-button {
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

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.button-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .compose-container {
    padding: 1rem;
  }

  .compose-card {
    padding: 1.5rem;
    margin-top: 0;
  }

  .title {
    font-size: 1.5rem;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .cancel-button,
  .submit-button {
    width: 100%;
  }
}
</style>