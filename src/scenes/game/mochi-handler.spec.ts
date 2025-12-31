import { describe, expect, it } from 'bun:test'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { MOCHI_HANDLERS, getNextMochiType, type MochiType } from './mochi-handler'

describe('mochi-handler', () => {
  describe('MOCHI_HANDLERS', () => {
    it('should have handlers for all mochi types', () => {
      expect(MOCHI_HANDLERS.base).toBeDefined()
      expect(MOCHI_HANDLERS.top).toBeDefined()
      expect(MOCHI_HANDLERS.mikan).toBeDefined()
    })

    describe('base handler', () => {
      const handler = MOCHI_HANDLERS.base

      it('should have correct display name', () => {
        expect(handler.displayName).toBe('ベース餅')
      })

      it('should have correct mass', () => {
        expect(handler.mass).toBe(3)
      })

      it('should create geometry as BufferGeometry', () => {
        const geometry = handler.createGeometry()
        expect(geometry).toBeInstanceOf(THREE.BufferGeometry)
        geometry.dispose()
      })

      it('should create material with default opacity', () => {
        const material = handler.createMaterial()
        expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
        const stdMaterial = material as THREE.MeshStandardMaterial
        expect(stdMaterial.color.getHex()).toBe(0xfff8e7)
        material.dispose()
      })

      it('should create material with custom opacity', () => {
        const material = handler.createMaterial(0.5)
        const stdMaterial = material as THREE.MeshStandardMaterial
        expect(stdMaterial.transparent).toBe(true)
        expect(stdMaterial.opacity).toBe(0.5)
        material.dispose()
      })

      it('should create physics shape as ConvexPolyhedron', () => {
        const shape = handler.createPhysicsShape()
        expect(shape).toBeInstanceOf(CANNON.ConvexPolyhedron)
      })
    })

    describe('top handler', () => {
      const handler = MOCHI_HANDLERS.top

      it('should have correct display name', () => {
        expect(handler.displayName).toBe('上餅')
      })

      it('should have correct mass (less than base)', () => {
        expect(handler.mass).toBe(2)
        expect(handler.mass).toBeLessThan(MOCHI_HANDLERS.base.mass)
      })
    })

    describe('mikan handler', () => {
      const handler = MOCHI_HANDLERS.mikan

      it('should have correct display name', () => {
        expect(handler.displayName).toBe('みかん')
      })

      it('should have correct mass (lightest)', () => {
        expect(handler.mass).toBe(0.5)
        expect(handler.mass).toBeLessThan(MOCHI_HANDLERS.top.mass)
      })

      it('should create sphere geometry', () => {
        const geometry = handler.createGeometry()
        expect(geometry).toBeInstanceOf(THREE.SphereGeometry)
        geometry.dispose()
      })

      it('should create sphere physics shape', () => {
        const shape = handler.createPhysicsShape()
        expect(shape).toBeInstanceOf(CANNON.Sphere)
      })

      it('should create orange-colored material', () => {
        const material = handler.createMaterial()
        const stdMaterial = material as THREE.MeshStandardMaterial
        expect(stdMaterial.color.getHex()).toBe(0xff8c00)
        material.dispose()
      })
    })
  })

  describe('getNextMochiType', () => {
    it('should return top after base', () => {
      expect(getNextMochiType('base')).toBe('top')
    })

    it('should return mikan after top', () => {
      expect(getNextMochiType('top')).toBe('mikan')
    })

    it('should return null after mikan (game complete)', () => {
      expect(getNextMochiType('mikan')).toBeNull()
    })

    it('should follow correct sequence', () => {
      const sequence: (MochiType | null)[] = []
      let current: MochiType | null = 'base'

      while (current !== null) {
        sequence.push(current)
        current = getNextMochiType(current)
      }

      expect(sequence).toEqual(['base', 'top', 'mikan'])
    })
  })
})
