import * as THREE from 'three'
import type { Game } from '../core/Game'

export abstract class BaseScene {
  protected game: Game
  protected scene: THREE.Scene
  protected ui: HTMLElement | null = null

  constructor(game: Game) {
    this.game = game
    this.scene = new THREE.Scene()
  }

  abstract enter(data?: Record<string, unknown>): Promise<void>
  abstract exit(): Promise<void>
  abstract update(delta: number): void

  getThreeScene(): THREE.Scene {
    return this.scene
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
