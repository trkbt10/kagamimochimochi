import type { Game } from './Game'
import type { BaseScene } from '../scenes/BaseScene'

export class SceneManager {
  private scenes: Map<string, BaseScene> = new Map()
  private currentScene: BaseScene | null = null
  private isTransitioning = false

  constructor(_game: Game) {
    // Game reference available for future use
  }

  register(name: string, scene: BaseScene) {
    this.scenes.set(name, scene)
  }

  async switchTo(name: string, data?: Record<string, unknown>) {
    if (this.isTransitioning) return

    const newScene = this.scenes.get(name)
    if (!newScene) {
      console.error(`Scene "${name}" not found`)
      return
    }

    this.isTransitioning = true
    try {
      if (this.currentScene) {
        await this.currentScene.exit()
      }

      this.currentScene = newScene
      await this.currentScene.enter(data)
    } finally {
      this.isTransitioning = false
    }
  }

  getCurrentScene(): BaseScene | null {
    return this.currentScene
  }

  getScene(name: string): BaseScene | undefined {
    return this.scenes.get(name)
  }

  update(delta: number) {
    if (this.currentScene) {
      this.currentScene.update(delta)
    }
  }
}
