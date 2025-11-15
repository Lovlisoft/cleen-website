<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import gsap from 'gsap'

const props = defineProps({
  active: {
    type: Boolean,
    default: false
  }
})

const canvasRef = ref(null)
const containerRef = ref(null)

let scene
let camera
let renderer
let animationFrameId
let sceneGroup
let timeline
let isRendering = false

const initThree = () => {
  const container = containerRef.value
  const { clientWidth, clientHeight } = container

  scene = new THREE.Scene()

  sceneGroup = new THREE.Group()
  scene.add(sceneGroup)

  camera = new THREE.PerspectiveCamera(50, clientWidth / clientHeight, 0.1, 100)
  camera.position.set(0, 1.4, 4)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(clientWidth, clientHeight)
  renderer.setClearColor(0x000000, 0)

  const hemiLight = new THREE.HemisphereLight(0x88aaff, 0x221133, 1.4)
  const spotLight = new THREE.SpotLight(0xff66ff, 2, 10, Math.PI / 4, 0.5, 1)
  spotLight.position.set(-2, 3, 2)

  scene.add(hemiLight, spotLight)

  loadModel()
  window.addEventListener('resize', handleResize)
}

const loadModel = () => {
  const loader = new GLTFLoader()
  loader.load(
    '/models/model.glb',
    (gltf) => {
      const model = gltf.scene
      model.scale.setScalar(0.9)
      sceneGroup.add(model)
      createOrbitAnimation(model)
    },
    undefined,
    () => {
      const geometry = new THREE.IcosahedronGeometry(0.9, 1)
      const material = new THREE.MeshStandardMaterial({
        color: 0xff66ff,
        wireframe: true
      })
      const fallback = new THREE.Mesh(geometry, material)
      sceneGroup.add(fallback)
      createOrbitAnimation(fallback)
    }
  )
}

const createOrbitAnimation = (target) => {
  timeline?.kill()

  timeline = gsap.timeline({
    paused: true,
    repeat: -1
  })

  timeline
    .to(sceneGroup.rotation, { y: `+=${Math.PI * 2}`, duration: 10, ease: 'none' }, 0)
    .to(
      camera.position,
      {
        x: 1.5,
        y: 1.6,
        z: 3,
        duration: 5,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      },
      0
    )
    .to(
      target.scale,
      {
        x: 1.1,
        y: 1.1,
        z: 1.1,
        duration: 2.5,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      },
      0
    )

  if (props.active) {
    timeline.play()
  }
}

const renderLoop = () => {
  animationFrameId = requestAnimationFrame(renderLoop)
  camera.lookAt(scene.position)
  renderer.render(scene, camera)
}

const startRendering = () => {
  if (isRendering) return
  isRendering = true
  renderLoop()
}

const stopRendering = () => {
  if (!isRendering) return
  cancelAnimationFrame(animationFrameId)
  animationFrameId = null
  isRendering = false
}

const handleResize = () => {
  if (!renderer || !camera) return
  const { clientWidth, clientHeight } = containerRef.value
  camera.aspect = clientWidth / clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(clientWidth, clientHeight)
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) {
      startRendering()
      timeline?.play()
    } else {
      timeline?.pause()
      stopRendering()
    }
  },
  { immediate: true }
)

onMounted(() => {
  initThree()
  if (props.active) {
    startRendering()
    timeline?.play()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  stopRendering()
  renderer?.dispose()
  timeline?.kill()
  scene?.clear()
})
</script>

<template>
  <div class="scene" ref="containerRef">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.scene {
  width: 100%;
  height: 100%;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>

<!--
  Esta escena añade animaciones compuestas (rotación del grupo + cámara + escala).
  Usa este enfoque para crear escenas con personalidad propia.
-->

