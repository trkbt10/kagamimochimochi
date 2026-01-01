import * as THREE from 'three'
import { ExtrudedText, TEXT_PATH_DATA } from '../text-builder'
import type { ExtrudeTextOptions, TextPathData } from '../text-builder'

/** アウトラインレイヤーの定義 */
export type OutlineLayer = {
  bevelOffset: number
  color: number
}

/** 立体ボタンのオプション */
export type ExtrudedButton3DOptions = {
  /** TEXT_PATH_DATAのキー */
  textKey: string
  /** ボタンの幅 */
  width?: number
  /** ボタンの高さ */
  height?: number
  /** ボタンの奥行き */
  depth?: number
  /** 角丸の半径 */
  cornerRadius?: number
  /** ボタン前面の色 */
  bodyFrontColor?: number
  /** ボタン側面の色 */
  bodySideColor?: number
  /** ボタンのアウトライン */
  bodyOutlines?: OutlineLayer[]
  /** テキストのオプション */
  textOptions?: Partial<ExtrudeTextOptions>
  /** テキストのスケール */
  textScale?: number
  /** ホバー時の色 */
  hoverColor?: number
  /** アクティブ時の色 */
  activeColor?: number
  /** クリック時のコールバック */
  onClick?: () => void
  /** 無効状態か */
  disabled?: boolean
  /** 無効時の色 */
  disabledColor?: number
}

type ButtonColors = {
  base: number
  hover: number
  active: number
  disabled: number
}

type ButtonState = {
  isHovered: boolean
  isPressed: boolean
  isDisabled: boolean
}

const DEFAULT_BODY_OPTIONS = {
  width: 3.0,
  height: 0.8,
  depth: 0.15,
  cornerRadius: 0.12,
  bodyFrontColor: 0xffd700,
  bodySideColor: 0xcc0000,
  bevelThickness: 0.04,
  bevelSize: 0.03,
  bevelSegments: 12,
}

/** デフォルトのボタン多重縁取り（金→赤→黒） */
const DEFAULT_BODY_OUTLINES: OutlineLayer[] = [
  { bevelOffset: 0.08, color: 0x000000 }, // 黒（最外側）
  { bevelOffset: 0.04, color: 0xcc0000 }, // 赤（中間）
]

const DEFAULT_TEXT_OPTIONS: ExtrudeTextOptions = {
  depth: 4,
  bevelThickness: 1.2,
  bevelSize: 0.8,
  bevelSegments: 10,
  frontColor: 0x8b0000,
  sideColor: 0x660000,
}

/**
 * 角丸矩形のShapeを作成
 */
function createRoundedRectShape(
  width: number,
  height: number,
  radius: number
): THREE.Shape {
  const shape = new THREE.Shape()
  const x = -width / 2
  const y = -height / 2

  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + radius)
  shape.lineTo(x + width, y + height - radius)
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  shape.lineTo(x + radius, y + height)
  shape.quadraticCurveTo(x, y + height, x, y + height - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)

  return shape
}

/** デフォルトの無効色 */
const DEFAULT_DISABLED_COLOR = 0x666666

/**
 * 状態に基づいてカラーを取得
 */
function getColorForState(state: ButtonState, colors: ButtonColors): number {
  if (state.isDisabled) return colors.disabled
  if (state.isPressed) return colors.active
  if (state.isHovered) return colors.hover
  return colors.base
}

/**
 * 立体的な3Dボタン
 */
export class ExtrudedButton3D extends THREE.Group {
  private bodyGroup: THREE.Group
  private bodyMeshes: THREE.Mesh[] = []
  private textInstance: ExtrudedText | null = null
  private textContainer: THREE.Group
  private hitMesh: THREE.Mesh
  private colors: ButtonColors
  private state: ButtonState = { isHovered: false, isPressed: false, isDisabled: false }
  public onClick?: () => void

