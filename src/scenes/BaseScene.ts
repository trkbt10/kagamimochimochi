import * as THREE from 'three'
import type { Game } from '../core/Game'
import type { LayoutInfo, LayoutChangeListener } from '../core/layout'

export abstract class BaseScene {
  protected game: Game
  protected scene: THREE.Scene
  protected ui: HTMLElement | null = null
  protected currentLayout: LayoutInfo | null = null
  private boundOnLayoutChange: LayoutChangeListener

  constructor(game: Game) {
    this.game = game
    this.scene = new THREE.Scene()
    this.boundOnLayoutChange = this.onLayoutChange.bind(this)
  }

  abstract enter(data?: Record<string, unknown>): Promise<void>
  abstract exit(): Promise<void>
  abstract update(delta: number): void

  getThreeScene(): THREE.Scene {
    return this.scene
  }

  /**
   * レイアウト変更リスナーを登録
   * enter()で呼び出す
   */
  protected registerLayoutListener(): void {
    this.game.layoutManager.addListener(this.boundOnLayoutChange)
    // 現在のレイアウトで初期化
    const layout = this.game.layoutManager.getCurrentLayout()
    if (layout) {
      this.onLayoutChange(layout)
    }
  }

  /**
   * レイアウト変更リスナーを解除
   * exit()で呼び出す
   */
  protected unregisterLayoutListener(): void {
    this.game.layoutManager.removeListener(this.boundOnLayoutChange)
  }

  /**
   * レイアウト変更時に呼び出される
   */
  private onLayoutChange(layout: LayoutInfo): void {
    this.currentLayout = layout
    this.adjustLayout(layout)
  }

  /**
   * レイアウトに応じた調整を行う
   * 各シーンでオーバーライドして実装
   */
  protected adjustLayout(_layout: LayoutInfo): void {
    // デフォルト実装（何もしない）
  }

  protected createUI(html: string): HTMLElement {
    const container = document.createElement('div')
    container.className = 'ui-overlay'
    container.innerHTML = html
    document.getElementById('app')!.appendChild(container)
    return container
  }

  protected removeUI() {
    if (this.ui) {
      this.ui.remove()
      this.ui = null
    }
  }

  protected clearScene() {
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0]
      this.scene.remove(child)
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material?.dispose()
        }
      }
    }
  }
}
