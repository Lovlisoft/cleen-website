<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import gsap from 'gsap'

const props = defineProps({
  active: {
    type: Boolean,
    default: true
  },
  isLoading: {
    type: Boolean,
    default: true
  }
})

const canvasRef = ref(null)
const containerRef = ref(null)

let scene
let camera
let renderer
let animationFrameId
let logoMesh
let floatGroup
let floatTimeline
let rotationTimeline
let isRendering = false

// Mouse drag controls
let isDragging = false
let previousMousePosition = { x: 0, y: 0 }
let rotationX = 0
let rotationY = 0
let returnTween = null
const MAX_ROTATION = Math.PI / 2 // 90 grados en radianes

const initThree = () => {
  const container = containerRef.value
  const { clientWidth, clientHeight } = container

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(50, clientWidth / clientHeight, 0.1, 100)
  camera.position.set(0, 0, 4) // Aumentar distancia de la cámara para dar más espacio

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(clientWidth, clientHeight)
  renderer.setClearColor(0x000000, 0)

  // Iluminación más brillante para resaltar el color vibrante
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
  directionalLight.position.set(2, 3, 4)
  
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight2.position.set(-2, -1, 2)
  
  // Luz adicional desde el frente para más brillo
  const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.6)
  directionalLight3.position.set(0, 0, 5)

  scene.add(ambientLight, directionalLight, directionalLight2, directionalLight3)

  loadModel()
  window.addEventListener('resize', handleResize)
}

const loadModel = () => {
  const loader = new OBJLoader()
  loader.load(
    '/models/logo.obj',
    (object) => {
      // Calcular el centro del modelo para centrarlo
      const box = new THREE.Box3().setFromObject(object)
      const center = box.getCenter(new THREE.Vector3())
      object.position.sub(center)

      // Calcular el tamaño para escalar apropiadamente
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      let baseScale = 1.5 / maxDim
      
      // Guardar el tamaño original para recalcular en resize
      object.userData.originalSize = size.clone()
      
      // Aumentar 70% (multiplicar por 1.7)
      baseScale *= 1.7
      
      // Aumentar adicional 40% (multiplicar por 1.4)
      baseScale *= 1.4
      
      // Reducir 30% (multiplicar por 0.7)
      baseScale *= 0.7
      
      // Aumentar 30% adicional (multiplicar por 1.3)
      baseScale *= 1.3
      
      // Calcular el tamaño máximo basado en el ancho de la pantalla
      const container = containerRef.value
      if (container && camera) {
        const containerWidth = container.clientWidth
        const containerHeight = container.clientHeight
        
        // Calcular el tamaño del modelo escalado en pantalla
        // Usar la distancia de la cámara y el FOV para calcular el tamaño visible
        const fov = camera.fov * (Math.PI / 180)
        const distance = camera.position.z
        const visibleWidth = 2 * Math.tan(fov / 2) * distance * (containerWidth / containerHeight)
        
        // Limitar el tamaño para que no exceda el 90% del ancho de la pantalla (aumentado para permitir más tamaño)
        const maxScreenWidth = visibleWidth * 0.9
        const modelWidth = size.x * baseScale
        const modelHeight = size.y * baseScale
        const modelDepth = size.z * baseScale
        const maxModelDim = Math.max(modelWidth, modelHeight, modelDepth)
        
        // Solo limitar si realmente excede significativamente
        if (maxModelDim > maxScreenWidth) {
          const scaleRatio = maxScreenWidth / maxModelDim
          baseScale = baseScale * scaleRatio
        }
      }
      
      // Guardar scale para usarlo en la animación de entrada
      object.userData.targetScale = baseScale
      
      // Debug: verificar el scale calculado
      console.log('Scale calculado:', baseScale, 'Tamaño original:', maxDim, 'Scale base:', 1.5 / maxDim)

      // Aplicar material al modelo con color verde vibrante, más mate pero con reflejos sutiles
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x07E400, // Verde principal #07E400
            metalness: 0.1, // Mantener bajo para color puro
            roughness: 0.65, // Aumentado para material más mate, pero aún permite reflejos sutiles
            emissive: 0x07E400, // Agregar emisión del mismo color para más brillo
            emissiveIntensity: 0.1, // Intensidad de emisión reducida 50%
            transparent: true, // Habilitar transparencia para fade out
            opacity: 1 // Opacidad inicial completa
          })
        }
      })

      logoMesh = object
      scene.add(logoMesh)
      
      // Inicializar con escala pequeña para animación de entrada
      logoMesh.scale.setScalar(0)
      
      // NO ejecutar animación de entrada aquí - esperar a que termine el loading
      setupFloatAnimation()
      setupMouseControls()
      
      // Si el loading ya terminó, ejecutar la animación de entrada
      if (!props.isLoading) {
        setupEntranceAnimation()
      }
    },
    undefined,
    (error) => {
      console.error('Error loading logo.obj:', error)
    }
  )
}

