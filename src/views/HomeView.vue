<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import SceneVideo from '../components/SceneVideo.vue'

gsap.registerPlugin(ScrollTrigger)

const VIDEO_SCENES = [
  { id: 'scene-1', label: 'Intro', time: 2, window: 2 },
  { id: 'scene-2', label: 'Transition A', time: 7, window: 2 },
  { id: 'scene-3', label: 'Mid Motion', time: 14, window: 2 },
  { id: 'scene-4', label: 'Smile Close', time: 19, window: 2 },
  { id: 'scene-5', label: 'Glow', time: 23, window: 2 },
  { id: 'scene-6', label: 'Finale', time: 32, window: 2 }
]

const sections = ref([])
const experienceRef = ref(null)
const activeSceneIndex = ref(0)
const triggers = []
const isTransitioning = ref(false)
const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

let lenis
let rafId

const setSectionRef = (el) => {
  if (el && !sections.value.includes(el)) {
    sections.value.push(el)
  }
}

const activateScene = (index) => {
  activeSceneIndex.value = index
}

const initScrollTriggers = () => {
  sections.value.forEach((section, index) => {
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top center',
      end: 'bottom center',
      scrub: false,
      onEnter: () => {
        if (isTransitioning.value) return
        activateScene(index)
      },
      onEnterBack: () => {
        if (isTransitioning.value) return
        activateScene(index)
      }
    })

    triggers.push(trigger)
  })
}

const initLenis = () => {
  if (prefersReducedMotion) return

  lenis = new Lenis({
    lerp: 0.08,
    smoothWheel: true,
    wheelMultiplier: 0.2,
    touchMultiplier: 0.2
  })

  lenis.on('scroll', () => ScrollTrigger.update())

  const raf = (time) => {
    lenis.raf(time)
    rafId = requestAnimationFrame(raf)
  }

  rafId = requestAnimationFrame(raf)
}

onMounted(() => {
  initScrollTriggers()
  initLenis()
})

onBeforeUnmount(() => {
  triggers.forEach((trigger) => trigger.kill())

  if (rafId) {
    cancelAnimationFrame(rafId)
  }

  lenis?.destroy()
})

const handleTransitionStart = () => {
  isTransitioning.value = true
  lenis?.stop()
}

const handleTransitionEnd = () => {
  isTransitioning.value = false
  lenis?.start()
}
</script>

<template>
  <main class="home" ref="experienceRef">
    <div class="scene-stage">
      <SceneVideo
        :active-scene-index="activeSceneIndex"
        :scenes="VIDEO_SCENES"
        @transition-start="handleTransitionStart"
        @transition-end="handleTransitionEnd"
      />
    </div>

    <section
      v-for="scene in VIDEO_SCENES"
      :key="scene.id"
      class="scene-anchor scene-anchor--hidden"
      :ref="setSectionRef"
    >
      <div class="copy-block" aria-hidden="true" />
    </section>
  </main>
</template>

<style scoped>
.home {
  min-height: 320vh;
  background: radial-gradient(circle at top, #d6ffe4 0%, #ebfff1 30%, #f7fff8 65%, #ffffff 100%);
  color: #0d1f16;
  position: relative;
}

.scene-stage {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 100%;
  z-index: 0;
}

.scene-anchor {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(2rem, 4vw, 5rem);
  position: relative;
  z-index: 1;
}

.scene-anchor--hidden .copy-block {
  opacity: 0;
  pointer-events: none;
}

.copy-block {
  max-width: 620px;
  padding: clamp(1.5rem, 4vw, 2.5rem);
  border-radius: 1.5rem;
  border: 1px solid rgba(13, 31, 22, 0.08);
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(14px);
  text-align: left;
  box-shadow: 0 45px 90px rgba(0, 25, 13, 0.08);
}

.copy-block h1 {
  font-size: clamp(2rem, 5vw, 3.4rem);
  margin-bottom: 0.5rem;
}

.copy-block h2 {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  margin-bottom: 0.5rem;
}

.copy-block p {
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(13, 31, 22, 0.85);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.85rem;
  color: rgba(13, 31, 22, 0.65);
  margin-bottom: 0.75rem;
}

code {
  font-size: 0.9em;
  color: #2aa44f;
}
</style>