  constructor(options: ExtrudedButton3DOptions) {
    super()

    const width = options.width ?? DEFAULT_BODY_OPTIONS.width
    const height = options.height ?? DEFAULT_BODY_OPTIONS.height
    const depth = options.depth ?? DEFAULT_BODY_OPTIONS.depth
    const cornerRadius = options.cornerRadius ?? DEFAULT_BODY_OPTIONS.cornerRadius
    const bodyFrontColor = options.bodyFrontColor ?? DEFAULT_BODY_OPTIONS.bodyFrontColor
    const bodySideColor = options.bodySideColor ?? DEFAULT_BODY_OPTIONS.bodySideColor
    const hoverColor = options.hoverColor ?? this.lightenColor(bodyFrontColor, 0.2)
    const activeColor = options.activeColor ?? this.darkenColor(bodyFrontColor, 0.1)
    const disabledColor = options.disabledColor ?? DEFAULT_DISABLED_COLOR

    this.colors = {
      base: bodyFrontColor,
      hover: hoverColor,
      active: activeColor,
      disabled: disabledColor,
    }
    this.onClick = options.onClick

    // 初期の無効状態を設定
    if (options.disabled) {
      this.state = { ...this.state, isDisabled: true }
    }

    // ボタン本体グループ
    this.bodyGroup = new THREE.Group()
    this.add(this.bodyGroup)

    // テキストコンテナ
    this.textContainer = new THREE.Group()
    this.add(this.textContainer)

    // ボタン本体を作成（アウトライン未指定時はデフォルト多重縁取りを使用）
    const outlines = options.bodyOutlines ?? DEFAULT_BODY_OUTLINES
    this.createButtonBody(
      width,
      height,
      depth,
      cornerRadius,
      bodyFrontColor,
      bodySideColor,
      outlines
    )

    // テキストを作成
    this.createButtonText(options.textKey, options.textOptions, options.textScale, width, height, depth)

    // ヒット検出用の透明メッシュ
    const hitGeometry = new THREE.BoxGeometry(width, height, depth)
    const hitMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    this.hitMesh = new THREE.Mesh(hitGeometry, hitMaterial)
    this.hitMesh.position.z = depth / 2
    this.hitMesh.userData.button = this
    this.add(this.hitMesh)

    // 初期状態の外観を適用
    if (this.state.isDisabled) {
      this.hitMesh.visible = false
      this.updateAppearance()
    }
  }

  private createButtonBody(
    width: number,
    height: number,
    depth: number,
    cornerRadius: number,
    frontColor: number,
    sideColor: number,
    outlines?: OutlineLayer[]
  ): void {
    const shape = createRoundedRectShape(width, height, cornerRadius)

    // アウトラインレイヤー（後ろに配置）
    if (outlines) {
      for (let i = 0; i < outlines.length; i++) {
        const outline = outlines[i]
        const outlineShape = createRoundedRectShape(
          width + outline.bevelOffset * 2,
          height + outline.bevelOffset * 2,
          cornerRadius + outline.bevelOffset
        )

        const outlineGeometry = new THREE.ExtrudeGeometry(outlineShape, {
          depth: depth,
          bevelEnabled: true,
          bevelThickness: DEFAULT_BODY_OPTIONS.bevelThickness,
          bevelSize: DEFAULT_BODY_OPTIONS.bevelSize,
          bevelSegments: DEFAULT_BODY_OPTIONS.bevelSegments,
        })

        const outlineMaterial = new THREE.MeshStandardMaterial({
          color: outline.color,
          metalness: 0.2,
          roughness: 0.6,
        })

        const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial)
        outlineMesh.position.z = -(outline.bevelOffset * 0.5)
        outlineMesh.renderOrder = -outline.bevelOffset
        outlineMesh.castShadow = true
        outlineMesh.receiveShadow = true

        this.bodyMeshes.push(outlineMesh)
        this.bodyGroup.add(outlineMesh)
      }
    }

