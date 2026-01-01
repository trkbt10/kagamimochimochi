import * as THREE from 'three'
import { gsap } from 'gsap'
import { ExtrudedCharacter } from '../../text-builder/ExtrudedCharacter'
import { TEXT_PATH_DATA } from '../../text-builder/generated/text-paths'
import type { ExtrudeTextOptions } from '../../text-builder/types'

/**
 * 文字列を分解して1文字ずつ管理・アニメーション制御するクラス
 */
export class CharacterSequencer {
  private characters: ExtrudedCharacter[] = []
  private group: THREE.Group
  private defaultCharWidth: number = 40 // デフォルト文字幅（フォントサイズ72基準）
  private charSpacing: number = 5 // 文字間余白

  constructor(text: string, options: ExtrudeTextOptions) {
    this.group = new THREE.Group()

    // 文字を配置（フォントサイズ72基準の座標系）
    const totalWidth = this.calculateTotalWidth(text)
    let currentX = -totalWidth / 2

    for (let i = 0; i < text.length; i++) {
      const char = text[i]

      // スペースの場合は幅だけ進める
      if (char === ' ') {
        currentX += this.defaultCharWidth * 0.5
        continue
      }

      const charWidth = this.getCharacterWidth(char)

      const character = new ExtrudedCharacter(char, options, i)
      const charGroup = character.getGroup()

      // 文字の左端から配置（ExtrudedTextは内部でセンタリング済み）
      charGroup.position.x = currentX + charWidth / 2
      currentX += charWidth + this.charSpacing

      this.characters.push(character)
      this.group.add(charGroup)
    }
  }

  /**
   * 個別の文字幅を取得（viewBoxから）
   */
  private getCharacterWidth(char: string): number {
    const pathData = TEXT_PATH_DATA[char]
    if (!pathData) return this.defaultCharWidth

    const viewBoxMatch = pathData.svg.match(/viewBox="([^"]*)"/)
    if (viewBoxMatch) {
      const values = viewBoxMatch[1].split(/\s+/).map(parseFloat)
      if (values.length >= 4 && !isNaN(values[2])) {
        return values[2] // viewBoxの3番目がwidth
      }
    }
    return this.defaultCharWidth
  }

  /**
   * 合計幅を計算
   */
  private calculateTotalWidth(text: string): number {
    let total = 0
    let charCount = 0

    for (const char of text) {
      if (char === ' ') {
        total += this.defaultCharWidth * 0.5
      } else {
        total += this.getCharacterWidth(char)
        charCount++
      }
    }

    // 文字間余白を追加（文字数-1個分）
    if (charCount > 1) {
      total += this.charSpacing * (charCount - 1)
    }

    return total
  }

  /**
   * 1文字ずつ順番に登場するアニメーション
   * @param interval 文字間の遅延（秒）
   * @param onCharacterEnter 各文字登場時のコールバック
   */
  playSequentialEntrance(
    interval: number = 0.15,
    onCharacterEnter?: (index: number, char: ExtrudedCharacter) => void
  ): gsap.core.Timeline {
    const masterTimeline = gsap.timeline()

    this.characters.forEach((char, index) => {
      const delay = index * interval

      masterTimeline.add(() => {
        onCharacterEnter?.(index, char)
      }, delay)

      masterTimeline.add(
        char.animateEntrance(0.3),
        delay
      )
    })

    return masterTimeline
  }

  /**
   * 全文字同時回転アニメーション
   * @param rotations 回転数
   * @param duration 所要時間
   */
  playFullRotation(rotations: number, duration: number = 0.8): gsap.core.Timeline {
    const tl = gsap.timeline()

    tl.to(this.group.rotation, {
      y: this.group.rotation.y + Math.PI * 2 * rotations,
      duration,
      ease: 'power1.inOut',
    })

    return tl
  }

  /**
   * 着地アニメーション（バウンス付き落下）
   * @param targetY 着地Y座標
   * @param duration 所要時間
   */
  playLanding(targetY: number, duration: number = 0.5): gsap.core.Timeline {
    const tl = gsap.timeline()

    tl.to(this.group.position, {
      y: targetY,
      duration,
      ease: 'bounce.out',
    })

    return tl
  }

  /**
   * 全文字の光沢アニメーションを再生
   */
  playAllShineAnimations(): void {
    this.characters.forEach((char, index) => {
      gsap.delayedCall(index * 0.05, () => {
        char.playShineAnimation()
      })
    })
  }

  /**
   * グループを取得
   */
  getGroup(): THREE.Group {
    return this.group
  }

  /**
   * 文字数を取得
   */
  getCharacterCount(): number {
    return this.characters.length
  }

  /**
   * 特定のインデックスの文字を取得
   */
  getCharacterAt(index: number): ExtrudedCharacter | undefined {
    return this.characters[index]
  }

  /**
   * リソース解放
   */
  dispose(): void {
    this.characters.forEach(char => char.dispose())
    this.characters = []

    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0])
    }
  }
}
