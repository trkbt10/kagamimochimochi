import * as THREE from 'three'
import { createTextSprite } from './text-sprite'

/**
 * 3Dスライダーのオプション
 */
export type Slider3DOptions = {
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

type SliderConfig = {
  min: number
  max: number
  width: number
}

type SliderMeshes = {
  track: THREE.Mesh
  fill: THREE.Mesh
  handle: THREE.Mesh
}

/**
 * 正規化された値を計算する
 */
function calculateNormalizedValue(value: number, min: number, max: number): number {
  return (value - min) / (max - min)
}

/**
 * 値をクランプする
 */
function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getDraggingEmissive(dragging: boolean): number {
  if (dragging) return 0x444444
  return 0x000000
}

/**
 * トラックメッシュを作成する
 */
function createTrackMesh(width: number, height: number, color: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width, height, 0.05)
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8
  })
  return new THREE.Mesh(geometry, material)
}

/**
 * フィルメッシュを作成する
 */
function createFillMesh(
  width: number,
  height: number,
  normalizedValue: number,
  color: number
): THREE.Mesh {
  const fillWidth = width * normalizedValue
  const geometry = new THREE.BoxGeometry(fillWidth, height, 0.06)
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.3
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.x = -width / 2 + fillWidth / 2
  mesh.position.z = 0.01

  return mesh
}

/**
 * ハンドルメッシュを作成する
 */
function createHandleMesh(
  width: number,
  normalizedValue: number,
  color: number
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(0.12, 16, 16)
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.5
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.x = -width / 2 + width * normalizedValue
  mesh.position.z = 0.1
  mesh.castShadow = true

  return mesh
}

/**
 * ビジュアルを更新する
 */
function updateSliderVisual(
  meshes: SliderMeshes,
  normalizedValue: number,
  width: number
): void {
  const safeNormalized = normalizedValue || 0.01
  meshes.fill.scale.x = safeNormalized
  meshes.fill.position.x = -width / 2 + (width * normalizedValue) / 2
  meshes.handle.position.x = -width / 2 + width * normalizedValue
}

/**
 * 3Dスライダークラス
 */
export class Slider3D extends THREE.Group {
  private readonly meshes: SliderMeshes
  private readonly labelSprite: THREE.Sprite
  private valueSprite: THREE.Sprite | null = null
  private readonly config: SliderConfig
  private currentValue: number
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

    this.config = { min, max, width }
    this.currentValue = initialValue
    this.onChange = onChange

    this.labelSprite = createTextSprite({
      text: label,
      fontSize: 24,
      color: '#ffffff'
    })
    this.labelSprite.position.set(-width / 2 - 0.8, 0, 0)
    this.add(this.labelSprite)

    const normalizedValue = this.getNormalizedValue()

    const track = createTrackMesh(width, height, trackColor)
    this.add(track)

    const fill = createFillMesh(width, height, normalizedValue, fillColor)
    this.add(fill)

    const handle = createHandleMesh(width, normalizedValue, handleColor)
    this.add(handle)

    this.meshes = { track, fill, handle }

    track.userData.slider = this
    handle.userData.slider = this

    this.updateValueDisplay()
  }

  private getNormalizedValue(): number {
    return calculateNormalizedValue(this.currentValue, this.config.min, this.config.max)
  }

  setValue(value: number): void {
    this.currentValue = clampValue(value, this.config.min, this.config.max)
    this.updateVisual()
    this.updateValueDisplay()
  }

  getValue(): number {
    return this.currentValue
  }

  setValueFromPosition(normalizedX: number): void {
    const newValue = this.config.min + normalizedX * (this.config.max - this.config.min)
    this.setValue(newValue)
    this.onChange?.(this.currentValue)
  }

  private updateVisual(): void {
    updateSliderVisual(this.meshes, this.getNormalizedValue(), this.config.width)
  }

  private updateValueDisplay(): void {
    if (this.valueSprite) {
      this.remove(this.valueSprite)
    }

    this.valueSprite = createTextSprite({
      text: `${Math.round(this.currentValue * 100)}`,
      fontSize: 20,
      color: '#ffd700'
    })
    this.valueSprite.position.set(this.config.width / 2 + 0.4, 0, 0)
    this.add(this.valueSprite)
  }

  setDragging(dragging: boolean): void {
    this.isDragging = dragging
    const handleMaterial = this.meshes.handle.material as THREE.MeshStandardMaterial
    handleMaterial.emissive.setHex(getDraggingEmissive(dragging))
  }

  getIsDragging(): boolean {
    return this.isDragging
  }

  getTrack(): THREE.Mesh {
    return this.meshes.track
  }

  getHandle(): THREE.Mesh {
    return this.meshes.handle
  }

  getWidth(): number {
    return this.config.width
  }
}
