import { ref } from 'vue'
import type { FontsLoadResult } from './loadFonts'
export const fontStatus = ref<FontsLoadResult|null>(null)
