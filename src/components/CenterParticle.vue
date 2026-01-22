<template>
  <div class="center-particle">
    <img 
      v-if="currentFrame"
      ref="frameRef"
      :src="currentFrame"
      alt="Center particle"
      class="particle-frame"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false
  }
})

// Refs
const frameRef = ref(null)
const currentFrameIndex = ref(0)
const animationId = ref(null)
const isPlaying = ref(false)
const preloadedImages = ref([])
const allFramesLoaded = ref(false)

// Generate frame paths - SOLO FRAMES PARES (B0002, B0004, B0006, ..., B0150)
const generateFramePaths = () => {
  const paths = []
  for (let i = 2; i <= 150; i += 2) { // Solo números pares
    const frameNumber = String(i).padStart(4, '0')
    paths.push(`/images/particula/B${frameNumber}.webp`)
  }
  return paths
}

const frames = generateFramePaths()

// Computed current frame path
const currentFrame = computed(() => frames[currentFrameIndex.value])

// Preload all frames for smooth animation with proper loading wait
const preloadFrames = async () => {
  console.log('🎬 Starting CenterParticle frame preload...')
  
  const loadPromises = frames.map((path, index) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        preloadedImages.value[index] = img
        resolve()
      }
      img.onerror = () => {
        console.warn(`⚠️ Failed to load frame: ${path}`)
        reject(new Error(`Failed to load ${path}`))
      }
      img.src = path
    })
  })

  try {
    await Promise.all(loadPromises)
    allFramesLoaded.value = true
    console.log('✅ All CenterParticle frames loaded successfully')
  } catch (error) {
    console.error('❌ Error loading CenterParticle frames:', error)
  }
}

// Animation loop
const animate = () => {
  if (!isPlaying.value || !allFramesLoaded.value) return
  
  // Increment frame index
  currentFrameIndex.value = (currentFrameIndex.value + 1) % frames.length
  
  // Continue animation at ~18 FPS (55ms per frame) - 30% más lento para efecto más dramático
  animationId.value = setTimeout(() => {
    requestAnimationFrame(animate)
  }, 55)
}

// Start animation
const play = () => {
  if (isPlaying.value || !allFramesLoaded.value) return
  isPlaying.value = true
  // NO reiniciar el frame - continuar desde donde está
  animate()
}

// Start animation from beginning (reset)
const playFromStart = () => {
  if (!allFramesLoaded.value) return
  isPlaying.value = true
  currentFrameIndex.value = 0 // Restart from beginning
  animate()
}

// Stop animation
const pause = () => {
  isPlaying.value = false
  if (animationId.value) {
    clearTimeout(animationId.value)
    animationId.value = null
  }
}

// Set specific frame (for manual control during drag)
const setFrame = (frameIndex) => {
  if (!allFramesLoaded.value) return
  currentFrameIndex.value = Math.max(0, Math.min(frames.length - 1, frameIndex))
}

// Get current frame index
const getCurrentFrame = () => {
  return currentFrameIndex.value
}

// Get total frame count
const getTotalFrames = () => {
  return frames.length
}

// Advance frame by delta (positive = forward, negative = backward)
const advanceFrame = (delta) => {
  if (!allFramesLoaded.value) return
  const newIndex = currentFrameIndex.value + delta
  // Wrap around
  currentFrameIndex.value = ((newIndex % frames.length) + frames.length) % frames.length
}

// Watch active prop to control animation
watch(() => props.active, (newActive) => {
  if (newActive && allFramesLoaded.value) {
    playFromStart() // Iniciar desde el principio cuando se activa la escena
  } else {
    pause()
  }
}, { immediate: true })

// Lifecycle
onMounted(async () => {
  await preloadFrames()
  if (props.active) {
    playFromStart() // Iniciar desde el principio al montar
  }
})

onUnmounted(() => {
  pause()
})

// Expose methods for external control
defineExpose({
  play, // Continúa desde el frame actual
  playFromStart, // Reinicia desde el principio
  pause,
  setFrame,
  getCurrentFrame,
  getTotalFrames,
  advanceFrame
})
</script>

<style scoped>
.center-particle {
  position: absolute;
  top: calc(50% - 20px); /* Subido 20px del centro */
  left: 50%;
  transform: translate(-50%, -50%);
  height: 168%; /* 20% más grande (140% * 1.2) */
  width: auto; /* Mantiene el aspect ratio */
  pointer-events: none;
  z-index: 6; /* Por encima del fondo animado (z-index: 5) */
  display: flex;
  align-items: center;
  justify-content: center;
}

.particle-frame {
  height: 100%;
  width: auto; /* Mantiene proporciones de la imagen */
  display: block;
  filter: blur(0.5px); /* Blur muy sutil */
}
</style>
