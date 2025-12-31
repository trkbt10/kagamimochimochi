import * as THREE from 'three'
import {
  type LaunchParameters,
  calculateInitialVelocity
} from '../../types/launch'

export type TrajectoryInput = LaunchParameters & {
  gravity?: number
  damping?: number
}

export type TrajectoryResult = {
  points: THREE.Vector3[]
  landingDistance: number
}

const DEFAULT_GRAVITY = -9.8
const DEFAULT_DAMPING = 0.4 // GameScene.tsのlinearDampingと一致
const TIME_STEP = 0.05

/**
 * DAI（台）の位置と寸法
 */
export const DAI_POSITION = {
  x: 0,
  y: -1.75,
  z: 0
} as const

export const DAI_HEIGHT = 0.5

/** DAI上面のY座標（ターゲットマーカー配置用） */
export const DAI_SURFACE_Y = DAI_POSITION.y + DAI_HEIGHT / 2 // -1.5

/**
 * ターゲット位置（スコア計算用：DAIの中心位置）
 */
export const TARGET_POSITION = {
  x: DAI_POSITION.x,
  y: DAI_SURFACE_Y,
  z: DAI_POSITION.z
} as const

export const calculateTrajectory = (
  params: TrajectoryInput,
  numPoints: number
): TrajectoryResult => {
  const { launchPosition, gravity = DEFAULT_GRAVITY, damping = DEFAULT_DAMPING } = params

  const velocity = calculateInitialVelocity(params)

  const points: THREE.Vector3[] = []
  let x = launchPosition.x
  let y = launchPosition.y
  let z = launchPosition.z
  let velX = velocity.x
  let velY = velocity.y
  let velZ = velocity.z

  // 減衰係数: CANNON-esのlinearDampingと同様の計算
  // 各フレームで velocity *= (1 - damping * dt)
  const dampingFactor = 1 - damping * TIME_STEP

  for (let i = 0; i < numPoints; i++) {
    points.push(new THREE.Vector3(x, y, z))

    // 位置を更新
    x += velX * TIME_STEP
    y += velY * TIME_STEP
    z += velZ * TIME_STEP

    // 速度を更新（重力 + 減衰）
    velY += gravity * TIME_STEP
    velX *= dampingFactor
    velY *= dampingFactor
    velZ *= dampingFactor

    if (y < -2) {
      for (let j = i + 1; j < numPoints; j++) {
        points.push(new THREE.Vector3(x, -2, z))
      }
      break
    }
  }

  const lastPoint = points[points.length - 1]
  // ターゲット位置からの距離（XZ平面上）
  const dx = lastPoint.x - TARGET_POSITION.x
  const dz = lastPoint.z - TARGET_POSITION.z
  const landingDistance = Math.sqrt(dx ** 2 + dz ** 2)

  return { points, landingDistance }
}

export const getTrajectoryColor = (landingDistance: number): number => {
  if (landingDistance < 2) return 0x00ff00 // Green - good aim
  if (landingDistance < 4) return 0xffff00 // Yellow - close
  return 0x00ffff // Cyan - default
}

export const createTrajectoryLine = (numPoints: number): THREE.Line => {
  const points: THREE.Vector3[] = []
  for (let i = 0; i < numPoints; i++) {
    points.push(new THREE.Vector3())
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineDashedMaterial({
    color: 0x00ffff,
    dashSize: 0.3,
    gapSize: 0.15,
    transparent: true,
    opacity: 0.8
  })

  const line = new THREE.Line(geometry, material)
  line.computeLineDistances()

  return line
}

export const updateTrajectoryLine = (
  line: THREE.Line,
  points: THREE.Vector3[],
  color: number
): void => {
  const positions = line.geometry.attributes.position

  for (let i = 0; i < points.length; i++) {
    positions.setXYZ(i, points[i].x, points[i].y, points[i].z)
  }

  positions.needsUpdate = true
  line.computeLineDistances()

  const material = line.material as THREE.LineDashedMaterial
  material.color.setHex(color)
}

export const createTargetMarker = (): THREE.Mesh => {
  const geometry = new THREE.RingGeometry(1.8, 2.2, 32)
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
  })

  const marker = new THREE.Mesh(geometry, material)
  marker.rotation.x = -Math.PI / 2
  marker.position.set(DAI_POSITION.x, DAI_SURFACE_Y, DAI_POSITION.z)

  return marker
}
