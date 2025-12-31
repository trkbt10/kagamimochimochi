import * as THREE from 'three'
import { gsap } from 'gsap'

export class ShockwaveEffect {
  private ring: THREE.Mesh
  private material: THREE.MeshBasicMaterial
  private timeline: gsap.core.Timeline | null = null

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.RingGeometry(0.1, 0.3, 64)
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    })

    this.ring = new THREE.Mesh(geometry, this.material)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.visible = false
    scene.add(this.ring)
  }

  trigger(position: THREE.Vector3) {
    if (this.timeline) {
      this.timeline.kill()
    }

    this.ring.position.set(position.x, position.y + 0.05, position.z)
    this.ring.scale.set(0.1, 0.1, 0.1)
    this.ring.visible = true
    this.material.opacity = 0.9

    this.timeline = gsap.timeline({
      onComplete: () => {
        this.ring.visible = false
      }
    })

    this.timeline
      .to(this.ring.scale, {
        x: 6,
        y: 6,
        z: 6,
        duration: 0.4,
        ease: 'power2.out'
      })
      .to(
        this.material,
        {
          opacity: 0,
          duration: 0.35,
          ease: 'power1.out'
        },
        0.05
      )
  }

  dispose() {
    if (this.timeline) {
      this.timeline.kill()
    }
    this.ring.geometry.dispose()
    this.material.dispose()
    this.ring.parent?.remove(this.ring)
  }
}
