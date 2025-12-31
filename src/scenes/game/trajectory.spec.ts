import { describe, expect, it } from 'bun:test'
import * as THREE from 'three'
import {
  calculatePowerMultiplier,
  calculateSpeed,
  calculateTrajectory,
  getTrajectoryColor,
  createTrajectoryLine,
  createTargetMarker
} from './trajectory'
import { calculateInitialVelocity } from '../../types/launch'

describe('trajectory', () => {
  describe('calculatePowerMultiplier', () => {
    it('should return minimum value at power 0', () => {
      expect(calculatePowerMultiplier(0)).toBe(0.12)
    })

    it('should return maximum value at power 100', () => {
      expect(calculatePowerMultiplier(100)).toBe(0.27)
    })

    it('should return intermediate value at power 50', () => {
      const result = calculatePowerMultiplier(50)
      expect(result).toBeGreaterThan(0.12)
      expect(result).toBeLessThan(0.27)
    })

    it('should be monotonically increasing', () => {
      const p0 = calculatePowerMultiplier(0)
      const p50 = calculatePowerMultiplier(50)
      const p100 = calculatePowerMultiplier(100)
      expect(p50).toBeGreaterThan(p0)
      expect(p100).toBeGreaterThan(p50)
    })
  })

  describe('calculateSpeed', () => {
    it('should return base speed at minimum multiplier', () => {
      const speed = calculateSpeed(0)
      expect(speed).toBe(8)
    })

    it('should increase with multiplier', () => {
      const slowSpeed = calculateSpeed(0.12)
      const fastSpeed = calculateSpeed(0.27)
      expect(fastSpeed).toBeGreaterThan(slowSpeed)
    })
  })

  describe('calculateInitialVelocity', () => {
    const createParams = (angleH: number, angleV: number, power: number) => ({
      angleH,
      angleV,
      power,
      launchPosition: new THREE.Vector3(0, 0, 10)
    })

    it('should return zero x velocity when aiming straight (angleH = 0)', () => {
      const velocity = calculateInitialVelocity(createParams(0, 45, 50))
      expect(Math.abs(velocity.x)).toBeLessThan(0.0001)
    })

    it('should return negative z velocity when aiming forward', () => {
      const velocity = calculateInitialVelocity(createParams(0, 45, 50))
      expect(velocity.z).toBeLessThan(0)
    })

    it('should return positive y velocity', () => {
      const velocity = calculateInitialVelocity(createParams(0, 45, 50))
      expect(velocity.y).toBeGreaterThan(0)
    })

    it('should have positive x velocity when aiming right (positive angleH)', () => {
      const velocity = calculateInitialVelocity(createParams(30, 45, 50))
      expect(velocity.x).toBeGreaterThan(0)
    })

    it('should have negative x velocity when aiming left (negative angleH)', () => {
      const velocity = calculateInitialVelocity(createParams(-30, 45, 50))
      expect(velocity.x).toBeLessThan(0)
    })

    it('should have higher y velocity with higher elevation angle', () => {
      const lowAngle = calculateInitialVelocity(createParams(0, 15, 50))
      const highAngle = calculateInitialVelocity(createParams(0, 75, 50))
      expect(highAngle.y).toBeGreaterThan(lowAngle.y)
    })
  })

  describe('calculateTrajectory', () => {
    const defaultParams = {
      angleH: 0,
      angleV: 45,
      power: 50,
      launchPosition: new THREE.Vector3(0, 0, 10)
    }

    it('should return correct number of points', () => {
      const result = calculateTrajectory(defaultParams, 50)
      expect(result.points).toHaveLength(50)
    })

    it('should start at launch position', () => {
      const result = calculateTrajectory(defaultParams, 50)
      const firstPoint = result.points[0]
      expect(firstPoint.x).toBe(0)
      expect(firstPoint.y).toBe(0)
      expect(firstPoint.z).toBe(10)
    })

    it('should have decreasing y values as projectile falls', () => {
      const result = calculateTrajectory(defaultParams, 50)
      const lastPoint = result.points[result.points.length - 1]
      expect(lastPoint.y).toBeLessThan(result.points[0].y)
    })

    it('should return landing distance', () => {
      const result = calculateTrajectory(defaultParams, 50)
      expect(typeof result.landingDistance).toBe('number')
      expect(result.landingDistance).toBeGreaterThanOrEqual(0)
    })

    it('should stop at ground level (-2)', () => {
      const result = calculateTrajectory(defaultParams, 100)
      for (const point of result.points) {
        expect(point.y).toBeGreaterThanOrEqual(-2)
      }
    })
  })

  describe('getTrajectoryColor', () => {
    it('should return green for close landing (< 2)', () => {
      expect(getTrajectoryColor(1)).toBe(0x00ff00)
      expect(getTrajectoryColor(0)).toBe(0x00ff00)
      expect(getTrajectoryColor(1.9)).toBe(0x00ff00)
    })

    it('should return yellow for medium distance (2-4)', () => {
      expect(getTrajectoryColor(2)).toBe(0xffff00)
      expect(getTrajectoryColor(3)).toBe(0xffff00)
      expect(getTrajectoryColor(3.9)).toBe(0xffff00)
    })

    it('should return cyan for far landing (>= 4)', () => {
      expect(getTrajectoryColor(4)).toBe(0x00ffff)
      expect(getTrajectoryColor(10)).toBe(0x00ffff)
    })
  })

  describe('createTrajectoryLine', () => {
    it('should create a THREE.Line', () => {
      const line = createTrajectoryLine(50)
      expect(line).toBeInstanceOf(THREE.Line)
    })

    it('should have dashed material', () => {
      const line = createTrajectoryLine(50)
      expect(line.material).toBeInstanceOf(THREE.LineDashedMaterial)
    })

    it('should have correct number of points in geometry', () => {
      const numPoints = 50
      const line = createTrajectoryLine(numPoints)
      const positions = line.geometry.attributes.position
      expect(positions.count).toBe(numPoints)
    })
  })

  describe('createTargetMarker', () => {
    it('should create a THREE.Mesh', () => {
      const marker = createTargetMarker()
      expect(marker).toBeInstanceOf(THREE.Mesh)
    })

    it('should have ring geometry', () => {
      const marker = createTargetMarker()
      expect(marker.geometry).toBeInstanceOf(THREE.RingGeometry)
    })

    it('should be positioned on the ground plane', () => {
      const marker = createTargetMarker()
      expect(marker.position.y).toBe(-1.45)
    })

    it('should be rotated to face up', () => {
      const marker = createTargetMarker()
      expect(marker.rotation.x).toBe(-Math.PI / 2)
    })
  })
})
