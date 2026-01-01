import * as THREE from 'three'
import { gsap } from 'gsap'
import { ExtrudedText, TEXT_PATH_DATA, type ExtrudeTextOptions } from '../text-builder'

const DEFAULT_OPTIONS: ExtrudeTextOptions = {
  depth: 8,
  bevelThickness: 2,
  bevelSize: 1.5,
  bevelSegments: 5,
  frontColor: 0x88ee44, // ライムグリーン
  sideColor: 0x225522, // ダークグリーン
}

export class CutInText {
  private extrudedText: ExtrudedText | null = null
  private container: THREE.Group | null = null
  private scene: THREE.Scene
  private timeline: gsap.core.Timeline | null = null
  private onCompleteCallback: (() => void) | null = null
  private localLight: THREE.PointLight | null = null

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  show(
    text: string,
    camera: THREE.Camera,
    options: Partial<ExtrudeTextOptions> = {},
    onComplete?: () => void
  ) {
    this.hide()
    this.onCompleteCallback = onComplete || null

    const pathData = TEXT_PATH_DATA[text]
    if (!pathData) {
      console.warn(`No path data defined for: ${text}`)
      // フォールバック：パスが無い場合はコールバックを即座に実行
      onComplete?.()
      return
    }

    const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
    this.extrudedText = new ExtrudedText(pathData, mergedOptions)

    // コンテナグループを作成（位置調整用）
    this.container = new THREE.Group()
    this.container.add(this.extrudedText.getGroup())

    // スケール調整（画面サイズに応じて調整）
    // ExtrudedTextでY軸反転(-1)が設定されているため、containerでスケール調整
    const scale = this.calculateResponsiveScale(camera, text)
    this.container.scale.set(scale, scale, scale)

    // 局所ライトを追加（カメラ前方でも見えるように）
    this.localLight = new THREE.PointLight(0xffffff, 2.0, 20)
    this.localLight.position.set(0, 0, 3) // テキスト前方
    this.container.add(this.localLight)

    // カメラ前方に配置
    this.positionInFrontOfCamera(this.container, camera)
    this.scene.add(this.container)

    this.playAnimation()
  }

  /**
   * 画面サイズに応じたスケールを計算
   * カメラのアスペクト比とテキストの幅を考慮
   */
  private calculateResponsiveScale(camera: THREE.Camera, text: string): number {
    const baseScale = 0.02
    const distance = 4 // カメラからの距離

    // PerspectiveCameraの場合のみアスペクト比を考慮
    if (camera instanceof THREE.PerspectiveCamera) {
      const aspect = camera.aspect
      const fov = camera.fov * (Math.PI / 180)

      // カメラ前方での可視幅を計算
      const visibleWidth = 2 * Math.tan(fov / 2) * distance * aspect

      // テキストの幅を推定（viewBoxから取得）
      const pathData = TEXT_PATH_DATA[text]
      if (pathData) {
        // viewBoxから幅を抽出
        const viewBoxMatch = pathData.svg.match(/viewBox="([^"]+)"/)
        if (viewBoxMatch) {
          const [, , , width] = viewBoxMatch[1].split(' ').map(Number)
          const textWorldWidth = width * baseScale

          // テキストが画面幅の80%を超えないようにスケール調整
          const maxWidth = visibleWidth * 0.8
          if (textWorldWidth > maxWidth) {
            return baseScale * (maxWidth / textWorldWidth)
          }
        }
      }

      // 縦画面の場合はさらにスケールダウン
      if (aspect < 1) {
        return baseScale * Math.max(0.5, aspect)
      }
    }

    return baseScale
  }

  private positionInFrontOfCamera(group: THREE.Group, camera: THREE.Camera) {
    const forward = new THREE.Vector3(0, 0, -1)
    forward.applyQuaternion(camera.quaternion)

    group.position.copy(camera.position)
    group.position.add(forward.multiplyScalar(4))
    group.quaternion.copy(camera.quaternion)
  }

  private playAnimation() {
    if (!this.container || !this.extrudedText) return

    const originalScale = this.container.scale.clone()

    // 初期状態：スケール0
    this.container.scale.set(0, 0, 0)

    this.timeline = gsap.timeline({
      onComplete: () => {
        this.hide()
        this.onCompleteCallback?.()
      },
    })

    this.timeline
      // 登場: スケールイン
      .to(this.container.scale, {
        x: originalScale.x * 1.1,
        y: originalScale.y * 1.1,
        z: originalScale.z * 1.1,
        duration: 0.2,
        ease: 'back.out(2)',
      })
      // バウンス
      .to(this.container.scale, {
        x: originalScale.x,
        y: originalScale.y,
        z: originalScale.z,
        duration: 0.1,
        ease: 'power2.out',
      })
      // 光沢アニメーション
      .add(() => this.extrudedText?.playShineAnimation(), 0.15)
      // 表示維持
      .to({}, { duration: 0.5 })
      // 退場: スケールアウト
      .to(this.container.scale, {
        x: originalScale.x * 0.8,
        y: originalScale.y * 0.8,
        z: originalScale.z * 0.8,
        duration: 0.25,
        ease: 'power2.in',
      })
  }

  hide() {
    if (this.timeline) {
      this.timeline.kill()
      this.timeline = null
    }

    if (this.extrudedText) {
      this.extrudedText.dispose()
      this.extrudedText = null
    }

    if (this.localLight) {
      this.localLight.dispose()
      this.localLight = null
    }

    if (this.container) {
      this.scene.remove(this.container)
      this.container = null
    }
  }

  dispose() {
    this.hide()
  }
}