const setupEntranceAnimation = () => {
  if (!logoMesh) return

  const targetScale = logoMesh.userData.targetScale
  
  if (!targetScale) {
    console.warn('targetScale no encontrado, usando valor por defecto')
    return
  }

  // Animación de entrada: empezar desde el centro pequeño y crecer hasta el tamaño final
  // El logo ya está en scale 0, así que empezamos desde ahí
  logoMesh.scale.setScalar(0)
  
  // Timeline para animación con rebote: crecer desde pequeño hasta tamaño final
  const tl = gsap.timeline()
  
  // Fase 1: Crecer desde pequeño hasta ligeramente más grande
  tl.to(logoMesh.scale, {
    x: targetScale * 1.15, // Crecer ligeramente más grande primero
    y: targetScale * 1.15,
    z: targetScale * 1.15,
    duration: 0.4, // Duración rápida similar a las pills
    ease: 'power3.out' // Más agresivo
  })
  // Fase 2: Rebote - reducir un poco
  .to(logoMesh.scale, {
    x: targetScale * 0.85,
    y: targetScale * 0.85,
    z: targetScale * 0.85,
    duration: 0.3 * 0.4,
    ease: 'power2.in'
  })
  // Fase 3: Volver al tamaño final con rebote
  .to(logoMesh.scale, {
    x: targetScale,
    y: targetScale,
    z: targetScale,
    duration: 0.3 * 0.6,
    ease: 'back.out(3)', // Rebote más fuerte
    onComplete: () => {
      // Asegurar que el scale final sea el correcto
      logoMesh.scale.setScalar(targetScale)
    }
  })
}

const setupFloatAnimation = () => {
  if (!logoMesh) return

  floatTimeline?.kill()
  
  // Crear un grupo para la posición flotante (sin afectar la rotación del usuario)
  floatGroup = new THREE.Group()
  scene.remove(logoMesh)
  floatGroup.add(logoMesh)
  scene.add(floatGroup)

  floatTimeline = gsap.timeline({
    repeat: -1,
    paused: !props.active
  })

  // Tambaleo de lado a lado (eje X) - reducido
  floatTimeline.to(floatGroup.position, {
    x: 0.03,
    duration: 2.5,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1
  }, 0)

  // Variaciones leves de arriba a abajo (eje Y)
  floatTimeline.to(floatGroup.position, {
    y: 0.03,
    duration: 3,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1
  }, 0.5)

  // Oscilaciones ligeras de rotación (máximo 10% = ~0.1 radianes por eje)
  // Crear una timeline separada para las rotaciones para poder pausarla durante el arrastre
  rotationTimeline?.kill()
  rotationTimeline = gsap.timeline({
    repeat: -1,
    paused: !props.active
  })
  
  const maxRotation = 0.1 // ~5.7 grados (10% de rotación)
  
  // Rotación en eje X (pitch) - oscilación suave
  rotationTimeline.to(logoMesh.rotation, {
    x: maxRotation * 0.8,
    duration: 4,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1
  }, 0)
  
  // Rotación en eje Y (yaw) - oscilación aumentada sobre el eje principal del modelo
  rotationTimeline.to(logoMesh.rotation, {
    y: maxRotation * 0.9,
    duration: 5,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1
  }, 1)
  
  // Rotación en eje Z (roll) - oscilación más sutil
  rotationTimeline.to(logoMesh.rotation, {
    z: maxRotation * 0.4,
    duration: 3.5,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1
  }, 0.7)

  if (props.active) {
    floatTimeline.play()
    rotationTimeline.play()
  }
}

