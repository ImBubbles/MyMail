<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
    <div class="max-w-md w-full space-y-8 p-8">
      <div class="text-center">
        <div class="mb-4">
          <svg class="w-16 h-16 mx-auto text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 class="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">MyMail</h1>
        <p class="text-gray-700 text-lg">Join us today! 🎉</p>
        <p class="text-gray-600 text-sm mt-1">Create your account to get started</p>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative flex items-center space-x-2" role="alert">
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="block sm:inline">{{ error }}</span>
      </div>

      <div v-if="success" class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg relative flex items-center space-x-2" role="alert">
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="block sm:inline">{{ success }}</span>
      </div>

      <form @submit.prevent="handleSignup" class="mt-8 space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div class="space-y-4">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              required
              minlength="3"
              class="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all"
              placeholder="Enter your username (min 3 characters)"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              required
              minlength="6"
              class="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all"
              placeholder="Enter your password (min 6 characters)"
            />
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              type="password"
              required
              class="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all"
              placeholder="Confirm your password"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading || !passwordsMatch"
            class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            <span v-if="!loading">Create account</span>
            <span v-else>Creating account...</span>
          </button>
        </div>

        <div v-if="!passwordsMatch && form.confirmPassword" class="text-red-600 text-sm text-center">
          Passwords do not match
        </div>

        <div class="text-center">
          <p class="text-sm text-gray-600">
            Already have an account?
            <NuxtLink to="/" class="font-medium text-indigo-600 hover:text-purple-600 transition-colors">
              Sign in here
            </NuxtLink>
          </p>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
// Nuxt auto-imports: definePageMeta, useAuth, reactive, ref, computed, navigateTo
definePageMeta({
  // Using layout: false to show full-screen signup form without default layout
  layout: false,
})

const { register, isAuthenticated } = useAuth()

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
})

const error = ref('')
const success = ref('')
const loading = ref(false)

const passwordsMatch = computed(() => {
  return form.password === form.confirmPassword || !form.confirmPassword
})

// Redirect if already authenticated
if (isAuthenticated.value) {
  navigateTo('/dashboard')
}

const handleSignup = async () => {
  error.value = ''
  success.value = ''

  if (!passwordsMatch.value) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true

  try {
    const signupData = {
      username: form.username,
      password: form.password,
    }

    await register(signupData)
    
    success.value = 'Account created successfully! 🎉 Welcome to MyMail!'
    setTimeout(() => {
      navigateTo('/dashboard')
    }, 1000)
  } catch (err: any) {
    error.value = err.message || err.data?.message || 'Signup failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

