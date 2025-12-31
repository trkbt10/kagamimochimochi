import * as THREE from 'three'

/**
 * テキストスプライトを作成する
 */
export interface TextSpriteOptions {
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

  // フォント設定（計測用）
  ctx.font = `bold ${fontSize}px ${fontFamily}`

  // テキストサイズを計測
  const lines = text.split('\n')
  let textWidth = 0
  for (const line of lines) {
    const metrics = ctx.measureText(line)
    textWidth = Math.max(textWidth, metrics.width)
  }

  if (maxWidth) {
    textWidth = Math.min(textWidth, maxWidth)
  }

  const lineHeight = fontSize * 1.3
  const textHeight = lineHeight * lines.length

  // キャンバスサイズを設定
  const canvasWidth = textWidth + padding * 2 + borderWidth * 2 + glowBlur * 2
  const canvasHeight = textHeight + padding * 2 + borderWidth * 2 + glowBlur * 2

  canvas.width = canvasWidth
  canvas.height = canvasHeight

  // 背景を描画
  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor
    if (borderWidth > 0) {
      roundRect(ctx, glowBlur, glowBlur, canvasWidth - glowBlur * 2, canvasHeight - glowBlur * 2, 15)
      ctx.fill()
    } else {
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    }
  }

  // 枠を描画
  if (borderColor && borderWidth > 0) {
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth
    roundRect(ctx, glowBlur + borderWidth / 2, glowBlur + borderWidth / 2, canvasWidth - glowBlur * 2 - borderWidth, canvasHeight - glowBlur * 2 - borderWidth, 15)
    ctx.stroke()
  }

  // フォント再設定
  ctx.font = `bold ${fontSize}px ${fontFamily}`
  ctx.textAlign = textAlign
  ctx.textBaseline = 'middle'

  // グロー効果
  if (glowColor && glowBlur > 0) {
    ctx.shadowColor = glowColor
    ctx.shadowBlur = glowBlur
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }

  // シャドウ効果
  if (shadowColor && shadowBlur > 0) {
    ctx.shadowColor = shadowColor
    ctx.shadowBlur = shadowBlur
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
  }

  // テキストを描画
  ctx.fillStyle = color
  const xOffset = textAlign === 'center' ? canvasWidth / 2 : textAlign === 'right' ? canvasWidth - padding - glowBlur : padding + glowBlur

  lines.forEach((line, i) => {
    const y = glowBlur + padding + borderWidth + lineHeight / 2 + i * lineHeight
    ctx.fillText(line, xOffset, y)
  })

  // テクスチャを作成
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter

  // スプライトを作成
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  })

  const sprite = new THREE.Sprite(material)

  // アスペクト比を維持してスケール設定
  const scale = 0.01 // ワールド単位への変換係数
  sprite.scale.set(canvasWidth * scale, canvasHeight * scale, 1)

  return sprite
}

/**
 * 3Dボタンを作成する
 */
export interface Button3DOptions {
  text: string
  width?: number
  height?: number
  depth?: number
  fontSize?: number
  textColor?: string
  backgroundColor?: number
  hoverColor?: number
  activeColor?: number
  borderColor?: number
  onClick?: () => void
}

export class Button3D extends THREE.Group {
  private mesh: THREE.Mesh
  private textSprite: THREE.Sprite
  private isHovered = false
  private isPressed = false
  private baseColor: number
  private hoverColor: number
  private activeColor: number
  public onClick?: () => void

  constructor(options: Button3DOptions) {
    super()

    const {
      text,
      width = 2.5,
      height = 0.6,
      depth = 0.15,
      fontSize = 32,
      textColor = '#8B0000',
      backgroundColor = 0xffd700,
      hoverColor = 0xffea00,
      activeColor = 0xffa500,
      borderColor = 0x8b0000,
      onClick
    } = options

    this.baseColor = backgroundColor
    this.hoverColor = hoverColor
    this.activeColor = activeColor
    this.onClick = onClick

    // ボタン本体（角丸ボックス風）
    const geometry = new THREE.BoxGeometry(width, height, depth, 4, 2, 1)

    // 角を丸くする（頂点を調整）
    const posAttr = geometry.getAttribute('position')
    const radius = 0.08
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i)
      const y = posAttr.getY(i)