const setupMouseControls = () => {
  if (!containerRef.value) return

  const onMouseDown = (event) => {
    // Cancelar inmediatamente cualquier animación de retorno en curso
    if (returnTween) {
      returnTween.kill()
      returnTween = null
    }
    
    isDragging = true
    previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    }
    containerRef.value.style.cursor = 'grabbing'
    
    // Pausar las oscilaciones de rotación mientras el usuario arrastra
    rotationTimeline?.pause()
    
    // Obtener la rotación actual del modelo para continuar desde ahí
    if (logoMesh) {
      rotationX = logoMesh.rotation.x
      rotationY = logoMesh.rotation.y
    }
  }

  const onMouseMove = (event) => {
    if (!isDragging || !logoMesh) return

    const deltaX = event.clientX - previousMousePosition.x
    const deltaY = event.clientY - previousMousePosition.y

    // Convertir movimiento del mouse a rotación
    // Invertir el comportamiento del eje Y
    rotationY += deltaX * 0.01
    rotationX += deltaY * 0.01 // Invertido: ahora deltaY positivo rota hacia arriba

    // Limitar rotación a ±90 grados
    rotationX = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, rotationX))
    rotationY = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, rotationY))

    // Aplicar rotación al modelo usando gsap.set para sobrescribir las animaciones
    gsap.set(logoMesh.rotation, {
      x: rotationX,
      y: rotationY,
      z: 0 // Mantener Z en 0 durante el arrastre
    })

    previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    }
  }

  const returnToCenter = () => {
    if (!logoMesh) return
    
    // Cancelar cualquier animación de retorno previa
    if (returnTween) {
      returnTween.kill()
    }
    
    // Guardar la rotación actual antes de animar
    const currentX = logoMesh.rotation.x
    const currentY = logoMesh.rotation.y
    
    // Animar la rotación de vuelta a 0,0,0 con efecto de rebote
    // Nota: las oscilaciones automáticas se reanudarán después
    returnTween = gsap.to(
      {
        x: currentX,
        y: currentY
      },
      {
        x: 0,
        y: 0,
        duration: 1.2,
        ease: 'elastic.out(1, 0.5)',
        onUpdate: function() {
          // Aplicar solo la rotación del usuario, las oscilaciones se manejan por separado
          rotationX = this.targets()[0].x
          rotationY = this.targets()[0].y
          // Solo sobrescribir X e Y, Z seguirá con su oscilación
          logoMesh.rotation.x = rotationX
          logoMesh.rotation.y = rotationY
        },
        onComplete: () => {
          // Solo completar si no estamos arrastrando
          if (!isDragging) {
            rotationX = 0
            rotationY = 0
            // Reiniciar las oscilaciones desde cero
            logoMesh.rotation.x = 0
            logoMesh.rotation.y = 0
            logoMesh.rotation.z = 0
            // Reiniciar la timeline de rotación desde el principio
            rotationTimeline?.restart()
            rotationTimeline?.play()
          }
          returnTween = null
        }
      }
    )
  }

  const onMouseUp = () => {
    isDragging = false
    if (containerRef.value) {
      containerRef.value.style.cursor = 'grab'
    }
    // Retornar a posición central cuando se suelta el mouse
    returnToCenter()
  }

  const onMouseLeave = () => {
    if (isDragging) {
      isDragging = false
      if (containerRef.value) {
        containerRef.value.style.cursor = 'grab'
      }
      // Retornar a posición central cuando el mouse sale del área
      returnToCenter()
    }
  }

  containerRef.value.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  containerRef.value.addEventListener('mouseleave', onMouseLeave)

  // Guardar funciones para limpiar
  containerRef.value._cleanupMouseControls = () => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('mousedown', onMouseDown)
      containerRef.value.removeEventListener('mouseleave', onMouseLeave)
    }
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
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
  
  // Recalcular el scale si el modelo ya está cargado
  if (logoMesh && logoMesh.userData.originalSize && logoMesh.userData.targetScale) {
    const size = logoMesh.userData.originalSize
    const maxDim = Math.max(size.x, size.y, size.z)
    let baseScale = 1.5 / maxDim
    baseScale *= 1.7 // Aumentar 70%
    baseScale *= 1.4 // Aumentar adicional 40%
    baseScale *= 0.7 // Reducir 30%
    baseScale *= 1.3 // Aumentar 30% adicional
    
        // Limitar basado en el nuevo ancho de pantalla
        const fov = camera.fov * (Math.PI / 180)
        const distance = camera.position.z
        const visibleWidth = 2 * Math.tan(fov / 2) * distance * (clientWidth / clientHeight)
        const maxScreenWidth = visibleWidth * 0.9 // Aumentado a 90%
    const modelWidth = size.x * baseScale
    const modelHeight = size.y * baseScale
    const modelDepth = size.z * baseScale
    const maxModelDim = Math.max(modelWidth, modelHeight, modelDepth)
    
    if (maxModelDim > maxScreenWidth) {
      baseScale = (maxScreenWidth / maxModelDim) * baseScale
    }
    
    // Actualizar el scale manteniendo la proporción actual
    const currentScale = logoMesh.scale.x
    const oldTargetScale = logoMesh.userData.targetScale
    const scaleRatio = baseScale / oldTargetScale
    
    logoMesh.scale.setScalar(currentScale * scaleRatio)
    logoMesh.userData.targetScale = baseScale
  }
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) {
      floatTimeline?.play()
      rotationTimeline?.play()
      startRendering()
    } else {
      floatTimeline?.pause()
      rotationTimeline?.pause()
      stopRendering()
    }
  },
  { immediate: true }
)

