<template>
  <div class="circular-text-container" ref="svgContainerRef">
    <svg class="circular-text-svg" viewBox="0 0 500 500">
      <defs>
        <!-- Definir el path circular invisible usando el radio dinámico -->
        <path
          :id="circlePathId"
          :d="circlePath"
          fill="none"
        />
      </defs>
      
      <!-- Texto que sigue el path circular -->
      <text class="circular-text" :style="textStyle">
        <textPath ref="textPathRef" :href="`#${circlePathId}`" startOffset="50%" text-anchor="middle">
          {{ text }}
        </textPath>
      </text>
    </svg>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick } from 'vue'
import gsap from 'gsap'

const props = defineProps({
  text: {
    type: String,
    default: 'Supports Healthy Fat Metabolism'
  },
  radius: {
    type: Number,
    default: 74 // Radio del círculo en unidades SVG (tamaño original para escena 2)
  },
  fontSize: {
    type: Number,
    default: 12 // Tamaño original para escena 2
  },
  color: {
    type: String,
    default: '#1B4544' // Color oscuro por defecto
  },
  fontWeight: {
    type: Number,
    default: 500
  },
  letterSpacing: {
    type: String,
    default: '0em' // Espaciado estándar (más compacto)
  },
  rotating: {
    type: Boolean,
    default: false // Si debe rotar continuamente
  },
  rotationSpeed: {
    type: Number,
    default: 20 // Duración en segundos para una rotación completa (más bajo = más rápido)
  },
  initialOffset: {
    type: Number,
    default: 0 // Offset inicial aleatorio en grados (0-360)
  },
  rotationDirection: {
    type: Number,
    default: 1 // 1 = clockwise, -1 = counterclockwise
  }
})

const textPathRef = ref(null)
const svgContainerRef = ref(null)
let rotationTween = null

// Generar un ID único para cada instancia del componente
const circlePathId = `circlePath-${Math.random().toString(36).substr(2, 9)}`

// Calcular el path del círculo dinámicamente basado en el radio
const circlePath = computed(() => {
  const r = props.radius
  return `M 250, 250
    m -${r}, 0
    a ${r},${r} 0 1,1 ${r * 2},0
    a ${r},${r} 0 1,1 -${r * 2},0`
})

const textStyle = computed(() => ({
  fontSize: `${props.fontSize}px`,
  fill: props.color,
  fontWeight: props.fontWeight,
  letterSpacing: props.letterSpacing,
  fontFamily: 'system-ui, -apple-system, sans-serif'
}))

onMounted(async () => {
  if (props.rotating) {
    // Esperar a que el DOM esté completamente renderizado
    await nextTick()
    
    if (svgContainerRef.value) {
      // Nueva estrategia: rotar el SVG completo en lugar de animar startOffset
      // Esto evita que los caracteres desaparezcan
      const rotation = { value: props.initialOffset } // Empezar desde el offset inicial aleatorio
      const dir = props.rotationDirection === -1 ? -1 : 1
      
      rotationTween = gsap.to(rotation, {
        value: rotation.value + 360 * dir, // Rotación completa (360 grados) con dirección
        duration: props.rotationSpeed,
        ease: 'none', // Rotación constante sin aceleración
        repeat: -1, // Repetir infinitamente
        onUpdate: () => {
          if (svgContainerRef.value) {
            // Aplicar rotación al contenedor SVG completo
            // Usar módulo para mantener el valor manejable
            const currentRotation = rotation.value % 360
            // Combinar translate (del CSS) con rotate (de la animación)
            svgContainerRef.value.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`
          }
        }
      })
    }
  }
})

onBeforeUnmount(() => {
  if (rotationTween) {
    rotationTween.kill()
    rotationTween = null
  }
})
</script>

<style scoped>
.circular-text-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 7; /* Por encima de la partícula central (z-index: 6) */
  transform-origin: center center; /* Rotar desde el centro */
}

.circular-text-svg {
  width: 100%;
  height: 100%;
}

.circular-text {
  text-transform: none;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .circular-text {
    font-size: 9px;
  }
}

@media (max-width: 480px) {
  .circular-text {
    font-size: 7px;
  }
}
</style>
