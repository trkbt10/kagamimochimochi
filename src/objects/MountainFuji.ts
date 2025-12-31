import * as THREE from 'three'

export class MountainFuji {
  public readonly group: THREE.Group

  constructor(scale = 1) {
    this.group = new THREE.Group()
    this.createMountain(scale)
  }

  private createMountain(scale: number) {
    // 富士山のシルエットをConeGeometryで表現
    // 富士山らしい優美な曲線を出すため、複数のコーンを重ねる

    // メインの山体（濃い青紫〜黒のシルエット）
    const mountainColor = 0x1a1a3a
    const snowColor = 0xffffff

    // 山体（少し幅広の形状）
    const mountainGeometry = new THREE.ConeGeometry(25, 20, 64, 1, true)
    const mountainMaterial = new THREE.MeshBasicMaterial({
      color: mountainColor,
      side: THREE.DoubleSide
    })
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial)
    mountain.position.y = 10
    this.group.add(mountain)

    // 山の底面（平らな部分）
    const baseGeometry = new THREE.CircleGeometry(25, 64)
    const baseMaterial = new THREE.MeshBasicMaterial({
      color: mountainColor,
      side: THREE.DoubleSide
    })
    const base = new THREE.Mesh(baseGeometry, baseMaterial)
    base.rotation.x = -Math.PI / 2
    base.position.y = 0
    this.group.add(base)

    // 雪をかぶった山頂（白いコーン、上部のみ）
    const snowCapGeometry = new THREE.ConeGeometry(6, 5, 64, 1, true)
    const snowCapMaterial = new THREE.MeshBasicMaterial({
      color: snowColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    })
    const snowCap = new THREE.Mesh(snowCapGeometry, snowCapMaterial)
    snowCap.position.y = 17.5
    this.group.add(snowCap)

    // 雪のギザギザ感を出すための追加の白い部分
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const snowPatchGeometry = new THREE.ConeGeometry(2, 3, 8)
      const snowPatch = new THREE.Mesh(snowPatchGeometry, snowCapMaterial.clone())
      snowPatch.position.set(
        Math.cos(angle) * 5,
        15 + Math.random() * 2,
        Math.sin(angle) * 5
      )
      snowPatch.rotation.x = (Math.random() - 0.5) * 0.3
      snowPatch.rotation.z = (Math.random() - 0.5) * 0.3
      this.group.add(snowPatch)
    }

    this.group.scale.setScalar(scale)
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.group)
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this.group)
  }

  setPosition(x: number, y: number, z: number) {
    this.group.position.set(x, y, z)
  }

  dispose() {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (child.material instanceof THREE.Material) {
          child.material.dispose()
        }
      }
    })
  }
}
