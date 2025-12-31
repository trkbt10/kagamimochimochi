import type { Game } from './Game'
import type { BaseScene } from '../scenes/BaseScene'

export class SceneManager {
  private scenes: Map<string, BaseScene> = new Map()
  private currentScene: BaseScene | null = null

  constructor(_game: Game) {
    // Game reference available for future use
  }

  register(name: string, scene: BaseScene) {
    this.scenes.set(name, scene)
  }

  async switchTo(name: string, data?: Record<string, unknown>) {
    const newScene = this.scenes.get(name)
    if (!newScene) {
      console.error(`Scene "${name}" not found`)
      return
    }

    if (this.currentScene) {
      await this.currentScene.exit()
    }

    this.currentScene = newScene
    await this.currentScene.enter(data)
  }

  getCurrentScene(): BaseScene | null {
    return this.currentScene
  }

  update(delta: number) {
    if (this.currentScene) {
      this.currentScene.update(delta)
    }
  }
}
