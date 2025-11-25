<script setup>
import { computed } from 'vue'

const props = defineProps({
  scenes: {
    type: Array,
    required: true
  },
  currentSceneIndex: {
    type: Number,
    default: 0
  },
  sceneProps: {
    type: Array,
    default: () => []
  }
})

const sceneLayers = computed(() =>
  props.scenes.map((component, index) => ({
    component,
    isActive: index === props.currentSceneIndex,
    extraProps: props.sceneProps[index] || null
  }))
)
</script>

<template>
  <div class="scene-manager">
    <component
      v-for="({ component, isActive, extraProps }, index) in sceneLayers"
      :key="index"
      :is="component"
      :active="isActive"
      class="scene-layer"
      :aria-hidden="!isActive"
      v-show="isActive"
      v-bind="extraProps || {}"
    />
  </div>
</template>

<style scoped>
.scene-manager {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.scene-layer {
  position: absolute;
  inset: 0;
}
</style>

<!--
  Para añadir una nueva escena:
  1. Crea un componente SceneX.vue con su lógica de Three.js.
  2. Impórtalo en la vista y agrégalo al arreglo "scenes".
  3. Usa "sceneProps" para pasar propiedades personalizadas (e.g. progreso de scroll).
-->



