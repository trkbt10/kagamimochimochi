import * as THREE from 'three'
import * as CANNON from 'cannon-es'

export type MochiType = 'base' | 'top' | 'mikan'

/**
 * 餅の状態
 */
export type MochiState = 'flying' | 'landing' | 'stacked' | 'fallen'

/**
 * 餅の構成パラメータ（不変）
 */
export type MochiConfig = {
  readonly type: MochiType
  readonly displayName: string
  readonly radius: number
  readonly height: number
  readonly mass: number
  readonly color: number
  readonly roughness: number
}

/**
 * 餅の定義データ
 */
export const MOCHI_CONFIGS: Record<MochiType, MochiConfig> = {
  base: {
    type: 'base',
    displayName: 'ベース餅',
    radius: 1.5,
    height: 0.75,
    mass: 3,
    color: 0xfff8e7,
    roughness: 0.9
  },
  top: {
    type: 'top',
    displayName: '上餅',
    radius: 1.1,
    height: 0.55,
    mass: 2,
    color: 0xfff8e7,
    roughness: 0.9
  },
  mikan: {
    type: 'mikan',
    displayName: 'みかん',
    radius: 0.5,
    height: 0.5, // 球体なのでradiusと同じ
    mass: 0.5,
    color: 0xff8c00,
    roughness: 0.8
  }
}

type MochiProfile = { r: number; y: number }[]

/**
 * のし餅風のプロファイルを生成
 */
const getMochiProfile = (
  radius: number,
  height: number,
  segments: number = 12
): MochiProfile => {
  const points: MochiProfile = []

  const bottomY = -height / 2
  const topY = height / 2
  const sideHeight = height * 0.6
  const domeHeight = height * 0.4
  const sideTopY = bottomY + sideHeight
  const cornerRadius = height * 0.1

  points.push({ r: 0, y: bottomY })

  const bottomEdgeSegments = 2
  for (let i = 0; i <= bottomEdgeSegments; i++) {
    const t = i / bottomEdgeSegments
    const angle = (Math.PI / 2) * (1 - t)
    const r = radius - cornerRadius + cornerRadius * Math.cos(angle)
    const y = bottomY + cornerRadius * (1 - Math.sin(angle))
    points.push({ r, y })
  }

  const sideSegments = 3
  const sideBulge = 1.02
  for (let i = 1; i <= sideSegments; i++) {
    const t = i / sideSegments
    const sideY = bottomY + cornerRadius + (sideTopY - bottomY - cornerRadius) * t
    const bulgeFactor = 1 + (sideBulge - 1) * Math.sin(t * Math.PI)
    const r = Math.min(radius * bulgeFactor, radius * sideBulge)
    points.push({ r, y: sideY })
  }

  const domeSegments = segments - bottomEdgeSegments - sideSegments - 2
  for (let i = 1; i <= domeSegments; i++) {
    const t = i / domeSegments
    const easedT = 1 - Math.pow(1 - t, 2)
    const domeY = sideTopY + domeHeight * easedT
    const domeRadius = radius * Math.sqrt(1 - easedT * easedT * 0.85)
    points.push({ r: Math.max(domeRadius, 0), y: domeY })
  }

  points.push({ r: 0, y: topY })

  return points
}

/**
 * 餅のジオメトリを生成
 */
export const createMochiGeometry = (
  radius: number,
  height: number
): THREE.BufferGeometry => {
  const profile = getMochiProfile(radius, height, 16)
  const points = profile.map((p) => new THREE.Vector2(p.r, p.y))
  return new THREE.LatheGeometry(points, 32)
}

/**
 * 餅オブジェクトクラス
 * Three.jsのMeshとCannon-esのBodyを統合管理
 */
export class MochiObject {
  public readonly id: string
  public readonly config: MochiConfig
  public readonly mesh: THREE.Mesh
  public readonly body: CANNON.Body

  private _state: MochiState = 'flying'
  private _stackedOn: MochiObject | null = null
  private _stackedBy: MochiObject[] = []
  private _createdAt: number

