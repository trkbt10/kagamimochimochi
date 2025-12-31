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
 * デバイスピクセル比を取得（最大2に制限）
 */
function getDevicePixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, 2)
}

/**
 * スプライトを作成する
 */
function createSprite(canvas: HTMLCanvasElement, dpr: number = 1): THREE.Sprite {
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
  // dprを考慮して論理サイズでスケール設定
  sprite.scale.set((canvas.width / dpr) * scale, (canvas.height / dpr) * scale, 1)

  return sprite
}

/**
 * パチンコ風テキストスプライトのオプション
 */
export type PachinkoTextOptions = {
  text: string
  fontSize?: number
  fontFamily?: string
  // 多重縁取り（外側から内側へ）
  outlines?: Array<{ color: string; width: number }>
  // メタリックグラデーション（上から下へ）
  gradientColors?: string[]
  // ベベル効果
  bevelHighlight?: string
  bevelShadow?: string
  // 外側グロー
  glowColor?: string
  glowBlur?: number
  // 内側ハイライト
  innerHighlight?: boolean
}

/**
 * パチンコ風のギラギラテキストスプライトを作成する
 */
export function createPachinkoTextSprite(options: PachinkoTextOptions): THREE.Sprite {
  const {
    text,
    fontSize = 48,
    fontFamily = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif",
    outlines = [
      { color: '#000000', width: 16 },
      { color: '#8B0000', width: 12 },
      { color: '#FF4500', width: 8 },
      { color: '#FFD700', width: 4 }
    ],
    gradientColors = ['#FFFACD', '#FFD700', '#DAA520', '#B8860B'],
    bevelHighlight = 'rgba(255,255,255,0.9)',
    bevelShadow = 'rgba(0,0,0,0.5)',
    glowColor = '#FFD700',
    glowBlur = 25,
    innerHighlight = true
  } = options

  const dpr = getDevicePixelRatio()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // フォント設定
  const font = `bold ${fontSize}px ${fontFamily}`
  ctx.font = font

  // テキスト計測
  const textMetrics = ctx.measureText(text)
  const textWidth = textMetrics.width
  const textHeight = fontSize

  // 最大の縁取り幅を取得
  const maxOutlineWidth = outlines.reduce((max, o) => Math.max(max, o.width), 0)
  const padding = maxOutlineWidth + glowBlur

  // キャンバスサイズ
  const canvasWidth = textWidth + padding * 2
  const canvasHeight = textHeight * 1.2 + padding * 2

  canvas.width = canvasWidth * dpr
  canvas.height = canvasHeight * dpr
  ctx.scale(dpr, dpr)

  // 描画位置
  const x = canvasWidth / 2
  const y = canvasHeight / 2

  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 1. 外側グロー（複数回描画で強化）
  if (glowColor && glowBlur > 0) {
    ctx.save()
    ctx.shadowColor = glowColor
    ctx.shadowBlur = glowBlur
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.fillStyle = glowColor
    ctx.globalAlpha = 0.3
    for (let i = 0; i < 5; i++) {
      ctx.fillText(text, x, y)
    }
    ctx.restore()
  }

  // 2. 多重縁取り（外側から内側へ）
  const sortedOutlines = [...outlines].sort((a, b) => b.width - a.width)
  for (const outline of sortedOutlines) {
    ctx.save()
    ctx.strokeStyle = outline.color
    ctx.lineWidth = outline.width
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    // 縁取りにも軽くシャドウを付けて立体感
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 3
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1
    ctx.strokeText(text, x, y)
    ctx.restore()
  }

  // 3. メタリックグラデーション本体
  const gradient = ctx.createLinearGradient(x, y - textHeight / 2, x, y + textHeight / 2)
  const stops = gradientColors.length
  gradientColors.forEach((color, i) => {
    gradient.addColorStop(i / (stops - 1), color)
  })

  ctx.save()
  ctx.fillStyle = gradient
  ctx.fillText(text, x, y)
  ctx.restore()

  // 4. ベベルエンボス（上半分ハイライト）
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, canvasWidth, y)
  ctx.clip()
  ctx.fillStyle = bevelHighlight
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillText(text, x, y - 1)
  ctx.restore()

  // 5. ベベルエンボス（下半分シャドウ）
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, y, canvasWidth, canvasHeight - y)
  ctx.clip()
  ctx.fillStyle = bevelShadow
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillText(text, x, y + 1)
  ctx.restore()

  // 6. 内側ハイライト線（反射）
  if (innerHighlight) {
    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    const highlightGradient = ctx.createLinearGradient(
      x,
      y - textHeight / 2,
      x,
      y - textHeight / 4
    )
    highlightGradient.addColorStop(0, 'rgba(255,255,255,0.8)')
    highlightGradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = highlightGradient
    ctx.fillText(text, x, y)
    ctx.restore()
  }

  return createSprite(canvas, dpr)
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

  const dpr = getDevicePixelRatio()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // 論理サイズでフォントを設定してテキスト計測
  ctx.font = `bold ${fontSize}px ${fontFamily}`

  const metrics = calculateTextMetrics(ctx, text, fontSize, maxWidth)
  const dimensions = calculateCanvasDimensions(
    metrics.width,
    metrics.height,
    padding,
    borderWidth,
    glowBlur
  )

  // Canvasを高解像度化
  canvas.width = dimensions.width * dpr
  canvas.height = dimensions.height * dpr

  // 描画コンテキストをスケール
  ctx.scale(dpr, dpr)

  drawBackground(ctx, backgroundColor, borderWidth, glowBlur, dimensions.width, dimensions.height)
  drawBorder(ctx, borderColor, borderWidth, glowBlur, dimensions.width, dimensions.height)

  ctx.font = `bold ${fontSize}px ${fontFamily}`
  ctx.textAlign = textAlign
  ctx.textBaseline = 'middle'

  applyShadowEffects(ctx, glowColor, glowBlur, shadowColor, shadowBlur)

  const xOffset = calculateTextXOffset(textAlign, dimensions.width, padding, glowBlur)
  const startY = glowBlur + padding + borderWidth

  drawTextLines(ctx, metrics.lines, color, xOffset, startY, metrics.lineHeight)

  return createSprite(canvas, dpr)
}