    // メインボタンジオメトリ
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: DEFAULT_BODY_OPTIONS.bevelThickness,
      bevelSize: DEFAULT_BODY_OPTIONS.bevelSize,
      bevelSegments: DEFAULT_BODY_OPTIONS.bevelSegments,
    })

    // マテリアル（前面と側面）
    const materials = [
      new THREE.MeshStandardMaterial({
        color: frontColor,
        metalness: 0.3,
        roughness: 0.4,
      }),
      new THREE.MeshStandardMaterial({
        color: sideColor,
        metalness: 0.5,
        roughness: 0.3,
      }),
    ]

    const mesh = new THREE.Mesh(geometry, materials)
    mesh.castShadow = true
    mesh.receiveShadow = true

    this.bodyMeshes.push(mesh)
    this.bodyGroup.add(mesh)
  }

  private createButtonText(
    textKey: string,
    textOptions: Partial<ExtrudeTextOptions> | undefined,
    textScale: number | undefined,
    buttonWidth: number,
    buttonHeight: number,
    buttonDepth: number
  ): void {
    const pathData = TEXT_PATH_DATA[textKey] as TextPathData | undefined

    if (!pathData) {
      console.warn(`No path data found for button text: ${textKey}`)
      return
    }

    const mergedOptions: ExtrudeTextOptions = {
      ...DEFAULT_TEXT_OPTIONS,
      ...textOptions,
    }

    this.textInstance = new ExtrudedText(pathData, mergedOptions)
    const textGroup = this.textInstance.getGroup()

    // IntroSceneと同じ方式：コンテナでラップしてスケール
    const textWrapper = new THREE.Group()
    textWrapper.add(textGroup)

    // テキストのスケールを計算
    const box = new THREE.Box3().setFromObject(textGroup)
    const textWidth = box.max.x - box.min.x
    const textHeight = box.max.y - box.min.y

    // ボタンに収まるようにスケーリング
    const maxTextWidth = buttonWidth * 0.75
    const maxTextHeight = buttonHeight * 0.5
    const scaleX = maxTextWidth / textWidth
    const scaleY = maxTextHeight / textHeight
    const autoScale = Math.min(scaleX, scaleY)
    const finalScale = textScale ?? autoScale

    // コンテナをスケール（textGroup自体のscale.y=-1は維持される）
    textWrapper.scale.set(finalScale, finalScale, finalScale)

    // テキストをボタンの中央・前面に配置
    textWrapper.position.set(0, -buttonHeight * 0.4, buttonDepth + 0.1)

    // ローカルライトを追加（タイトルと同様）
    const textLight = new THREE.PointLight(0xffffff, 1.5, 10)
    textLight.position.set(0, 0, 5)
    textWrapper.add(textLight)

    this.textContainer.add(textWrapper)
  }

  private lightenColor(color: number, amount: number): number {
    const c = new THREE.Color(color)
    c.r = Math.min(1, c.r + amount)
    c.g = Math.min(1, c.g + amount)
    c.b = Math.min(1, c.b + amount)
    return c.getHex()
  }

  private darkenColor(color: number, amount: number): number {
    const c = new THREE.Color(color)
    c.r = Math.max(0, c.r - amount)
    c.g = Math.max(0, c.g - amount)
    c.b = Math.max(0, c.b - amount)
    return c.getHex()
  }

  setHovered(hovered: boolean): void {
    if (this.state.isDisabled) return
    if (this.state.isHovered === hovered) return

    this.state = { ...this.state, isHovered: hovered }
    this.updateAppearance()
  }

  setPressed(pressed: boolean): void {
    if (this.state.isDisabled) return
    if (this.state.isPressed === pressed) return

    const zDelta = pressed ? -0.03 : 0.03
    this.position.z += zDelta

    this.state = { ...this.state, isPressed: pressed }
    this.updateAppearance()
  }

  setDisabled(disabled: boolean): void {
    if (this.state.isDisabled === disabled) return

    this.state = { isHovered: false, isPressed: false, isDisabled: disabled }
    this.updateAppearance()

    // レイキャストから除外
    this.hitMesh.visible = !disabled
  }

  isDisabled(): boolean {
    return this.state.isDisabled
  }

  private updateAppearance(): void {
    const targetColor = getColorForState(this.state, this.colors)
    const targetEmissive = this.state.isHovered && !this.state.isDisabled ? 0x222222 : 0x000000

    for (const mesh of this.bodyMeshes) {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]

      // 最初のマテリアル（前面）のみ色を変更
      const frontMaterial = materials[0]
      if (frontMaterial instanceof THREE.MeshStandardMaterial) {
        frontMaterial.color.setHex(targetColor)
        frontMaterial.emissive.setHex(targetEmissive)

        // 無効時は金属感を下げてグレーアウト感を出す
        if (this.state.isDisabled) {
          frontMaterial.metalness = 0.1
          frontMaterial.roughness = 0.8
        } else {
          frontMaterial.metalness = 0.3
          frontMaterial.roughness = 0.4
        }
      }
    }
  }

  getMesh(): THREE.Mesh {
    return this.hitMesh
  }

  dispose(): void {
    // ボディメッシュのクリーンアップ
    for (const mesh of this.bodyMeshes) {
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose())
      } else {
        mesh.material.dispose()
      }
    }
    this.bodyMeshes = []

    // テキストのクリーンアップ
    if (this.textInstance) {
      this.textInstance.dispose()
      this.textInstance = null
    }

    // ヒットメッシュのクリーンアップ
    this.hitMesh.geometry.dispose()
    if (this.hitMesh.material instanceof THREE.Material) {
      this.hitMesh.material.dispose()
    }
  }
}
