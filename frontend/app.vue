<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// Initialize auth from cookies on app load
const { initializeAuth } = useAuth()

onMounted(async () => {
  // Initialize authentication from cookies on client-side
  await initializeAuth()
})
</script>

<style>
/* Tailwind CSS will be injected by the module */
</style>
