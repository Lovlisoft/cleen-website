<script setup>
import { computed } from 'vue'

const props = defineProps({
  progress: {
    type: Number,
    default: 0
  },
  isLoading: {
    type: Boolean,
    default: true
  }
})

const progressPercent = computed(() => Math.round(props.progress * 100))
</script>

<template>
  <Transition name="loading-fade">
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
        </div>
        <p class="loading-text">Cargando experiencia...</p>
        <div class="loading-bar">
          <div class="loading-progress" :style="{ width: `${progressPercent}%` }"></div>
        </div>
        <p class="loading-percent">{{ progressPercent }}%</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Exo 2', 'Space Grotesk', 'Inter', system-ui, sans-serif;
}

.loading-content {
  text-align: center;
  max-width: 320px;
  padding: 2rem;
}

.loading-spinner {
  width: 64px;
  height: 64px;
  margin: 0 auto 2rem;
  position: relative;
}

.spinner-ring {
  width: 100%;
  height: 100%;
  border: 4px solid rgba(27, 69, 68, 0.1);
  border-top-color: #1b4544;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 1rem;
  color: #1b4544;
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.loading-bar {
  width: 100%;
  height: 4px;
  background: rgba(27, 69, 68, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.loading-progress {
  height: 100%;
  background: #1b4544;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.loading-percent {
  font-size: 0.875rem;
  color: rgba(27, 69, 68, 0.6);
  margin: 0;
}

.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.5s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}
</style>

