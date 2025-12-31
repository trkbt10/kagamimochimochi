import * as THREE from 'three'

type TextSpriteOptions = {
  fontSize?: number
  fontFamily?: string
  color?: string
  strokeColor?: string
  strokeWidth?: number
  canvasWidth?: number
  canvasHeight?: number
}

const DEFAULT_OPTIONS: Required<TextSpriteOptions> = {
  fontSize: 64,
  fontFamily: 'sans-serif',
  color: '#FFD700',
  strokeColor: '#000000',
  strokeWidth: 4,
  canvasWidth: 512,
  canvasHeight: 128
}

/**
 * デバイスピクセル比を取得（最大2に制限）
 */
const getDevicePixelRatio = (): number => Math.min(window.devicePixelRatio || 1, 2)

const createTextCanvas = (
  text: string,
  options: Required<TextSpriteOptions>
): { canvas: HTMLCanvasElement; dpr: number } => {
  const dpr = getDevicePixelRatio()
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!

  // 高解像度Canvas
  canvas.width = options.canvasWidth * dpr
  canvas.height = options.canvasHeight * dpr

  // スケーリングして論理サイズで描画
  context.scale(dpr, dpr)

  context.fillStyle = 'rgba(0, 0, 0, 0)'
  context.fillRect(0, 0, options.canvasWidth, options.canvasHeight)

  context.font = `bold ${options.fontSize}px ${options.fontFamily}`
  context.fillStyle = options.color
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.strokeStyle = options.strokeColor
  context.lineWidth = options.strokeWidth
  context.strokeText(text, options.canvasWidth / 2, options.canvasHeight / 2)
  context.fillText(text, options.canvasWidth / 2, options.canvasHeight / 2)

  return { canvas, dpr }
}

export const createTextSprite = (text: string, size: number): THREE.Sprite => {
  const { canvas, dpr } = createTextCanvas(text, DEFAULT_OPTIONS)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(size * 4, size, 1)

  return sprite
}

type UITextSpriteOptions = {
  fontSize: number
  color: string
}

const UI_FONT_FAMILY = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif'
const UI_CANVAS_SIZE = { width: 1024, height: 256 }
const UI_STROKE_WIDTH = 6

const createUITextCanvas = (
  text: string,
  options: UITextSpriteOptions
): { canvas: HTMLCanvasElement; dpr: number } => {
  const dpr = getDevicePixelRatio()
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!

  // 高解像度Canvas
  canvas.width = UI_CANVAS_SIZE.width * dpr
  canvas.height = UI_CANVAS_SIZE.height * dpr

  // スケーリングして論理サイズで描画
  context.scale(dpr, dpr)
  context.clearRect(0, 0, UI_CANVAS_SIZE.width, UI_CANVAS_SIZE.height)

  context.font = `bold ${options.fontSize}px ${UI_FONT_FAMILY}`
  context.fillStyle = options.color
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  context.strokeStyle = '#000000'
  context.lineWidth = UI_STROKE_WIDTH
  context.strokeText(text, UI_CANVAS_SIZE.width / 2, UI_CANVAS_SIZE.height / 2)
  context.fillText(text, UI_CANVAS_SIZE.width / 2, UI_CANVAS_SIZE.height / 2)

  return { canvas, dpr }
}

export const createUITextSprite = (
  text: string,
  fontSize: number,
  color: string
): THREE.Sprite => {
  const { canvas } = createUITextCanvas(text, { fontSize, color })

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  })

  const sprite = new THREE.Sprite(material)
  sprite.scale.set(4, 1, 1)

  return sprite
}

export const updateUITextSprite = (
  sprite: THREE.Sprite,
  text: string,
  fontSize: number,
  color: string
): void => {
  const material = sprite.material as THREE.SpriteMaterial
  const oldTexture = material.map

  const { canvas } = createUITextCanvas(text, { fontSize, color })
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  material.map = texture

  oldTexture?.dispose()
}

export const updateUIContainerPosition = (
  container: THREE.Group,
  camera: THREE.Camera
): void => {
  const distance = 6
  const offsetY = 2

  const forward = new THREE.Vector3(0, 0, -1)
  forward.applyQuaternion(camera.quaternion)

  container.position.copy(camera.position)
  container.position.add(forward.multiplyScalar(distance))
  container.position.y += offsetY
  container.quaternion.copy(camera.quaternion)
}
