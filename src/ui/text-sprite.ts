import * as THREE from 'three'
import { drawRoundRect } from './canvas-helpers'

/**
 * テキストスプライトのオプション
 */
export type TextSpriteOptions = {
  text: string
  fontSize?: number
  fontFamily?: string
  color?: string
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  padding?: number
  maxWidth?: number
  textAlign?: 'left' | 'center' | 'right'
  shadowColor?: string
  shadowBlur?: number
  glowColor?: string
  glowBlur?: number
}

type TextMetrics = {
  width: number
  height: number
  lineHeight: number
  lines: string[]
}

type CanvasDimensions = {
  width: number
  height: number
}

/**
 * テキストの幅を計測する
 */
function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxWidth?: number
): number {
  const measuredWidth = lines.reduce((max, line) => {
    const metrics = ctx.measureText(line)
    return Math.max(max, metrics.width)
  }, 0)

  return applyMaxWidth(measuredWidth, maxWidth)
}

function applyMaxWidth(width: number, maxWidth?: number): number {
  if (maxWidth === undefined) return width
  return Math.min(width, maxWidth)
}

/**
 * テキストのメトリクスを計算する
 */
function calculateTextMetrics(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  maxWidth?: number
): TextMetrics {
  const lines = text.split('\n')
  const width = measureTextWidth(ctx, lines, maxWidth)
  const lineHeight = fontSize * 1.3
  const height = lineHeight * lines.length

  return { width, height, lineHeight, lines }
}

/**
 * キャンバスのサイズを計算する
 */
function calculateCanvasDimensions(
  textWidth: number,
  textHeight: number,
  padding: number,
  borderWidth: number,
  glowBlur: number
): CanvasDimensions {
  return {
    width: textWidth + padding * 2 + borderWidth * 2 + glowBlur * 2,
    height: textHeight + padding * 2 + borderWidth * 2 + glowBlur * 2
  }
}

/**
 * 背景を描画する
 */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  backgroundColor: string,
  borderWidth: number,
  glowBlur: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (backgroundColor === 'transparent') return

  ctx.fillStyle = backgroundColor
  if (borderWidth > 0) {
    drawRoundRect(
      ctx,
      glowBlur,
      glowBlur,
      canvasWidth - glowBlur * 2,
      canvasHeight - glowBlur * 2,
      15
    )
    ctx.fill()
  } else {
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  }
}

/**
 * 枠線を描画する
 */
function drawBorder(
  ctx: CanvasRenderingContext2D,
  borderColor: string | undefined,
  borderWidth: number,
  glowBlur: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!borderColor || borderWidth <= 0) return

  ctx.strokeStyle = borderColor
  ctx.lineWidth = borderWidth
  drawRoundRect(
    ctx,
    glowBlur + borderWidth / 2,
    glowBlur + borderWidth / 2,
    canvasWidth - glowBlur * 2 - borderWidth,
    canvasHeight - glowBlur * 2 - borderWidth,
    15
  )
  ctx.stroke()
}

/**
 * シャドウ・グロー効果を適用する
 */
function applyShadowEffects(
  ctx: CanvasRenderingContext2D,
  glowColor: string | undefined,
  glowBlur: number,
  shadowColor: string | undefined,
  shadowBlur: number
): void {
  if (glowColor && glowBlur > 0) {
    ctx.shadowColor = glowColor
    ctx.shadowBlur = glowBlur
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }

  if (shadowColor && shadowBlur > 0) {
    ctx.shadowColor = shadowColor
    ctx.shadowBlur = shadowBlur
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
  }
}

/**
 * テキスト配置に応じたX座標を計算する
 */
function calculateTextXOffset(
  textAlign: 'left' | 'center' | 'right',
  canvasWidth: number,
  padding: number,
  glowBlur: number
): number {
  const alignmentMap: Record<'left' | 'center' | 'right', number> = {
    center: canvasWidth / 2,
    right: canvasWidth - padding - glowBlur,
    left: padding + glowBlur
  }
  return alignmentMap[textAlign]
}

/**
 * テキストを描画する
 */
function drawTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  color: string,
  xOffset: number,
  startY: number,
  lineHeight: number
): void {
  ctx.fillStyle = color
  lines.forEach((line, i) => {
    const y = startY + lineHeight / 2 + i * lineHeight
    ctx.fillText(line, xOffset, y)
  })
}

/**
 * スプライトを作成する
 */
function createSprite(canvas: HTMLCanvasElement): THREE.Sprite {
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  })

  const sprite = new THREE.Sprite(material)
  const scale = 0.01
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1)

  return sprite
}

/**
 * テキストスプライトを作成する
 */
export function createTextSprite(options: TextSpriteOptions): THREE.Sprite {
  const {
    text,
    fontSize = 48,
    fontFamily = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif",
    color = '#ffffff',
    backgroundColor = 'transparent',
    borderColor,
    borderWidth = 0,
    padding = 20,
    maxWidth,
    textAlign = 'center',
    shadowColor,
    shadowBlur = 0,
    glowColor,
    glowBlur = 0
  } = options

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  ctx.font = `bold ${fontSize}px ${fontFamily}`

  const metrics = calculateTextMetrics(ctx, text, fontSize, maxWidth)
  const dimensions = calculateCanvasDimensions(
    metrics.width,
    metrics.height,
    padding,
    borderWidth,
    glowBlur
  )

  canvas.width = dimensions.width
  canvas.height = dimensions.height

  drawBackground(ctx, backgroundColor, borderWidth, glowBlur, dimensions.width, dimensions.height)
  drawBorder(ctx, borderColor, borderWidth, glowBlur, dimensions.width, dimensions.height)

  ctx.font = `bold ${fontSize}px ${fontFamily}`
  ctx.textAlign = textAlign
  ctx.textBaseline = 'middle'

  applyShadowEffects(ctx, glowColor, glowBlur, shadowColor, shadowBlur)

  const xOffset = calculateTextXOffset(textAlign, dimensions.width, padding, glowBlur)
  const startY = glowBlur + padding + borderWidth

  drawTextLines(ctx, metrics.lines, color, xOffset, startY, metrics.lineHeight)

  return createSprite(canvas)
}
