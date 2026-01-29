<template>
  <div class="pill-with-circle" :data-pill-id="pillId">
    <Pill3D 
      ref="pill3DRef"
      :interactive="interactive"
      :pill-id="pillId"
    />
    <!-- Círculo de texto que aparece después de la animación de entrada -->
    <!-- Solo visible cuando tenemos texto y estamos activos en la escena 3 -->
    <div 
      v-if="circularText && active" 
      ref="circleContainerRef"
      class="pill-circular-text"
    >
      <CircularText 
        :text="circularText" 
        :rotating="true" 
        :rotation-speed="initialRotationSpeed.value"
        :initial-offset="initialOffset.value"
        :rotation-direction="rotationDirection.value"
        :radius="135"
        :font-size="31"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import Pill3D from './Pill3D.vue'
import CircularText from './CircularText.vue'
import gsap from 'gsap'

const props = defineProps({
  interactive: {
    type: Boolean,
    default: false
  },
  pillId: {
    type: String,
    default: 'center'
  },
  circularText: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: false // Solo mostrar círculo cuando estamos activos en la escena 3
  }
})

const pill3DRef = ref(null)
const circleContainerRef = ref(null)
const showCircle = ref(false)
let positionUpdateFrame = null

// Generar offset inicial aleatorio y velocidad de rotación ligeramente diferente para cada círculo
// Estos valores se generan una vez cuando se crea el componente
const initialOffset = ref(Math.random() * 360) // Ángulo inicial aleatorio (0-360 grados)
// Velocidad base 30s, con variación aleatoria de ±30% (21s a 39s aprox)
const speedVariation = 0.7 + Math.random() * 0.6 // Entre 0.7 y 1.3
const initialRotationSpeed = ref(30 * speedVariation)
const rotationDirection = ref(Math.random() < 0.5 ? 1 : -1)

// Exponer métodos de Pill3D para que SceneVideo pueda controlarlos
const setScaleFullScreen = () => {
  return pill3DRef.value?.setScaleFullScreen()
}

const setOpacity = (value) => {
  return pill3DRef.value?.setOpacity(value)
}

const setTargetPosition = (x, y, z) => {
  return pill3DRef.value?.setTargetPosition(x, y, z)
}

const hitTest = (clientX, clientY) => {
  return pill3DRef.value?.hitTest?.(clientX, clientY) ?? false
}

const beginDrag = (clientX, clientY) => {
  return pill3DRef.value?.beginDrag?.(clientX, clientY) ?? false
}

const setHover = (hovered) => {
  pill3DRef.value?.setHover?.(hovered)
}

const triggerSpinBoost = (durationSeconds = 3, peakMultiplier = 3.5) => {
  pill3DRef.value?.triggerSpinBoost?.(durationSeconds, peakMultiplier)
}

const animateFadeIn = async (duration) => {
  if (!pill3DRef.value) return Promise.resolve()
  return pill3DRef.value.animateFadeIn(duration)
}

const animateToCenterWithRotation = async (duration) => {
  if (!pill3DRef.value) return Promise.resolve()
  
  // Iniciar actualización de posición durante la animación
  if (props.active) {
    startPositionUpdate()
  }
  
  // Esperar a que termine la animación de la pastilla
  await pill3DRef.value.animateToCenterWithRotation(duration)
  
  // Después de que termine, mostrar el círculo con fade in
  // Esperar a que el elemento esté en el DOM si aún no está
  await nextTick()
  
  if (circleContainerRef.value && props.circularText && props.active) {
    // Actualizar posición antes de hacer fade in
    updateCirclePosition()
    
    // Asegurarnos de que empiece invisible
    gsap.set(circleContainerRef.value, { opacity: 0 })
    
    // Hacer fade in del círculo
    return gsap.to(circleContainerRef.value, {
      opacity: 1,
      duration: 0.8,
      ease: 'power2.out',
      onComplete: () => {
        showCircle.value = true
      }
    })
  }
  
  return Promise.resolve()
}

const stopFloatingRotation = () => {
  return pill3DRef.value?.stopFloatingRotation()
}

const reset = () => {
  showCircle.value = false
  if (circleContainerRef.value) {
    gsap.set(circleContainerRef.value, { opacity: 0 })
  }
  return pill3DRef.value?.reset()
}

// Actualizar posición del círculo para que coincida con la pastilla 3D
const updateCirclePosition = () => {
  if (!pill3DRef.value || !circleContainerRef.value || !props.active) {
    return
  }
  
  const screenPos = pill3DRef.value.getScreenPosition()
  if (screenPos) {
    // Usar las coordenadas proyectadas para posicionar el círculo
    circleContainerRef.value.style.left = `${screenPos.x}%`
    circleContainerRef.value.style.top = `${screenPos.y}%`
    circleContainerRef.value.style.transform = 'translate(-50%, -50%)'
  }
}

// Loop de actualización de posición
const startPositionUpdate = () => {
  if (positionUpdateFrame) return
  
  const update = () => {
    if (props.active && circleContainerRef.value) {
      updateCirclePosition()
      positionUpdateFrame = requestAnimationFrame(update)
    } else {
      positionUpdateFrame = null
    }
  }
  positionUpdateFrame = requestAnimationFrame(update)
}

const stopPositionUpdate = () => {
  if (positionUpdateFrame) {
    cancelAnimationFrame(positionUpdateFrame)
    positionUpdateFrame = null
  }
}

// Inicializar el círculo como invisible cuando se monta
onMounted(() => {
  if (circleContainerRef.value) {
    gsap.set(circleContainerRef.value, { opacity: 0 })
  }
  // Iniciar actualización de posición cuando esté activo
  if (props.active) {
    startPositionUpdate()
  }
})

onBeforeUnmount(() => {
  stopPositionUpdate()
})

// Watch para ocultar el círculo cuando salimos de la escena 3
watch(() => props.active, (newVal) => {
  if (!newVal) {
    showCircle.value = false
    stopPositionUpdate()
    if (circleContainerRef.value) {
      gsap.set(circleContainerRef.value, { opacity: 0 })
    }
  } else {
    // Cuando volvemos a activar, asegurarnos de que el círculo esté invisible inicialmente
    showCircle.value = false
    startPositionUpdate()
    nextTick(() => {
      if (circleContainerRef.value) {
        gsap.set(circleContainerRef.value, { opacity: 0 })
        updateCirclePosition()
      }
    })
  }
})

// Exponer métodos al padre
defineExpose({
  setScaleFullScreen,
  setOpacity,
  setTargetPosition,
  hitTest,
  beginDrag,
  setHover,
  triggerSpinBoost,
  animateFadeIn,
  animateToCenterWithRotation,
  stopFloatingRotation,
  reset
})
</script>

<style scoped>
.pill-with-circle {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* Círculo de texto centrado en relación a la pastilla */
/* La posición se actualiza dinámicamente usando las coordenadas proyectadas de Three.js */
/* Tamaño aumentado 40%: 300px * 1.4 = 420px */
.pill-circular-text {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 370px; /* +10%: 336px * 1.1 = 369.6px */
  height: 370px; /* +10%: 336px * 1.1 = 369.6px */
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1; /* Detrás del canvas 3D */
  opacity: 0; /* Inicialmente invisible */
}
</style>
