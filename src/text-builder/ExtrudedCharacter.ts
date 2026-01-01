import * as THREE from 'three'
import { gsap } from 'gsap'
import { ExtrudedText } from './ExtrudedText'
import { TEXT_PATH_DATA } from './generated/text-paths'
import type { ExtrudeTextOptions, TextPathData } from './types'

export type CharacterAnimationPhase = 'hidden' | 'entering' | 'rotating' | 'landed' | 'idle'

/**
 * 1文字単位のExtrudedText管理クラス
 * アニメーション機能（登場、回転、着地）を提供
 */
export class ExtrudedCharacter {
  private extrudedText: ExtrudedText | null = null
  private group: THREE.Group
  private phase: CharacterAnimationPhase = 'hidden'
  private index: number
  private char: string

  /**
   * @param char 表示する文字
   * @param options 押し出しオプション
   * @param index 文字のインデックス（アニメーション遅延計算用）
   */
  constructor(char: string, options: ExtrudeTextOptions, index: number) {
    this.group = new THREE.Group()
    this.index = index
    this.char = char

    // パスデータを取得
    const pathData = TEXT_PATH_DATA[char] as TextPathData | undefined
    if (!pathData) {
      console.warn(`No path data for character: ${char}`)
      return
    }

    // ExtrudedTextを作成
    this.extrudedText = new ExtrudedText(pathData, options)
    this.group.add(this.extrudedText.getGroup())

    // 初期状態：非表示
    this.group.scale.set(0, 0, 0)
    this.group.visible = false
  }

  /**
   * 登場アニメーション（回転しながらスケールイン）
   * 「ダン！」という感じで左からスライドしながら回転して登場
   */
  animateEntrance(duration: number = 0.3): gsap.core.Timeline {
    const tl = gsap.timeline()

    this.phase = 'entering'
    this.group.visible = true

    // 初期位置（左にオフセット）
    const targetX = this.group.position.x
    this.group.position.x = targetX - 2
    this.group.rotation.y = -Math.PI

    // スケールイン + 回転 + 水平移動
    tl.to(this.group.scale, {
      x: 1.2,
      y: 1.2,
      z: 1.2,
      duration: duration * 0.6,
      ease: 'back.out(1.7)',
    }, 0)

    tl.to(this.group.rotation, {
      y: 0,
      duration: duration * 0.8,
      ease: 'power2.out',
    }, 0)

    tl.to(this.group.position, {
      x: targetX,
      duration: duration * 0.8,
      ease: 'power2.out',
    }, 0)

    // バウンス（スケールを1.0に戻す）
    tl.to(this.group.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: duration * 0.3,
      ease: 'power2.out',
    }, duration * 0.6)

    tl.call(() => {
      this.phase = 'idle'
    })

    return tl
  }

  /**
   * 回転アニメーション
   */
  animateRotation(angle: number, duration: number = 0.5): gsap.core.Timeline {
    const tl = gsap.timeline()
    this.phase = 'rotating'

    tl.to(this.group.rotation, {
      y: this.group.rotation.y + angle,
      duration,
      ease: 'power1.inOut',
    })

    tl.call(() => {
      this.phase = 'idle'
    })

    return tl
  }

  /**
   * 着地アニメーション（バウンス付き落下）
   */
  animateLanding(targetY: number, duration: number = 0.5): gsap.core.Timeline {
    const tl = gsap.timeline()
    this.phase = 'landed'

    tl.to(this.group.position, {
      y: targetY,
      duration,
      ease: 'bounce.out',
    })

    tl.call(() => {
      this.phase = 'idle'
    })

    return tl
  }

  /**
   * 光沢アニメーションを再生
   */
  playShineAnimation(): void {
    this.extrudedText?.playShineAnimation()
  }

  getGroup(): THREE.Group {
    return this.group
  }

  getPhase(): CharacterAnimationPhase {
    return this.phase
  }

  getIndex(): number {
    return this.index
  }

  getChar(): string {
    return this.char
  }

  dispose(): void {
    this.extrudedText?.dispose()
    this.extrudedText = null

    // グループから全ての子を削除
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0])
    }
  }
}
