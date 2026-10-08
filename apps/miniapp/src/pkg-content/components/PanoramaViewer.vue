<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { t } from '../../composables/useLocale'
const props = defineProps<{ url: string; title: string }>()
const id = `panorama-${Math.random().toString(36).slice(2)}`
const error = ref(''),
  loaded = ref(false),
  flat = ref(false)
let move: (x: number, y: number, zoom?: number) => void = () => {}
let reset: () => void = () => {}
let dispose: () => void = () => {}
let serial = 0
async function initialize() {
  const sequence = ++serial
  dispose()
  loaded.value = false
  error.value = ''
  flat.value = false
  // #ifdef H5
  await nextTick()
  if (sequence !== serial) return
  const host = document.getElementById(id)
  if (!host) return
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-label', props.title)
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  canvas.style.touchAction = 'none'
  host.appendChild(canvas)
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
  if (!gl) {
    canvas.remove()
    flat.value = true
    error.value = t(
      '此浏览器无法显示球面视角，以下为原始平面全景图。',
      'This browser cannot display the spherical view. The original flat panorama is shown below.',
    )
    return
  }
  let stopped = false,
    yaw = 0,
    pitch = 0,
    fov = 75
  const shaders: WebGLShader[] = []
  const program = gl.createProgram()!
  const buffer = gl.createBuffer()!
  const texture = gl.createTexture()!
  const image = new Image()
  image.crossOrigin = 'anonymous'
  function shader(type: number, source: string) {
    const value = gl!.createShader(type)!
    shaders.push(value)
    gl!.shaderSource(value, source)
    gl!.compileShader(value)
    if (!gl!.getShaderParameter(value, gl!.COMPILE_STATUS)) throw new Error('shader')
    gl!.attachShader(program, value)
  }
  const draw = () => {
    if (stopped || !loaded.value) return
    const width = Math.max(
      1,
      Math.round(host.clientWidth * Math.min(window.devicePixelRatio || 1, 2)),
    )
    const height = Math.max(
      1,
      Math.round(host.clientHeight * Math.min(window.devicePixelRatio || 1, 2)),
    )
    canvas.width = width
    canvas.height = height
    gl.viewport(0, 0, width, height)
    gl.uniform2f(gl.getUniformLocation(program, 'viewSize'), width, height)
    gl.uniform3f(gl.getUniformLocation(program, 'camera'), yaw, pitch, (fov * Math.PI) / 360)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  move = (x, y, zoom = 0) => {
    yaw += x
    pitch = Math.max(-1.5, Math.min(1.5, pitch + y))
    fov = Math.max(35, Math.min(100, fov + zoom))
    draw()
  }
  reset = () => {
    yaw = 0
    pitch = 0
    fov = 75
    draw()
  }
  let pointer: { id: number; x: number; y: number } | null = null
  const down = (event: PointerEvent) => {
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
    canvas.setPointerCapture(event.pointerId)
  }
  const drag = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return
    move((pointer.x - event.clientX) * 0.005, (event.clientY - pointer.y) * 0.005)
    pointer.x = event.clientX
    pointer.y = event.clientY
  }
  const up = () => {
    pointer = null
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', drag)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw)
  observer?.observe(host)
  window.addEventListener('resize', draw)
  dispose = () => {
    stopped = true
    image.onload = null
    image.onerror = null
    observer?.disconnect()
    window.removeEventListener('resize', draw)
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', drag)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    gl.deleteTexture(texture)
    gl.deleteBuffer(buffer)
    shaders.forEach((s) => gl.deleteShader(s))
    gl.deleteProgram(program)
    canvas.remove()
    move = () => {}
    reset = () => {}
  }
  try {
    shader(
      gl.VERTEX_SHADER,
      'attribute vec2 position; varying vec2 screen; void main(){screen=position;gl_Position=vec4(position,0.0,1.0);}',
    )
    shader(
      gl.FRAGMENT_SHADER,
      `precision mediump float; varying vec2 screen; uniform sampler2D panorama; uniform vec2 viewSize; uniform vec3 camera;
      void main(){vec3 d=normalize(vec3(screen.x*viewSize.x/viewSize.y*tan(camera.z),screen.y*tan(camera.z),-1.0));
        float cp=cos(camera.y),sp=sin(camera.y);d=vec3(d.x,cp*d.y-sp*d.z,sp*d.y+cp*d.z);
        float cy=cos(camera.x),sy=sin(camera.x);d=vec3(cy*d.x+sy*d.z,d.y,-sy*d.x+cy*d.z);
        vec2 uv=vec2(atan(d.z,d.x)/6.2831853+0.5,0.5-asin(clamp(d.y,-1.0,1.0))/3.14159265);gl_FragColor=texture2D(panorama,uv);}`,
    )
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('program')
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    image.onload = () => {
      if (stopped || sequence !== serial) return
      try {
        if (
          image.width > 8192 ||
          image.height > 4096 ||
          Math.abs(image.width / image.height - 2) > 0.05 ||
          image.width > gl.getParameter(gl.MAX_TEXTURE_SIZE)
        )
          throw new Error('dimensions')
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
        if (gl.getError() !== gl.NO_ERROR) throw new Error('texture')
        loaded.value = true
        draw()
      } catch {
        error.value = t(
          '球面图片须为2:1等距柱状全景，并允许跨域读取。以下显示平面原图。',
          'Use a 2:1 equirectangular panorama with cross-origin access enabled. The original flat image is shown below.',
        )
        flat.value = true
      }
    }
    image.onerror = () => {
      if (stopped) return
      error.value = t(
        '全景图片无法读取，请重试或联系编辑检查图片地址。',
        'The panorama could not be loaded. Retry or ask an editor to check its URL.',
      )
      flat.value = true
    }
    image.src = props.url
  } catch {
    error.value = t(
      '全景渲染不可用，以下为平面原图。',
      'Panorama rendering is unavailable. The original flat image is shown below.',
    )
    flat.value = true
  }
  // #endif
  // #ifndef H5
  flat.value = true
  // #endif
}
watch(() => props.url, initialize, { immediate: true })
onBeforeUnmount(() => {
  serial++
  dispose()
})
</script>
<template>
  <view class="showcase-panel panorama-viewer">
    <text class="showcase-card-title">{{ t('展馆全景', 'Panorama') }}</text>
    <!-- #ifdef H5 -->
    <view v-show="!flat" :id="id" class="panorama-canvas" />
    <text v-if="!loaded && !flat" role="status">{{ t('正在加载全景…', 'Loading panorama…') }}</text>
    <view v-if="loaded && !flat" class="panorama-controls">
      <wd-button size="small" variant="plain" @click="move(-0.25, 0)">
        {{ t('向左', 'Left') }}
      </wd-button>
      <wd-button size="small" variant="plain" @click="move(0.25, 0)">
        {{ t('向右', 'Right') }}
      </wd-button>
      <wd-button size="small" variant="plain" @click="move(0, 0.2)">
        {{ t('向上', 'Up') }}
      </wd-button>
      <wd-button size="small" variant="plain" @click="move(0, -0.2)">
        {{ t('向下', 'Down') }}
      </wd-button>
      <wd-button size="small" variant="plain" @click="move(0, 0, -10)">
        {{ t('放大', 'Zoom in') }}
      </wd-button>
      <wd-button size="small" variant="plain" @click="move(0, 0, 10)">
        {{ t('缩小', 'Zoom out') }}
      </wd-button>
      <wd-button size="small" variant="plain" @click="reset">
        {{ t('重置视角', 'Reset view') }}
      </wd-button>
    </view>
    <text v-if="loaded && !flat" class="showcase-note">
      {{
        t(
          '拖动查看四周，或使用方向按钮。此视图使用编辑提供的全景照片。',
          'Drag to look around, or use the direction buttons. This view uses the panoramic photo supplied by an editor.',
        )
      }}
    </text>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <text class="showcase-note">
      {{
        t(
          '当前小程序显示平面全景图；球面交互请使用网页版。',
          'This app shows a flat panorama. Use the website for the spherical view.',
        )
      }}
    </text>
    <!-- #endif -->
    <text v-if="error" role="alert">{{ error }}</text>
    <image v-if="flat" :src="url" :alt="title" mode="widthFix" class="panorama-flat" />
    <wd-button v-if="error" size="small" variant="plain" @click="initialize">
      {{ t('重试加载', 'Retry') }}
    </wd-button>
  </view>
</template>
<style scoped>
.panorama-viewer {
  display: grid;
  gap: 14px;
}
.panorama-canvas {
  width: 100%;
  height: 360px;
  background: #24201b;
  border-radius: 10px;
  overflow: hidden;
}
.panorama-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.panorama-flat {
  width: 100%;
}
@media (max-width: 600px) {
  .panorama-canvas {
    height: 260px;
  }
}
</style>
