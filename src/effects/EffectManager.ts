import * as THREE from 'three'
import { SmokeEffect } from './particles/SmokeEffect'
import { DustEffect } from './particles/DustEffect'
import { ShockwaveEffect } from './ShockwaveEffect'
import { CutInText } from './CutInText'

export class EffectManager {
  private smokeEffect: SmokeEffect
  private dustEffect: DustEffect
  private shockwaveEffect: ShockwaveEffect
  private cutInText: CutInText

  constructor(scene: THREE.Scene) {
    this.smokeEffect = new SmokeEffect(scene)
    this.dustEffect = new DustEffect(scene, -1.5)
    this.shockwaveEffect = new ShockwaveEffect(scene)
    this.cutInText = new CutInText(scene)
  }

  emitSmoke(position: THREE.Vector3, direction: THREE.Vector3) {
    this.smokeEffect.emit(position, direction)
  }

  emitDust(position: THREE.Vector3, intensity: number = 1) {
    this.dustEffect.emit(position, intensity)
  }

  triggerShockwave(position: THREE.Vector3) {
    this.shockwaveEffect.trigger(position)
  }

  showCutIn(text: string, camera: THREE.Camera, onComplete?: () => void) {
    this.cutInText.show(text, camera, {}, onComplete)
  }

  update(delta: number) {
    this.smokeEffect.update(delta)
    this.dustEffect.update(delta)
  }

  dispose() {
    this.smokeEffect.dispose()
    this.dustEffect.dispose()
    this.shockwaveEffect.dispose()
    this.cutInText.dispose()
  }
}
