import * as THREE from 'three'
import {
  type LaunchParameters,
  calculatePowerMultiplier,
  calculateSpeed,
  calculateInitialVelocity
} from '../../types/launch'

// 後方互換性のため再エクスポート
export { calculatePowerMultiplier, calculateSpeed }

/** @deprecated LaunchParameters を使用してください */
export type TrajectoryParams = LaunchParameters & {
  gravity?: number
}

export type TrajectoryResult = {
  points: THREE.Vector3[]
  landingDistance: number
}

const DEFAULT_GRAVITY = -9.8
const TIME_STEP = 0.05

export const calculateTrajectory = (
  params: TrajectoryParams,
  numPoints: number
): TrajectoryResult => {
  const { launchPosition, gravity = DEFAULT_GRAVITY } = params

  const velocity = calculateInitialVelocity(params)

  const points: THREE.Vector3[] = []
  let x = launchPosition.x
  let y = launchPosition.y
  let z = launchPosition.z
  let velY = velocity.y

  for (let i = 0; i < numPoints; i++) {
    points.push(new THREE.Vector3(x, y, z))

    x += velocity.x * TIME_STEP
    y += velY * TIME_STEP
    z += velocity.z * TIME_STEP
    velY += gravity * TIME_STEP

    if (y < -2) {
      for (let j = i + 1; j < numPoints; j++) {
        points.push(new THREE.Vector3(x, -2, z))
      }
      break
    }
  }

  const lastPoint = points[points.length - 1]
  const landingDistance = Math.sqrt(lastPoint.x ** 2 + lastPoint.z ** 2)

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
  marker.position.set(0, -1.45, 0)

  return marker
}