  constructor(
    config: MochiConfig,
    material: CANNON.Material,
    initialPosition: THREE.Vector3
  ) {
    this.id = `mochi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    this.config = config
    this._createdAt = Date.now()

    this.mesh = this.createMesh(initialPosition)
    this.body = this.createBody(material, initialPosition)
  }

  // --- Getters ---
  get state(): MochiState {
    return this._state
  }
  get stackedOn(): MochiObject | null {
    return this._stackedOn
  }
  get stackedBy(): readonly MochiObject[] {
    return this._stackedBy
  }
  get position(): THREE.Vector3 {
    return new THREE.Vector3(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    )
  }
  get height(): number {
    return this.body.position.y
  }
  get topY(): number {
    return this.body.position.y + this.config.height / 2
  }
  get bottomY(): number {
    return this.body.position.y - this.config.height / 2
  }
  get isStacked(): boolean {
    return this._state === 'stacked'
  }
  get createdAt(): number {
    return this._createdAt
  }

  // --- State Management ---
  setState(state: MochiState): void {
    this._state = state
  }

  setStackedOn(mochi: MochiObject | null): void {
    if (this._stackedOn) {
      this._stackedOn._removeStackedBy(this)
    }
    this._stackedOn = mochi
    if (mochi) {
      mochi._addStackedBy(this)
      this._state = 'stacked'
    }
  }

  private _addStackedBy(mochi: MochiObject): void {
    if (!this._stackedBy.includes(mochi)) {
      this._stackedBy.push(mochi)
    }
  }

  private _removeStackedBy(mochi: MochiObject): void {
    const index = this._stackedBy.indexOf(mochi)
    if (index !== -1) {
      this._stackedBy.splice(index, 1)
    }
  }

  // --- Sync ---
  syncMeshWithBody(): void {
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    )
    this.mesh.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    )
  }

  // --- Velocity ---
  setVelocity(velocity: THREE.Vector3): void {
    this.body.velocity.set(velocity.x, velocity.y, velocity.z)
  }

  setAngularVelocity(angularVelocity: THREE.Vector3): void {
    this.body.angularVelocity.set(
      angularVelocity.x,
      angularVelocity.y,
      angularVelocity.z
    )
  }

  getSpeed(): number {
    const v = this.body.velocity
    return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2)
  }

  // --- Creation (Private) ---
  private createMesh(position: THREE.Vector3): THREE.Mesh {
    const geometry = this.createGeometry()
    const material = this.createMaterial()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.copy(position)
    mesh.userData.mochiObject = this
    return mesh
  }

  private createGeometry(): THREE.BufferGeometry {
    if (this.config.type === 'mikan') {
      return new THREE.SphereGeometry(this.config.radius, 32, 24)
    }
    return createMochiGeometry(this.config.radius, this.config.height)
  }

  private createMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: this.config.color,
      roughness: this.config.roughness,
      metalness: 0.0,
      side: THREE.DoubleSide
    })
  }

  private createBody(
    material: CANNON.Material,
    position: THREE.Vector3
  ): CANNON.Body {
    const shape = this.createPhysicsShape()
    const body = new CANNON.Body({
      mass: this.config.mass,
      material,
      linearDamping: 0.4,
      angularDamping: 0.6
    })
    body.addShape(shape)
    body.position.set(position.x, position.y, position.z)
    ;(body as CANNON.Body & { userData?: { mochiObject: MochiObject } }).userData =
      { mochiObject: this }
    return body
  }

  private createPhysicsShape(): CANNON.Shape {
    if (this.config.type === 'mikan') {
      return new CANNON.Sphere(this.config.radius)
    }
    const topRadius = this.config.radius * 0.85
    return new CANNON.Cylinder(
      topRadius,
      this.config.radius,
      this.config.height,
      12
    )
  }

  // --- Scene Management ---
  addToScene(scene: THREE.Scene): void {
    scene.add(this.mesh)
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.mesh)
  }

  addToWorld(world: CANNON.World): void {
    world.addBody(this.body)
  }

  removeFromWorld(world: CANNON.World): void {
    world.removeBody(this.body)
  }

  // --- Cleanup ---
  dispose(world: CANNON.World, scene: THREE.Scene): void {
    this.removeFromWorld(world)
    this.removeFromScene(scene)
    this.mesh.geometry.dispose()
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose()
    }
    if (this._stackedOn) {
      this._stackedOn._removeStackedBy(this)
    }
    this._stackedBy.forEach((mochi) => {
      mochi._stackedOn = null
    })
    this._stackedBy = []
  }
}
