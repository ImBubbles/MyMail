<script setup lang="ts">
import { ref, computed } from 'vue'

const subject = ref('')
const to = ref('')
const body = ref('')
const date = ref(new Date().toISOString())
const id = ref('')



const sendMail = async () => {
  const response = await fetch('http://localhost:3000/api/emails', {
    method: 'POST',
    body: JSON.stringify({ subject, to, body, date, id }),
  })
  const data = await response.json()
  console.log(data)
}

</script>

<template>
  <div id="app">
    <h1>Compose Email</h1>
    <form @submit.prevent="sendMail">
      <div class="form-group">
        <label for="subject">Subject</label>
        <input type="text" id="subject" v-model="subject" />
        <label for="To">To</label>
        <input type="text" id="to" v-model="to" />
      </div>
    </form>
  </div>
</template>