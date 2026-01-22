<template>
  <div class="circular-text-container">
    <svg class="circular-text-svg" viewBox="0 0 500 500">
      <defs>
        <!-- Definir el path circular invisible (radio: 74) -->
        <path
          id="circlePath"
          d="M 250, 250
             m -74, 0
             a 74,74 0 1,1 148,0
             a 74,74 0 1,1 -148,0"
          fill="none"
        />
      </defs>
      
      <!-- Texto que sigue el path circular -->
      <text class="circular-text" :style="textStyle">
        <textPath href="#circlePath" startOffset="50%" text-anchor="middle">
          {{ text }}
        </textPath>
      </text>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  text: {
    type: String,
    default: 'Supports Healthy Fat Metabolism'
  },
  radius: {
    type: Number,
    default: 74 // Radio del círculo en unidades SVG (reducido otro 30%)
  },
  fontSize: {
    type: Number,
    default: 12 // Reducido a la mitad
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
    default: '0.05em'
  }
})

const textStyle = computed(() => ({
  fontSize: `${props.fontSize}px`,
  fill: props.color,
  fontWeight: props.fontWeight,
  letterSpacing: props.letterSpacing,
  fontFamily: 'system-ui, -apple-system, sans-serif'
}))
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
