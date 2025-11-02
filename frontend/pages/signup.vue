<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
    <div class="max-w-md w-full space-y-8 p-8">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">CrazyMail</h1>
        <p class="text-gray-600">Create a new account</p>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
        <span class="block sm:inline">{{ error }}</span>
      </div>

      <div v-if="success" class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative" role="alert">
        <span class="block sm:inline">{{ success }}</span>
      </div>

      <form @submit.prevent="handleSignup" class="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-lg">
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
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
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
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
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
              class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Confirm your password"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading || !passwordsMatch"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <NuxtLink to="/" class="font-medium text-indigo-600 hover:text-indigo-500">
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
    
    success.value = 'Account created successfully! Redirecting...'
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

