<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 overflow-y-auto"
        @click.self="closeModal"
      >
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />

        <!-- Modal -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div
            class="relative w-full max-w-2xl transform overflow-hidden rounded-lg bg-white shadow-xl transition-all"
            @click.stop
          >
            <!-- Header -->
            <div class="border-b border-gray-200 px-6 py-4">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-gray-900">Compose Email</h3>
                <button
                  @click="closeModal"
                  class="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <span class="sr-only">Close</span>
                  <svg
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Body -->
            <div class="px-6 py-4">
              <div v-if="error" class="mb-4 rounded-md bg-red-50 p-3">
                <p class="text-sm text-red-800">{{ error }}</p>
              </div>

              <form @submit.prevent="handleSubmit" class="space-y-4">
                <!-- Recipient -->
                <div>
                  <label
                    for="recipient"
                    class="block text-sm font-medium text-gray-700 mb-1"
                  >
                    To <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="recipient"
                    v-model="form.recipient"
                    type="email"
                    required
                    placeholder="recipient@example.com"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <!-- CC -->
                <div>
                  <label
                    for="cc"
                    class="block text-sm font-medium text-gray-700 mb-1"
                  >
                    CC
                  </label>
                  <input
                    id="cc"
                    v-model="ccInput"
                    type="text"
                    placeholder="cc1@example.com, cc2@example.com"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p class="mt-1 text-xs text-gray-500">
                    Separate multiple emails with commas
                  </p>
                </div>

                <!-- BCC -->
                <div>
                  <label
                    for="bcc"
                    class="block text-sm font-medium text-gray-700 mb-1"
                  >
                    BCC
                  </label>
                  <input
                    id="bcc"
                    v-model="bccInput"
                    type="text"
                    placeholder="bcc1@example.com, bcc2@example.com"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p class="mt-1 text-xs text-gray-500">
                    Separate multiple emails with commas
                  </p>
                </div>

                <!-- Subject -->
                <div>
                  <label
                    for="subject"
                    class="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Subject <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="subject"
                    v-model="form.subject"
                    type="text"
                    required
                    placeholder="Email subject"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <!-- Message -->
                <div>
                  <label
                    for="message"
                    class="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Message <span class="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    v-model="form.message"
                    required
                    rows="10"
                    placeholder="Enter your message here..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>

                <!-- Actions -->
                <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    @click="closeModal"
                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="loading"
                    class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span v-if="!loading">Send</span>
                    <span v-else>Sending...</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// Nuxt auto-imports: defineProps, defineEmits, ref, computed, watch
interface Props {
  isOpen: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'sent'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { sendEmail } = useMail()

const form = ref({
  recipient: '',
  subject: '',
  message: '',
})

const ccInput = ref('')
const bccInput = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

// Parse comma-separated emails
const parseEmails = (input: string): string[] => {
  if (!input || !input.trim()) return []
  return input
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email && email.includes('@'))
}

const cc = computed(() => parseEmails(ccInput.value))
const bcc = computed(() => parseEmails(bccInput.value))

const closeModal = () => {
  if (!loading.value) {
    emit('close')
  }
}

const resetForm = () => {
  form.value = {
    recipient: '',
    subject: '',
    message: '',
  }
  ccInput.value = ''
  bccInput.value = ''
  error.value = null
}

const handleSubmit = async () => {
  loading.value = true
  error.value = null

  try {
    const emailData: any = {
      recipient: form.value.recipient,
      subject: form.value.subject,
      message: form.value.message,
    }

    if (cc.value.length > 0) {
      emailData.cc = cc.value
    }

    if (bcc.value.length > 0) {
      emailData.bcc = bcc.value
    }

    await sendEmail(emailData)
    resetForm()
    emit('sent')
    emit('close')
  } catch (err: any) {
    error.value = err.message || 'Failed to send email. Please try again.'
  } finally {
    loading.value = false
  }
}

// Reset form when modal closes
watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) {
      resetForm()
    }
  }
)
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.3s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>
