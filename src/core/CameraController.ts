import * as THREE from 'three'
import { gsap } from 'gsap'
import type { LayoutInfo } from './layout'

export type CameraState = 'idle' | 'following' | 'animating' | 'cut'

export type CameraPreset = {
  position: THREE.Vector3
  lookAt: THREE.Vector3
  fov?: number
}

export type FollowConfig = {
  offset: THREE.Vector3
  lookAtOffset: THREE.Vector3
  smoothness: number // 0-1: 追従の滑らかさ（0=即座、1=非常に滑らか）
  bounds?: {
    minY?: number
    maxY?: number
    maxDistance?: number
  }
}

export type AnimateOptions = {
  duration?: number
  ease?: string
  saveState?: boolean
  onComplete?: () => void
  onUpdate?: () => void
}

/**
 * 統一的なカメラ管理クラス
 * - プリセット管理
 * - 追従制御
 * - アニメーション制御
 * - シェイク・ズームパンチなどの演出
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera
  private state: CameraState = 'idle'

  // 追従設定
  private followConfig: FollowConfig | null = null
  private followTarget: THREE.Object3D | THREE.Vector3 | null = null

  // アニメーション
  private currentTimeline: gsap.core.Timeline | null = null
  private savedPosition: THREE.Vector3 | null = null
  private savedLookAt: THREE.Vector3 | null = null

  // lookAt補間用
  private currentLookAt: THREE.Vector3

  // プリセット
  private presets: Map<string, CameraPreset> = new Map()

  // シェイク用
  private shakeOffset: THREE.Vector3 = new THREE.Vector3()

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.currentLookAt = new THREE.Vector3(0, 2, 0)
    this.registerDefaultPresets()
  }

  // === プリセット管理 ===
  private registerDefaultPresets(): void {
    this.presets.set('intro', {
      position: new THREE.Vector3(0, 5, 12),
      lookAt: new THREE.Vector3(0, 2, 0)
    })
    this.presets.set('game-default', {
      position: new THREE.Vector3(0, 12, 22),
      lookAt: new THREE.Vector3(0, 0, 5)
    })
    this.presets.set('result', {
      position: new THREE.Vector3(0, 5, 12),
      lookAt: new THREE.Vector3(0, 2, 0)
    })
  }

  registerPreset(name: string, preset: CameraPreset): void {
    this.presets.set(name, preset)
  }

  getPreset(name: string): CameraPreset | undefined {
    return this.presets.get(name)
  }

  /**
   * 即座にプリセット位置へ移動
   */
  applyPreset(presetName: string): void {
    const preset = this.presets.get(presetName)
    if (!preset) {
      console.warn(`CameraController: preset '${presetName}' not found`)
      return
    }

    this.stopAnimation()
    this.stopFollow()

    this.camera.position.copy(preset.position)
    this.currentLookAt.copy(preset.lookAt)
    this.camera.lookAt(this.currentLookAt)

    if (preset.fov !== undefined) {
      this.camera.fov = preset.fov
      this.camera.updateProjectionMatrix()
    }

    this.state = 'idle'
  }

  // === 基本制御 ===

  /**
   * 即座に指定位置へカット（瞬間移動）
   */
  cutTo(
    position: THREE.Vector3,
    lookAt: THREE.Vector3,
    options?: { saveState?: boolean }
  ): void {
    this.stopAnimation()
    this.stopFollow()

    if (options?.saveState) {
      this.savedPosition = this.camera.position.clone()
      this.savedLookAt = this.currentLookAt.clone()
    }

    this.camera.position.copy(position)
    this.currentLookAt.copy(lookAt)
    this.camera.lookAt(this.currentLookAt)

    this.state = 'cut'
  }

  /**
   * スムーズにアニメーション移動
   */
  animateTo(
    position: THREE.Vector3,
    lookAt: THREE.Vector3,
    options?: AnimateOptions
  ): gsap.core.Timeline {
    const { duration = 0.5, ease = 'power2.out', saveState = false, onComplete, onUpdate } =
      options ?? {}

    this.stopAnimation()
    this.stopFollow()

    if (saveState) {
      this.savedPosition = this.camera.position.clone()
      this.savedLookAt = this.currentLookAt.clone()
    }

    this.state = 'animating'

    const timeline = gsap.timeline({
      onComplete: () => {
        this.state = 'idle'
        onComplete?.()
      },
      onUpdate: () => {
        this.camera.lookAt(this.currentLookAt)
        onUpdate?.()
      }
    })

    timeline.to(
      this.camera.position,
      {
        x: position.x,
        y: position.y,
        z: position.z,
        duration,
        ease
      },
      0
    )

    timeline.to(
      this.currentLookAt,
      {
        x: lookAt.x,
        y: lookAt.y,
        z: lookAt.z,
        duration,
        ease
      },
      0
    )

    this.currentTimeline = timeline
    return timeline
  }

  /**
   * 保存した位置へ戻る
   */
  returnToSaved(options?: AnimateOptions): gsap.core.Timeline | null {
    if (!this.savedPosition || !this.savedLookAt) {
      console.warn('CameraController: no saved state to return to')
      return null
    }

    const timeline = this.animateTo(
      this.savedPosition,
      this.savedLookAt,
      options
    )

    this.savedPosition = null
    this.savedLookAt = null

    return timeline
  }

  // === 追従制御 ===

  /**
   * ターゲット追従開始
   */
  startFollow(
    target: THREE.Object3D | THREE.Vector3,
    config: Partial<FollowConfig>
  ): void {
    this.stopAnimation()

    this.followTarget = target
    this.followConfig = {
      offset: config.offset ?? new THREE.Vector3(0, 3, 8),
      lookAtOffset: config.lookAtOffset ?? new THREE.Vector3(0, 0, 0),
      smoothness: config.smoothness ?? 0.85,
      bounds: config.bounds
    }

    this.state = 'following'
  }

  /**
   * 追従停止
   */
  stopFollow(): void {
    this.followTarget = null
    this.followConfig = null
    if (this.state === 'following') {
      this.state = 'idle'
    }
  }

  /**
   * 毎フレーム呼び出し（追従更新）
   */
  update(delta: number): void {
    // シェイクオフセットの適用
    if (this.shakeOffset.lengthSq() > 0.0001) {
      this.camera.position.add(this.shakeOffset)
    }

    if (this.state !== 'following' || !this.followTarget || !this.followConfig) {
      return
    }

    // ターゲット位置取得
    const targetPos =
      this.followTarget instanceof THREE.Vector3
        ? this.followTarget
        : this.followTarget.position

    // 目標カメラ位置
    const desiredPosition = targetPos.clone().add(this.followConfig.offset)
    const desiredLookAt = targetPos.clone().add(this.followConfig.lookAtOffset)

    // 境界制限
    if (this.followConfig.bounds) {
      const { minY, maxY } = this.followConfig.bounds
      if (minY !== undefined) {
        desiredPosition.y = Math.max(desiredPosition.y, minY)
      }
      if (maxY !== undefined) {
        desiredPosition.y = Math.min(desiredPosition.y, maxY)
      }
    }

    // スムーズ補間
    const lerpFactor = 1 - Math.pow(this.followConfig.smoothness, delta * 60)

    this.camera.position.lerp(desiredPosition, lerpFactor)
    this.currentLookAt.lerp(desiredLookAt, lerpFactor)
    this.camera.lookAt(this.currentLookAt)
  }

  // === 演出用メソッド ===

  /**
   * 画面シェイク
   */
  shake(intensity: number, duration: number, decay: boolean = true): void {
    const startIntensity = intensity

    const shakeUpdate = {
      progress: 0
    }

    gsap.to(shakeUpdate, {
      progress: 1,
      duration,
      ease: decay ? 'power2.out' : 'none',
      onUpdate: () => {
        const currentIntensity = decay
          ? startIntensity * (1 - shakeUpdate.progress)
          : startIntensity

        this.shakeOffset.set(
          (Math.random() - 0.5) * 2 * currentIntensity,
          (Math.random() - 0.5) * 2 * currentIntensity,
          (Math.random() - 0.5) * 2 * currentIntensity
        )
      },
      onComplete: () => {
        this.shakeOffset.set(0, 0, 0)
      }
    })
  }

  /**
   * ズームパンチ（インパクト時の一瞬のズーム）
   */
  zoomPunch(targetFov: number, duration: number): void {
    const originalFov = this.camera.fov

    gsap.timeline()
      .to(this.camera, {
        fov: targetFov,
        duration: duration * 0.3,
        ease: 'power2.out',
        onUpdate: () => this.camera.updateProjectionMatrix()
      })
      .to(this.camera, {
        fov: originalFov,
        duration: duration * 0.7,
        ease: 'power2.out',
        onUpdate: () => this.camera.updateProjectionMatrix()
      })
  }

  // === レイアウト対応 ===

  /**
   * ポートレート/ランドスケープ対応の位置計算
   */
  adjustForLayout(layout: LayoutInfo, presetName: string = 'intro'): void {
    const preset = this.presets.get(presetName)
    if (!preset) return

    if (layout.mode === 'portrait') {
      const zoomOut = 1 / layout.screenAspect
      this.camera.position.set(
        preset.position.x,
        preset.position.y,
        preset.position.z + (zoomOut - 1) * 6
      )
    } else {
      this.camera.position.copy(preset.position)
    }

    this.currentLookAt.copy(preset.lookAt)
    this.camera.lookAt(this.currentLookAt)
  }

  // === ユーティリティ ===

  getState(): CameraState {
    return this.state
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera
  }

  getCurrentLookAt(): THREE.Vector3 {
    return this.currentLookAt.clone()
  }

  /**
   * 進行中のアニメーションを停止
   */
  stopAnimation(): void {
    if (this.currentTimeline) {
      this.currentTimeline.kill()
      this.currentTimeline = null
    }
    if (this.state === 'animating') {
      this.state = 'idle'
    }
  }

  /**
   * 2点間のカメラ移動方向を取得（エフェクト選択用）
   */
  getMovementDirection(
    from: THREE.Vector3,
    to: THREE.Vector3
  ): { forward: number; horizontal: number; vertical: number } {
    const direction = to.clone().sub(from)
    return {
      forward: -direction.z, // 正面方向（-Z）
      horizontal: Math.abs(direction.x),
      vertical: direction.y
    }
  }

  dispose(): void {
    this.stopAnimation()
    this.stopFollow()
    this.presets.clear()
  }
}
