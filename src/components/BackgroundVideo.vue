<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

const videoRef = ref(null)
let playPromise = null

const ensurePlaying = () => {
  if (videoRef.value && videoRef.value.paused) {
    playPromise = videoRef.value.play()
    if (playPromise) {
      playPromise.catch((error) => {
        console.warn('Error al reproducir el video de fondo:', error)
      })
    }
  }
}

const handleVideoEnd = () => {
  // Asegurar que el video se reinicie inmediatamente al terminar
  if (videoRef.value) {
    videoRef.value.currentTime = 0
    ensurePlaying()
  }
}

const handleVideoPause = () => {
  // Si el video se pausa por alguna razón, reanudarlo inmediatamente
  ensurePlaying()
}

onMounted(() => {
  if (videoRef.value) {
    // Configurar el video para loop continuo
    videoRef.value.loop = true
    videoRef.value.muted = true
    videoRef.value.playsInline = true
    
    // Event listeners para asegurar reproducción continua
    videoRef.value.addEventListener('ended', handleVideoEnd)
    videoRef.value.addEventListener('pause', handleVideoPause)
    
    // Iniciar la reproducción
    ensurePlaying()
    
    // Verificar periódicamente que el video esté reproduciéndose
    const checkInterval = setInterval(() => {
      if (videoRef.value && videoRef.value.paused) {
        ensurePlaying()
      }
    }, 1000)
    
    // Guardar el intervalo para limpiarlo al desmontar
    videoRef.value._checkInterval = checkInterval
  }
})

onBeforeUnmount(() => {
  if (videoRef.value) {
    // Limpiar event listeners
    videoRef.value.removeEventListener('ended', handleVideoEnd)
    videoRef.value.removeEventListener('pause', handleVideoPause)
    
    // Limpiar intervalo de verificación
    if (videoRef.value._checkInterval) {
      clearInterval(videoRef.value._checkInterval)
    }
  }
})
</script>

<template>
  <div class="background-video">
    <video
      ref="videoRef"
      class="background-video__video"
      src="/videos/bg.mp4"
      autoplay
      loop
      muted
      playsinline
      preload="auto"
    />
  </div>
</template>

<style scoped>
.background-video {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.background-video__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
  opacity: 0.3;
}
</style>

