import * as THREE from 'three'
import * as CANNON from 'cannon-es'

export type MochiType = 'base' | 'top' | 'mikan'

type MochiProfile = { r: number; y: number }[]

type MochiHandler = {
  displayName: string
  mass: number
  createGeometry: () => THREE.BufferGeometry
  createMaterial: (opacity?: number) => THREE.Material
  createPhysicsShape: () => CANNON.Shape
}

/**
 * のし餅風のプロファイルを生成
 * - 底面: 平ら（中心から開始）
 * - 側面: ほぼ垂直（わずかに外側に膨らむ）
 * - 上部: 緩やかなドーム形状
 */
const getMochiProfile = (radius: number, height: number, segments: number = 12): MochiProfile => {
  const points: MochiProfile = []

  const bottomY = -height / 2
  const topY = height / 2
  const sideHeight = height * 0.6 // 側面の高さ（全体の60%）
  const domeHeight = height * 0.4 // ドーム部分の高さ（全体の40%）
  const sideTopY = bottomY + sideHeight // 側面の終わり（ドームの始まり）
  const cornerRadius = height * 0.1 // 底部の角丸め

  // 1. 底部中心
  points.push({ r: 0, y: bottomY })

  // 2. 底面エッジ（角を若干丸める）
  const bottomEdgeSegments = 2
  for (let i = 0; i <= bottomEdgeSegments; i++) {
    const t = i / bottomEdgeSegments
    const angle = (Math.PI / 2) * (1 - t)
    const r = radius - cornerRadius + cornerRadius * Math.cos(angle)
    const y = bottomY + cornerRadius * (1 - Math.sin(angle))
    points.push({ r, y })
  }

  // 3. 側面（わずかに外側に膨らむ樽形状）
  const sideSegments = 3
  const sideBulge = 1.02 // 膨らみ係数
  for (let i = 1; i <= sideSegments; i++) {
    const t = i / sideSegments
    const sideY = bottomY + cornerRadius + (sideTopY - bottomY - cornerRadius) * t
    const bulgeFactor = 1 + (sideBulge - 1) * Math.sin(t * Math.PI)
    const r = Math.min(radius * bulgeFactor, radius * sideBulge)
    points.push({ r, y: sideY })
  }

  // 4. 上部ドーム（緩やかな丸み）
  const domeSegments = segments - bottomEdgeSegments - sideSegments - 2
  for (let i = 1; i <= domeSegments; i++) {
    const t = i / domeSegments
    const easedT = 1 - Math.pow(1 - t, 2) // イーズアウト
    const domeY = sideTopY + domeHeight * easedT
    const domeRadius = radius * Math.sqrt(1 - easedT * easedT * 0.85)
    points.push({ r: Math.max(domeRadius, 0), y: domeY })
  }

  // 5. 頂点
  points.push({ r: 0, y: topY })

  return points
}

const createMochiGeometry = (radius: number, height: number): THREE.BufferGeometry => {
  const profile = getMochiProfile(radius, height, 16)
  const points = profile.map(p => new THREE.Vector2(p.r, p.y))
  // プロファイル自体が底面中心から頂点まで含むため、追加の点は不要
  return new THREE.LatheGeometry(points, 32)
}

/**
 * 物理形状用のシンプルな円柱形状を生成
 * 視覚形状に近い安定した衝突判定を提供
 */
const createMochiPhysicsShape = (radius: number, height: number): CANNON.Cylinder => {
  // Cannon.jsのCylinderは上下の半径を指定可能
  // 上部を少し小さくして餅らしい形状に
  const topRadius = radius * 0.85
  const bottomRadius = radius
  const numSegments = 12

  return new CANNON.Cylinder(topRadius, bottomRadius, height, numSegments)
}

const createMochiMaterial = (color: number, opacity?: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.0,
    transparent: opacity !== undefined,
    opacity: opacity ?? 1,
    side: THREE.DoubleSide
  })

const BASE_HANDLER: MochiHandler = {
  displayName: 'ベース餅',
  mass: 3,
  createGeometry: () => createMochiGeometry(1.5, 0.75),
  createMaterial: (opacity) => createMochiMaterial(0xfff8e7, opacity),
  createPhysicsShape: () => createMochiPhysicsShape(1.5, 0.75)
}

const TOP_HANDLER: MochiHandler = {
  displayName: '上餅',
  mass: 2,
  createGeometry: () => createMochiGeometry(1.1, 0.55),
  createMaterial: (opacity) => createMochiMaterial(0xfff8e7, opacity),
  createPhysicsShape: () => createMochiPhysicsShape(1.1, 0.55)
}

const MIKAN_HANDLER: MochiHandler = {
  displayName: 'みかん',
  mass: 0.5,
  createGeometry: () => new THREE.SphereGeometry(0.5, 32, 24),
  createMaterial: (opacity) =>
    new THREE.MeshStandardMaterial({
      color: 0xff8c00,
      roughness: 0.8,
      metalness: 0.0,
      transparent: opacity !== undefined,
      opacity: opacity ?? 1,
      side: THREE.DoubleSide
    }),
  createPhysicsShape: () => new CANNON.Sphere(0.5)
}

export const MOCHI_HANDLERS: Record<MochiType, MochiHandler> = {
  base: BASE_HANDLER,
  top: TOP_HANDLER,
  mikan: MIKAN_HANDLER
}

export const getNextMochiType = (current: MochiType): MochiType | null => {
  const sequence: Record<MochiType, MochiType | null> = {
    base: 'top',
    top: 'mikan',
    mikan: null
  }
  return sequence[current]
}

export { createMochiGeometry }