// Watch para ejecutar animación de entrada cuando termine el loading
watch(
  () => props.isLoading,
  (loading) => {
    // Cuando el loading termine (pase de true a false) y el logo ya esté cargado
    if (!loading && logoMesh && logoMesh.scale.x === 0) {
      setupEntranceAnimation()
    }
  },
  { immediate: true }
)

onMounted(() => {
  initThree()
  if (props.active) {
    startRendering()
    floatTimeline?.play()
    rotationTimeline?.play()
  }
})

// Exponer métodos para animación de salida
const animateExit = (targetScale, duration = 2) => {
  if (!logoMesh) {
    console.error('Logo3D: logoMesh not available for exit animation')
    return Promise.reject(new Error('logoMesh not available'))
  }
  
  // Matar timelines
  if (floatTimeline) {
    floatTimeline.kill()
    floatTimeline = null
  }
  if (rotationTimeline) {
    rotationTimeline.kill()
    rotationTimeline = null
  }
  
  // Matar TODOS los tweens en logoMesh (incluyendo scale, position, rotation)
  gsap.killTweensOf(logoMesh)
  gsap.killTweensOf(logoMesh.scale)
  gsap.killTweensOf(logoMesh.position)
  gsap.killTweensOf(logoMesh.rotation)
  
  // Si hay floatGroup, matar sus tweens también
  if (floatGroup) {
    gsap.killTweensOf(floatGroup)
    gsap.killTweensOf(floatGroup.position)
  }
  
  // Centrar el logo para la animación
  logoMesh.rotation.set(0, 0, 0)
  logoMesh.position.set(0, 0, 0)
  
  if (floatGroup) {
    floatGroup.rotation.set(0, 0, 0)
    floatGroup.position.set(0, 0, 0)
  }
  
  // Animar el floatGroup (contenedor del logoMesh) para que el scale sea visible
  const targetToAnimate = floatGroup || logoMesh
  const initialCameraZ = camera.position.z
  
  // ATRAVESAR el eje del logo: cámara cruza COMPLETAMENTE hacia valores negativos de Z
  // La cámara va de z=4 a z=-6, pasando por detrás del logo
  const targetCameraZ = -6 // Atraviesa completamente el umbral del eje Z del logo
  
  // El logo se mueve mucho más hacia adelante para amplificar el efecto de atravesar
  const targetLogoZ = 6 // El logo avanza significativamente mientras la cámara lo atraviesa
  
  // Reducir duración a la mitad para zoom más rápido
  const zoomDuration = duration * 0.5
  
  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: resolve
    })
    
    // Animar SCALE, CÁMARA y POSICIÓN simultáneamente
    // El scale crece enormemente
    tl.to(targetToAnimate.scale, {
      x: targetScale,
      y: targetScale,
      z: targetScale,
      duration: zoomDuration,
      ease: 'power2.in'
    }, 0)
    
    // La cámara atraviesa el eje Z del logo (va hacia valores negativos)
    tl.to(camera.position, {
      z: targetCameraZ,
      duration: zoomDuration,
      ease: 'power2.in'
    }, 0)
    
    // El logo también se mueve hacia adelante (z positivo) amplificando el efecto
    tl.to(targetToAnimate.position, {
      z: targetLogoZ,
      duration: zoomDuration,
      ease: 'power2.in'
    }, 0)
    
    // Fade out MUY TARDE para que las letras sean visibles mientras se atraviesan
    // Empieza al 95% del zoom y dura solo 5% (fade muy rápido al final)
    // Animar la opacidad del material de cada mesh hijo
    logoMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        tl.to(child.material, {
          opacity: 0,
          duration: zoomDuration * 0.05,
          ease: 'power2.in'
        }, zoomDuration * 0.95)
      }
    })
  })
}