      // 角付近の頂点を内側に移動
      if (Math.abs(x) > width / 2 - radius && Math.abs(y) > height / 2 - radius) {
        const signX = x > 0 ? 1 : -1
        const signY = y > 0 ? 1 : -1
        const cornerX = (width / 2 - radius) * signX
        const cornerY = (height / 2 - radius) * signY
        const angle = Math.atan2(y - cornerY, x - cornerX)
        posAttr.setX(i, cornerX + Math.cos(angle) * radius)
        posAttr.setY(i, cornerY + Math.sin(angle) * radius)
      }
    }
    posAttr.needsUpdate = true
    geometry.computeVertexNormals()

    const material = new THREE.MeshStandardMaterial({
      color: backgroundColor,
      roughness: 0.4,
      metalness: 0.3
    })

    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.add(this.mesh)

    // ボタンの縁を追加
    const edgeGeometry = new THREE.BoxGeometry(width + 0.05, height + 0.05, depth * 0.5)
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: borderColor,
      roughness: 0.6,
      metalness: 0.2
    })
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial)
    edge.position.z = -depth * 0.3
    this.add(edge)

    // テキストスプライト
    this.textSprite = createTextSprite({
      text,
      fontSize,
      color: textColor,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowBlur: 4
    })
    this.textSprite.position.z = depth / 2 + 0.01
    this.add(this.textSprite)

    // ユーザーデータにボタン参照を保存（Raycaster用）
    this.mesh.userData.button = this
  }

  setHovered(hovered: boolean) {
    if (this.isHovered !== hovered) {
      this.isHovered = hovered
      this.updateColor()
    }
  }

  setPressed(pressed: boolean) {
    if (this.isPressed !== pressed) {
      this.isPressed = pressed
      this.updateColor()

      // 押下時のアニメーション
      if (pressed) {
        this.position.z -= 0.03
      } else {
        this.position.z += 0.03
      }
    }
  }

  private updateColor() {
    const material = this.mesh.material as THREE.MeshStandardMaterial
    if (this.isPressed) {
      material.color.setHex(this.activeColor)
    } else if (this.isHovered) {
      material.color.setHex(this.hoverColor)
    } else {
      material.color.setHex(this.baseColor)
    }
  }

  getMesh(): THREE.Mesh {
    return this.mesh
  }
}

/**
 * 3Dスライダーを作成する
 */
export interface Slider3DOptions {
  label: string
  width?: number
  height?: number
  initialValue?: number
  min?: number
  max?: number
  trackColor?: number
  fillColor?: number
  handleColor?: number
  onChange?: (value: number) => void
}

export class Slider3D extends THREE.Group {
  private track: THREE.Mesh
  private fill: THREE.Mesh
  private handle: THREE.Mesh
  private labelSprite: THREE.Sprite
  private valueSprite: THREE.Sprite | null = null
  private value: number
  private min: number
  private max: number
  private width: number
  private isDragging = false
  public onChange?: (value: number) => void

  constructor(options: Slider3DOptions) {
    super()

    const {
      label,
      width = 2,
      height = 0.15,
      initialValue = 0.7,
      min = 0,
      max = 1,
      trackColor = 0x333333,
      fillColor = 0xffd700,
      handleColor = 0xffffff,
      onChange
    } = options

    this.value = initialValue
    this.min = min
    this.max = max
    this.width = width
    this.onChange = onChange

    // ラベル
    this.labelSprite = createTextSprite({
      text: label,
      fontSize: 24,
      color: '#ffffff'
    })
    this.labelSprite.position.set(-width / 2 - 0.8, 0, 0)
    this.add(this.labelSprite)

    // トラック（背景）
    const trackGeometry = new THREE.BoxGeometry(width, height, 0.05)
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: trackColor,
      roughness: 0.8
    })
    this.track = new THREE.Mesh(trackGeometry, trackMaterial)
    this.add(this.track)

    // フィル（値を表す部分）
    const fillGeometry = new THREE.BoxGeometry(width * this.getNormalizedValue(), height, 0.06)
    const fillMaterial = new THREE.MeshStandardMaterial({
      color: fillColor,
      roughness: 0.4,
      metalness: 0.3
    })
    this.fill = new THREE.Mesh(fillGeometry, fillMaterial)
    this.fill.position.x = -width / 2 + (width * this.getNormalizedValue()) / 2
    this.fill.position.z = 0.01
    this.add(this.fill)

    // ハンドル
    const handleGeometry = new THREE.SphereGeometry(0.12, 16, 16)
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: handleColor,
      roughness: 0.3,
      metalness: 0.5
    })
    this.handle = new THREE.Mesh(handleGeometry, handleMaterial)
    this.handle.position.x = -width / 2 + width * this.getNormalizedValue()
    this.handle.position.z = 0.1
    this.handle.castShadow = true
    this.add(this.handle)

    // ユーザーデータに参照を保存
    this.track.userData.slider = this
    this.handle.userData.slider = this

    this.updateValueDisplay()
  }

  private getNormalizedValue(): number {
    return (this.value - this.min) / (this.max - this.min)
  }

  setValue(value: number) {
    this.value = Math.max(this.min, Math.min(this.max, value))
    this.updateVisual()
    this.updateValueDisplay()
  }

  getValue(): number {
    return this.value
  }

  setValueFromPosition(normalizedX: number) {
    const newValue = this.min + normalizedX * (this.max - this.min)
    this.setValue(newValue)
    if (this.onChange) {
      this.onChange(this.value)
    }
  }

  private updateVisual() {
    const normalized = this.getNormalizedValue()

    // フィルのサイズと位置を更新
    this.fill.scale.x = normalized || 0.01
    this.fill.position.x = -this.width / 2 + (this.width * normalized) / 2

    // ハンドルの位置を更新
    this.handle.position.x = -this.width / 2 + this.width * normalized
  }

  private updateValueDisplay() {
    // 値表示を更新
    if (this.valueSprite) {
      this.remove(this.valueSprite)
    }

    this.valueSprite = createTextSprite({
      text: `${Math.round(this.value * 100)}`,
      fontSize: 20,
      color: '#ffd700'
    })
    this.valueSprite.position.set(this.width / 2 + 0.4, 0, 0)
    this.add(this.valueSprite)
  }

  setDragging(dragging: boolean) {
    this.isDragging = dragging
    const handleMaterial = this.handle.material as THREE.MeshStandardMaterial
    handleMaterial.emissive.setHex(dragging ? 0x444444 : 0x000000)
  }

  getIsDragging(): boolean {
    return this.isDragging
  }

  getTrack(): THREE.Mesh {
    return this.track
  }

  getHandle(): THREE.Mesh {
    return this.handle
  }

  getWidth(): number {
    return this.width
  }
}

