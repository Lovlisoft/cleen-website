<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import CleenLogo from '../assets/cleen.svg'
import AudioControl from '../assets/audio-control.svg'
import MenuIcon from '../assets/menu-icon.svg'

const props = defineProps({
  scenes: {
    type: Array,
    default: () => []
  },
  activeSceneIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['transition-start', 'transition-end'])

const videoRef = ref(null)
const containerRef = ref(null)
const duration = ref(0)
const brandAsset = CleenLogo
const audioIcon = AudioControl
const menuIcon = MenuIcon

let resizeObserver
let seekTween
let pendingSceneIndex = 0

const clampTime = (value) => {
  if (!duration.value) return Math.max(value, 0)
  return Math.min(Math.max(value, 0), Math.max(duration.value - 0.05, 0))
}

const pauseVideo = () => {
  if (videoRef.value && !videoRef.value.paused) {
    videoRef.value.pause()
  }
}

const clearTweens = () => {
  seekTween?.kill()
  seekTween = null
}

const goToScene = (sceneIndex) => {
  const video = videoRef.value
  const scene = props.scenes[sceneIndex] ?? props.scenes[props.scenes.length - 1]
  if (!video || !scene) return

  clearTweens()

  const center = clampTime(scene.time ?? 0)

  emit('transition-start', { index: sceneIndex })

  seekTween = gsap.to(video, {
    currentTime: center,
    duration: Math.max(Math.abs(video.currentTime - center) * 0.5, 0.6),
    ease: 'power2.out',
    onUpdate: pauseVideo,
    onComplete: () => {
      pauseVideo()
      emit('transition-end', { index: sceneIndex })
    }
  })
}

const handleLoadedMetadata = () => {
  if (!videoRef.value) return
  duration.value = videoRef.value.duration || 0
  videoRef.value.pause()
  goToScene(pendingSceneIndex ?? props.activeSceneIndex ?? 0)
}

const observeResize = () => {
  if (!containerRef.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    document.documentElement.style.setProperty(
      '--scene-video-ratio',
      containerRef.value.clientWidth / containerRef.value.clientHeight
    )
  })
  resizeObserver.observe(containerRef.value)
}

watch(
  () => props.activeSceneIndex,
  (newIndex) => {
    if (!duration.value) {
      pendingSceneIndex = newIndex
      return
    }
    goToScene(newIndex)
  },
  { immediate: true }
)

onMounted(() => {
  observeResize()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  clearTweens()
})
</script>

<template>
  <div class="video-scene" ref="containerRef">
    <div class="video-stage">
      <video
        ref="videoRef"
        class="video-stage__media"
        src="/videos/base-scroll.mp4"
        playsinline
        muted
        preload="auto"
        @loadedmetadata="handleLoadedMetadata"
      ></video>

      <div class="video-overlay">
        <header class="brand-cluster">
          <img :src="brandAsset" alt="Cleen logo" class="brand-cluster__logo" />
          <div class="brand-cluster__meta">
            <p>By GLUUD®</p>
            <p>All Rights Reserved.</p>
          </div>
        </header>

        <div class="bottom-hud">
          <button class="sound-control" type="button" aria-label="Toggle sound">
            <img :src="audioIcon" alt="Audio control" class="sound-control__icon" />
          </button>

          <div class="menu-cluster">
            <button class="menu-square" type="button" aria-label="Open navigation">
              <img :src="menuIcon" alt="Menu icon" class="menu-square__icon" />
            </button>
            <button class="menu-pill" type="button" aria-label="Open menu overlay">menu</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.video-scene {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: #1b4544;
  font-family: 'Exo 2', 'Space Grotesk', 'Inter', system-ui, sans-serif;
}

.video-stage {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.video-stage__media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(1.04) contrast(1.01);
}

.video-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.brand-cluster {
  position: absolute;
  top: 72px;
  left: 96px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-transform: uppercase;
  letter-spacing: 0.26em;
}

.brand-cluster__logo {
  width: 168px;
  height: auto;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.05));
}

.brand-cluster__meta {
  font-size: 14px;
  letter-spacing: 0.2em;
  color: rgba(27, 69, 68, 0.75);
}

.brand-cluster__meta p {
  margin: 0;
  line-height: 1.4;
}

.bottom-hud {
  position: absolute;
  bottom: 96px;
  left: 96px;
  right: 96px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.sound-control {
  width: 80px;
  height: 80px;
  border-radius: 40px;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  margin-right: 24px;
}

.sound-control__icon {
  width: 80px;
  height: 80px;
}

.menu-cluster {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.menu-square {
  border: none;
  background: transparent;
  width: 80px;
  height: 80px;
  padding: 0;
  cursor: pointer;
}

.menu-pill {
  height: 80px;
  padding: 0 56px;
  border-radius: 40px;
  border: none;
  background: #1b4544;
  color: #ffffff;
  font-size: 20px;
  letter-spacing: 0.05em;
  text-transform: lowercase;
  cursor: pointer;
}

@media (max-width: 1024px) {
  .video-stage {
    width: 100vw;
    border-radius: 0;
  }

  .brand-cluster {
    top: 40px;
    left: 32px;
  }

  .bottom-hud {
    left: 24px;
    right: 24px;
    bottom: 32px;
  }

  .menu-pill {
    padding: 0 32px;
  }
}
</style>

<!--
  Esta escena usa un video como fondo base y expone la prop "progress".
  "progress" debe actualizarse (0 → 1) según el ScrollTrigger del contenedor
  para sincronizar el avance del video con el scroll del usuario.
  Extiende este patrón para otras escenas basadas en video o motion graphics.
-->

