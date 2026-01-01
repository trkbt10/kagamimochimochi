import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { MochiObject, MOCHI_CONFIGS } from './MochiObject'
import { PhysicsContext } from './PhysicsContext'

export interface DecorativeMochiConfig {
  includeDai?: boolean
  includeLeaf?: boolean
  physicsContext: PhysicsContext
  initialPosition?: THREE.Vector3
}

/**
 * 装飾用鏡餅グループ
 * 上から落として自然に積み重ねる方式
 */
export class DecorativeMochiGroup {
  public readonly group: THREE.Group

  private mochiList: MochiObject[] = []
  private dai: THREE.Mesh | null = null
  private leaf: THREE.Mesh | null = null

  private physicsContext: PhysicsContext
  private groundBody: CANNON.Body | null = null
  private daiBody: CANNON.Body | null = null

  private readonly DROP_INTERVAL = 0.3
  private dropQueue: Array<{ type: 'base' | 'top' | 'mikan'; delay: number }> = []
  private dropTimer = 0

  private basePosition: THREE.Vector3

  constructor(config: DecorativeMochiConfig) {
    this.physicsContext = config.physicsContext
    this.group = new THREE.Group()
    this.basePosition = config.initialPosition ?? new THREE.Vector3(0, 0, 0)

    // 地面を作成
    const groundY = this.basePosition.y - 2
    this.groundBody = this.physicsContext.createGround(groundY)

    // 台座を追加（オプション）
    if (config.includeDai) {
      this.createDai()
    }

    // 葉を追加（オプション）
    if (config.includeLeaf) {
      this.createLeaf()
    }

    // 餅を順番に落とす
    this.dropQueue = [
      { type: 'base', delay: 0 },
      { type: 'top', delay: this.DROP_INTERVAL },
      { type: 'mikan', delay: this.DROP_INTERVAL * 2 }
    ]
  }

  private createDai(): void {
    const daiRadius = 1.8
    const daiHeight = 0.3

    // ビジュアル
    const daiGeometry = new THREE.CylinderGeometry(daiRadius, 2, daiHeight, 32)
    const daiMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.6,
      metalness: 0.2
    })
    this.dai = new THREE.Mesh(daiGeometry, daiMaterial)
    this.dai.position.set(
      this.basePosition.x,
      this.basePosition.y - 1.5,
      this.basePosition.z
    )
    this.dai.castShadow = true
    this.dai.receiveShadow = true
    this.group.add(this.dai)

    // 物理ボディ
    const daiShape = new CANNON.Cylinder(daiRadius, 2, daiHeight, 16)
    this.daiBody = new CANNON.Body({
      mass: 0,
      material: this.physicsContext.groundMaterial
    })
    this.daiBody.addShape(daiShape)
    this.daiBody.position.set(
      this.basePosition.x,
      this.basePosition.y - 1.5,
      this.basePosition.z
    )
    this.physicsContext.addBody(this.daiBody)
  }

  private createLeaf(): void {
    const leafGeometry = new THREE.BoxGeometry(0.3, 0.02, 0.15)
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 })
    this.leaf = new THREE.Mesh(leafGeometry, leafMaterial)
    this.leaf.rotation.z = Math.PI / 6
    this.group.add(this.leaf)
  }

  private dropMochi(type: 'base' | 'top' | 'mikan'): void {
    const config = MOCHI_CONFIGS[type]

    // 落下開始位置
    const dropHeight = this.basePosition.y + 3 + this.mochiList.length * 1.5
    const dropPosition = new THREE.Vector3(
      this.basePosition.x,
      dropHeight,
      this.basePosition.z
    )

    const mochi = new MochiObject(
      config,
      this.physicsContext.mochiMaterial,
      dropPosition
    )
    this.physicsContext.addBody(mochi.body)
    this.group.add(mochi.mesh)
    this.mochiList.push(mochi)
  }

  update(delta: number): void {
    // 餅のドロップ処理
    if (this.dropQueue.length > 0) {
      this.dropTimer += delta

      while (this.dropQueue.length > 0 && this.dropTimer >= this.dropQueue[0].delay) {
        const item = this.dropQueue.shift()!
        this.dropMochi(item.type)
      }
    }

    // メッシュを物理ボディに同期
    for (const mochi of this.mochiList) {
      mochi.syncMeshWithBody()
    }

    // 葉をみかんに追従
    if (this.leaf && this.mochiList.length === 3) {
      const mikan = this.mochiList[2]
      const mikanPos = mikan.position
      this.leaf.position.set(
        mikanPos.x,
        mikanPos.y + MOCHI_CONFIGS.mikan.radius + 0.01,
        mikanPos.z
      )
    }
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.group)
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.group)
  }

  getMochiList(): readonly MochiObject[] {
    return this.mochiList
  }

  dispose(): void {
    for (const mochi of this.mochiList) {
      this.physicsContext.removeBody(mochi.body)
    }
    if (this.groundBody) {
      this.physicsContext.removeBody(this.groundBody)
    }
    if (this.daiBody) {
      this.physicsContext.removeBody(this.daiBody)
    }

    for (const mochi of this.mochiList) {
      mochi.mesh.geometry.dispose()
      if (mochi.mesh.material instanceof THREE.Material) {
        mochi.mesh.material.dispose()
      }
    }

    if (this.dai) {
      this.dai.geometry.dispose()
      if (this.dai.material instanceof THREE.Material) {
        this.dai.material.dispose()
      }
    }

    if (this.leaf) {
      this.leaf.geometry.dispose()
      if (this.leaf.material instanceof THREE.Material) {
        this.leaf.material.dispose()
      }
    }

    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0])
    }

    this.mochiList = []
  }
}