/**
 * 3Dパネルを作成する
 */
export interface Panel3DOptions {
  width?: number
  height?: number
  depth?: number
  color?: number
  opacity?: number
  borderColor?: number
  borderWidth?: number
}

export function createPanel3D(options: Panel3DOptions): THREE.Mesh {
  const {
    width = 4,
    height = 3,
    depth = 0.1,
    color = 0x000000,
    opacity = 0.85,
    borderColor = 0xffd700
  } = options

  const geometry = new THREE.BoxGeometry(width, height, depth)
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.9
  })

  const panel = new THREE.Mesh(geometry, material)

  // 枠線を追加
  const edges = new THREE.EdgesGeometry(geometry)
  const lineMaterial = new THREE.LineBasicMaterial({ color: borderColor, linewidth: 2 })
  const wireframe = new THREE.LineSegments(edges, lineMaterial)
  panel.add(wireframe)

  return panel
}

/**
 * 紙吹雪パーティクルシステムを作成する
 */
export function createConfettiSystem(count: number = 200): THREE.Points {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const rotations = new Float32Array(count)

  const colorOptions = [
    [1, 0.84, 0],    // Gold
    [1, 0.42, 0.42], // Red
    [0.31, 0.8, 0.77], // Cyan
    [0.27, 0.72, 0.82], // Light blue
    [0.59, 0.81, 0.71], // Green
    [1, 0.55, 0]     // Orange
  ]

  for (let i = 0; i < count; i++) {
    // ランダムな位置（上から降る）
    positions[i * 3] = (Math.random() - 0.5) * 20
    positions[i * 3 + 1] = Math.random() * 15 + 10
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10

    // ランダムな色
    const color = colorOptions[Math.floor(Math.random() * colorOptions.length)]
    colors[i * 3] = color[0]
    colors[i * 3 + 1] = color[1]
    colors[i * 3 + 2] = color[2]

    // 速度を保存
    velocities[i * 3] = (Math.random() - 0.5) * 2
    velocities[i * 3 + 1] = -Math.random() * 3 - 2
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 2

    // 回転
    rotations[i] = Math.random() * Math.PI * 2
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.userData = { velocities, rotations }

  const material = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 1
  })

  return new THREE.Points(geometry, material)
}

/**
 * 紙吹雪をアニメーションする
 */
export function updateConfetti(confetti: THREE.Points, delta: number): void {
  const positions = confetti.geometry.getAttribute('position')
  const velocities = confetti.geometry.userData.velocities as Float32Array

  for (let i = 0; i < positions.count; i++) {
    let x = positions.getX(i)
    let y = positions.getY(i)
    let z = positions.getZ(i)

    // 速度を適用
    x += velocities[i * 3] * delta
    y += velocities[i * 3 + 1] * delta
    z += velocities[i * 3 + 2] * delta

    // 揺れを追加
    x += Math.sin(Date.now() * 0.001 + i) * 0.01
    z += Math.cos(Date.now() * 0.001 + i) * 0.01

    // 下に落ちたらリセット
    if (y < -5) {
      y = 15 + Math.random() * 5
      x = (Math.random() - 0.5) * 20
    }

    positions.setXYZ(i, x, y, z)
  }

  positions.needsUpdate = true
}

// ヘルパー関数：角丸の矩形を描画
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}
