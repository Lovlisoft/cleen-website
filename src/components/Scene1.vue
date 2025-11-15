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
let rotatingMesh
let timeline
let isRendering = false

const initScene = () => {
  const container = containerRef.value
  scene = new THREE.Scene()

  const { clientWidth, clientHeight } = container
  camera = new THREE.PerspectiveCamera(45, clientWidth / clientHeight, 0.1, 100)
  camera.position.set(0, 1.2, 3.5)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(clientWidth, clientHeight)
  renderer.setClearColor(0x000000, 0)

  const ambient = new THREE.AmbientLight(0xffffff, 0.8)
  const directional = new THREE.DirectionalLight(0x88c0ff, 1.2)
  directional.position.set(2, 3, 4)

  scene.add(ambient, directional)

  loadModel()
  window.addEventListener('resize', handleResize)
}

const loadModel = () => {
  const loader = new GLTFLoader()
  loader.load(
    '/models/model.glb',
    (gltf) => {
      rotatingMesh = gltf.scene
      rotatingMesh.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      scene.add(rotatingMesh)
      setupAnimation()
    },
    undefined,
    () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshStandardMaterial({ color: 0x5ee2ff, roughness: 0.2 })
      rotatingMesh = new THREE.Mesh(geometry, material)
      scene.add(rotatingMesh)
      setupAnimation()
    }
  )
}

const setupAnimation = () => {
  if (!rotatingMesh) return

  timeline?.kill()
  timeline = gsap.timeline({
    repeat: -1,
    defaults: { ease: 'none' },
    paused: true
  })

  timeline.to(rotatingMesh.rotation, {
    y: `+=${Math.PI * 2}`,
    duration: 8
  })

  if (props.active) {
    timeline.play()
  }
}

const renderLoop = () => {
  animationFrameId = requestAnimationFrame(renderLoop)
  renderer?.render(scene, camera)
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
      timeline?.play()
      startRendering()
    } else {
      timeline?.pause()
      stopRendering()
    }
  },
  { immediate: true }
)

onMounted(() => {
  initScene()
  if (props.active) {
    startRendering()
    timeline?.play(0)
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
  Escena base: duplica este archivo para crear Scene3, Scene4, etc.
  Cambia los materiales, luces o animaciones para diferenciar cada escena.
-->

