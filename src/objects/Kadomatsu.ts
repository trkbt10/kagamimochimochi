import * as THREE from 'three'

export class Kadomatsu {
  public readonly group: THREE.Group

  constructor(scale = 1) {
    this.group = new THREE.Group()
    this.createKadomatsu(scale)
  }

  private createKadomatsu(scale: number) {
    const bambooColor = 0x2d5a27
    const bambooLightColor = 0x4a8a40
    const pineColor = 0x1a4a1a
    const potColor = 0x8b7355
    const ropeColor = 0xd4a574

    const bambooMaterial = new THREE.MeshStandardMaterial({
      color: bambooColor,
      roughness: 0.7,
      metalness: 0.1
    })

    const bambooLightMaterial = new THREE.MeshStandardMaterial({
      color: bambooLightColor,
      roughness: 0.6,
      metalness: 0.1
    })

    const pineMaterial = new THREE.MeshStandardMaterial({
      color: pineColor,
      roughness: 0.9,
      metalness: 0
    })

    const potMaterial = new THREE.MeshStandardMaterial({
      color: potColor,
      roughness: 0.8,
      metalness: 0.1
    })

    const ropeMaterial = new THREE.MeshStandardMaterial({
      color: ropeColor,
      roughness: 0.9,
      metalness: 0
    })

    const potGeometry = new THREE.CylinderGeometry(0.6, 0.5, 0.8, 16)
    const pot = new THREE.Mesh(potGeometry, potMaterial)
    pot.position.y = 0.4
    pot.castShadow = true
    pot.receiveShadow = true
    this.group.add(pot)

    const bambooPositions = [
      { x: 0, z: 0, height: 2.5, material: bambooMaterial },
      { x: -0.25, z: 0.15, height: 2.0, material: bambooLightMaterial },
      { x: 0.25, z: 0.15, height: 1.6, material: bambooMaterial }
    ]

    bambooPositions.forEach(({ x, z, height, material }) => {
      const bambooGeometry = new THREE.CylinderGeometry(0.08, 0.1, height, 8)
      const bamboo = new THREE.Mesh(bambooGeometry, material)
      bamboo.position.set(x, 0.8 + height / 2, z)
      bamboo.castShadow = true
      this.group.add(bamboo)

      const cutGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8)
      const cutRotation = (x < 0 ? 1 : -1) * Math.PI / 6
      const cut = new THREE.Mesh(cutGeometry, material)
      cut.position.set(x, 0.8 + height + 0.05, z)
      cut.rotation.z = cutRotation
      this.group.add(cut)

      for (let i = 1; i < height / 0.5; i++) {
        const nodeGeometry = new THREE.TorusGeometry(0.1, 0.015, 8, 16)
        const node = new THREE.Mesh(nodeGeometry, material)
        node.position.set(x, 0.8 + i * 0.5, z)
        node.rotation.x = Math.PI / 2
        this.group.add(node)
      }
    })

    const pinePositions = [
      { x: -0.4, z: -0.2, rotY: Math.PI / 4 },
      { x: 0.4, z: -0.2, rotY: -Math.PI / 4 },
      { x: 0, z: -0.35, rotY: 0 }
    ]

    pinePositions.forEach(({ x, z, rotY }) => {
      const pineGroup = new THREE.Group()

      for (let i = 0; i < 5; i++) {
        const needleGeometry = new THREE.ConeGeometry(0.15, 0.5, 6)
        const needle = new THREE.Mesh(needleGeometry, pineMaterial)
        needle.position.set(
          (Math.random() - 0.5) * 0.2,
          0.3 + Math.random() * 0.3,
          (Math.random() - 0.5) * 0.2
        )
        needle.rotation.set(
          (Math.random() - 0.5) * 0.5,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.5
        )
        pineGroup.add(needle)
      }

      pineGroup.position.set(x, 0.8, z)
      pineGroup.rotation.y = rotY
      this.group.add(pineGroup)
    })

    const ropeGeometry = new THREE.TorusGeometry(0.65, 0.04, 8, 32)
    const rope = new THREE.Mesh(ropeGeometry, ropeMaterial)
    rope.position.y = 0.85
    rope.rotation.x = Math.PI / 2
    this.group.add(rope)

    const shidePositions = [
      { x: 0.6, z: 0, rotY: 0 },
      { x: -0.6, z: 0, rotY: Math.PI },
      { x: 0, z: 0.6, rotY: Math.PI / 2 },
      { x: 0, z: -0.6, rotY: -Math.PI / 2 }
    ]

    const shideMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0,
      side: THREE.DoubleSide
    })

    shidePositions.forEach(({ x, z, rotY }) => {
      const shideGeometry = new THREE.PlaneGeometry(0.15, 0.4)
      const shide = new THREE.Mesh(shideGeometry, shideMaterial)
      shide.position.set(x * 0.95, 0.6, z * 0.95)
      shide.rotation.y = rotY
      shide.rotation.z = Math.PI / 12
      this.group.add(shide)
    })

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