// Método para animación de entrada (reversa de exit)
const animateEnter = (duration = 2) => {
  if (!logoMesh) {
    console.error('Logo3D: logoMesh not available for enter animation')
    return Promise.reject(new Error('logoMesh not available'))
  }
  
  // Matar animaciones previas
  if (floatTimeline) {
    floatTimeline.kill()
    floatTimeline = null
  }
  if (rotationTimeline) {
    rotationTimeline.kill()
    rotationTimeline = null
  }
  
  gsap.killTweensOf(logoMesh)
  gsap.killTweensOf(logoMesh.scale)
  gsap.killTweensOf(logoMesh.position)
  gsap.killTweensOf(logoMesh.rotation)
  gsap.killTweensOf(camera.position)
  
  if (floatGroup) {
    gsap.killTweensOf(floatGroup)
    gsap.killTweensOf(floatGroup.position)
    gsap.killTweensOf(floatGroup.scale)
  }
  
  const targetToAnimate = floatGroup || logoMesh
  const targetScale = logoMesh.userData.targetScale || 1
  const targetCameraZ = 4 // Posición original de la cámara
  
  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        // Reactivar animaciones de float y rotación
        setupFloatAnimation()
        resolve()
      }
    })
    
    // Restaurar opacidad primero (fade in rápido al inicio)
    logoMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        tl.to(child.material, {
          opacity: 1,
          duration: duration * 0.15,
          ease: 'power2.out'
        }, 0)
      }
    })
    
    // Restaurar scale, posición de cámara y posición Z del logo simultáneamente
    tl.to(targetToAnimate.scale, {
      x: targetScale,
      y: targetScale,
      z: targetScale,
      duration,
      ease: 'power2.out'
    }, 0)
    
    tl.to(camera.position, {
      z: targetCameraZ,
      duration,
      ease: 'power2.out'
    }, 0)
    
    // Restaurar posición Z del logo a su posición original (centro)
    tl.to(targetToAnimate.position, {
      z: 0,
      duration,
      ease: 'power2.out'
    }, 0)
  })
}

const getCurrentScale = () => {
  const targetToCheck = floatGroup || logoMesh
  return targetToCheck ? targetToCheck.scale.x : 0
}

const getTargetScale = () => {
  return logoMesh?.userData.targetScale || 0
}

defineExpose({
  animateExit,
  animateEnter,
  getCurrentScale,
  getTargetScale,
  logoMesh: () => logoMesh
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  stopRendering()
  renderer?.dispose()
  floatTimeline?.kill()
  rotationTimeline?.kill()
  returnTween?.kill()
  
  // Limpiar controles de mouse
  if (containerRef.value?._cleanupMouseControls) {
    containerRef.value._cleanupMouseControls()
  }
  
  scene?.clear()
})
</script>

<template>
  <div class="logo-3d" ref="containerRef">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.logo-3d {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  pointer-events: auto;
  cursor: grab;
}

.logo-3d:active {
  cursor: grabbing;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>

