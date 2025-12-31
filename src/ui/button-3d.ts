import * as THREE from 'three'
import { createTextSprite } from './text-sprite'

/**
 * 3Dボタンのオプション
 */
export type Button3DOptions = {
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

type ButtonColors = {
  base: number
  hover: number
  active: number
}

type ButtonState = {
  isHovered: boolean
  isPressed: boolean
}

function getSign(value: number): number {
  if (value > 0) return 1
  return -1
}

function getZDelta(pressed: boolean): number {
  if (pressed) return -0.03
  return 0.03
}

/**
 * 角丸ボックスジオメトリの頂点を調整する
 */
function adjustCornerVertices(
  geometry: THREE.BoxGeometry,
  width: number,
  height: number,
  radius: number
): void {
  const posAttr = geometry.getAttribute('position')

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i)
    const y = posAttr.getY(i)

    const isCorner = Math.abs(x) > width / 2 - radius && Math.abs(y) > height / 2 - radius
    if (!isCorner) continue

    const signX = getSign(x)
    const signY = getSign(y)
    const cornerX = (width / 2 - radius) * signX
    const cornerY = (height / 2 - radius) * signY
    const angle = Math.atan2(y - cornerY, x - cornerX)

    posAttr.setX(i, cornerX + Math.cos(angle) * radius)
    posAttr.setY(i, cornerY + Math.sin(angle) * radius)
  }

  posAttr.needsUpdate = true
  geometry.computeVertexNormals()
}

/**
 * ボタン本体のメッシュを作成する
 */
function createButtonMesh(
  width: number,
  height: number,
  depth: number,
  backgroundColor: number
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width, height, depth, 4, 2, 1)
  adjustCornerVertices(geometry, width, height, 0.08)

  const material = new THREE.MeshStandardMaterial({
    color: backgroundColor,
    roughness: 0.4,
    metalness: 0.3
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true

  return mesh
}

/**
 * ボタンの縁を作成する
 */
function createButtonEdge(
  width: number,
  height: number,
  depth: number,
  borderColor: number
): THREE.Mesh {
  const edgeGeometry = new THREE.BoxGeometry(width + 0.05, height + 0.05, depth * 0.5)
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: borderColor,
    roughness: 0.6,
    metalness: 0.2
  })

  const edge = new THREE.Mesh(edgeGeometry, edgeMaterial)
  edge.position.z = -depth * 0.3

  return edge
}

/**
 * 状態に基づいてカラーを取得する
 */
function getColorForState(state: ButtonState, colors: ButtonColors): number {
  if (state.isPressed) return colors.active
  if (state.isHovered) return colors.hover
  return colors.base
}

/**
 * 3Dボタンクラス
 */
export class Button3D extends THREE.Group {
  private readonly mesh: THREE.Mesh
  private readonly textSprite: THREE.Sprite
  private readonly colors: ButtonColors
  private state: ButtonState = { isHovered: false, isPressed: false }
  public onClick?: () => void

  constructor(options: Button3DOptions) {
    super()

    const {
      text,
      width = 2.9,
      height = 0.7,
      depth = 0.15,
      fontSize = 40,
      textColor = '#8B0000',
      backgroundColor = 0xffd700,
      hoverColor = 0xffea00,
      activeColor = 0xffa500,
      borderColor = 0x8b0000,
      onClick
    } = options

    this.colors = {
      base: backgroundColor,
      hover: hoverColor,
      active: activeColor
    }
    this.onClick = onClick

    this.mesh = createButtonMesh(width, height, depth, backgroundColor)
    this.add(this.mesh)

    const edge = createButtonEdge(width, height, depth, borderColor)
    this.add(edge)

    this.textSprite = createTextSprite({
      text,
      fontSize,
      color: textColor,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowBlur: 4
    })
    this.textSprite.position.z = depth / 2 + 0.01
    this.add(this.textSprite)

    this.mesh.userData.button = this
  }

  setHovered(hovered: boolean): void {
    if (this.state.isHovered === hovered) return

    this.state = { ...this.state, isHovered: hovered }
    this.updateColor()
  }

  setPressed(pressed: boolean): void {
    if (this.state.isPressed === pressed) return

    const zDelta = getZDelta(pressed)
    this.position.z += zDelta

    this.state = { ...this.state, isPressed: pressed }
    this.updateColor()
  }

  private updateColor(): void {
    const material = this.mesh.material as THREE.MeshStandardMaterial
    const color = getColorForState(this.state, this.colors)
    material.color.setHex(color)
  }

  getMesh(): THREE.Mesh {
    return this.mesh
  }
}
