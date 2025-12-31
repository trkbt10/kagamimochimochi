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

const getMochiProfile = (radius: number, height: number, segments: number = 8): MochiProfile => {
  const points: MochiProfile = []
  const topRadius = radius * 0.65

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const ease = t * t * (3 - 2 * t) // smoothstep
    const r = radius - (radius - topRadius) * ease
    const y = -height / 2 + height * t
    points.push({ r, y })
  }

  return points
}

const createMochiGeometry = (radius: number, height: number): THREE.BufferGeometry => {
  const profile = getMochiProfile(radius, height, 16)
  const points = profile.map(p => new THREE.Vector2(p.r, p.y))
  points.push(new THREE.Vector2(0, height / 2))
  return new THREE.LatheGeometry(points, 32)
}

const createMochiPhysicsShape = (radius: number, height: number): CANNON.ConvexPolyhedron => {
  const profile = getMochiProfile(radius, height, 6)
  const radialSegments = 12

  const vertices: CANNON.Vec3[] = []
  const faces: number[][] = []

  for (let i = 0; i < profile.length; i++) {
    const { r, y } = profile[i]
    for (let j = 0; j < radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2
      vertices.push(new CANNON.Vec3(r * Math.cos(angle), y, r * Math.sin(angle)))
    }
  }

  const topCenterIndex = vertices.length
  vertices.push(new CANNON.Vec3(0, height / 2, 0))

  const bottomCenterIndex = vertices.length
  vertices.push(new CANNON.Vec3(0, -height / 2, 0))

  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const curr = i * radialSegments + j
      const next = i * radialSegments + ((j + 1) % radialSegments)
      const currUp = (i + 1) * radialSegments + j
      const nextUp = (i + 1) * radialSegments + ((j + 1) % radialSegments)

      faces.push([curr, next, nextUp])
      faces.push([curr, nextUp, currUp])
    }
  }

  const topRing = (profile.length - 1) * radialSegments
  for (let j = 0; j < radialSegments; j++) {
    const curr = topRing + j
    const next = topRing + ((j + 1) % radialSegments)
    faces.push([curr, topCenterIndex, next])
  }

  for (let j = 0; j < radialSegments; j++) {
    const curr = j
    const next = (j + 1) % radialSegments
    faces.push([next, bottomCenterIndex, curr])
  }

  return new CANNON.ConvexPolyhedron({ vertices, faces })
}

const createMochiMaterial = (color: number, opacity?: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.0,
    transparent: opacity !== undefined,
    opacity: opacity ?? 1
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
      opacity: opacity ?? 1
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
