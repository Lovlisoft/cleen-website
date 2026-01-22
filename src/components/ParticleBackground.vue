<template>
  <div class="particle-background">
    <img 
      v-if="currentFrame"
      ref="frameRef"
      :src="currentFrame"
      alt="Particle background"
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

// Generate frame paths - SOLO FRAMES PARES (Fondo0002, Fondo0004, Fondo0006, ..., Fondo0250)
const generateFramePaths = () => {
  const paths = []
  for (let i = 2; i <= 250; i += 2) { // Solo números pares
    const frameNumber = String(i).padStart(4, '0')
    paths.push(`/images/fondo-particula/Fondo${frameNumber}.webp`)
  }
  return paths
}

const frames = generateFramePaths()

// Computed current frame path
const currentFrame = computed(() => frames[currentFrameIndex.value])

// Preload all frames for smooth animation with proper loading wait
const preloadFrames = async () => {
  console.log('🎬 Starting ParticleBackground frame preload...')
  
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
    console.log('✅ All ParticleBackground frames loaded successfully')
  } catch (error) {
    console.error('❌ Error loading ParticleBackground frames:', error)
  }
}

// Animation loop
const animate = () => {
  if (!isPlaying.value || !allFramesLoaded.value) return
  
  // Increment frame index
  currentFrameIndex.value = (currentFrameIndex.value + 1) % frames.length
  
  // Continue animation at ~17 FPS (59ms per frame) - 40% más lento para efecto más sutil
  animationId.value = setTimeout(() => {
    requestAnimationFrame(animate)
  }, 59)
}

// Start animation
const play = () => {
  if (isPlaying.value || !allFramesLoaded.value) return
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

// Watch active prop to control animation
watch(() => props.active, (newActive) => {
  if (newActive && allFramesLoaded.value) {
    play()
  } else {
    pause()
  }
}, { immediate: true })

// Lifecycle
onMounted(async () => {
  await preloadFrames()
  if (props.active) {
    play()
  }
})

onUnmounted(() => {
  pause()
})
</script>

<style scoped>
.particle-background {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 140%; /* Excede 40% el tamaño de la pantalla */
  height: 140%; /* Excede 40% el tamaño de la pantalla */
  pointer-events: none;
  opacity: 0.8; /* Opacidad reducida 20% */
}

.particle-frame {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: blur(1.5px); /* Blur sutil para reducir pixelado */
}
</style>
