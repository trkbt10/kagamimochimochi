import { describe, test, expect } from 'bun:test'
import { createPanel3D } from './panel-3d'
import * as THREE from 'three'

describe('createPanel3D', () => {
  test('THREE.Mesh を返す', () => {
    const panel = createPanel3D({})

    expect(panel).toBeInstanceOf(THREE.Mesh)
  })

  test('デフォルトのサイズで作成される', () => {
    const panel = createPanel3D({})
    const geometry = panel.geometry as THREE.BoxGeometry
    const params = geometry.parameters

    expect(params.width).toBe(4)
    expect(params.height).toBe(3)
    expect(params.depth).toBe(0.1)
  })

  test('カスタムサイズで作成できる', () => {
    const panel = createPanel3D({
      width: 5,
      height: 4,
      depth: 0.2
    })
    const geometry = panel.geometry as THREE.BoxGeometry
    const params = geometry.parameters

    expect(params.width).toBe(5)
    expect(params.height).toBe(4)
    expect(params.depth).toBe(0.2)
  })

  test('透明なマテリアルが設定される', () => {
    const panel = createPanel3D({ opacity: 0.5 })
    const material = panel.material as THREE.MeshStandardMaterial

    expect(material.transparent).toBe(true)
    expect(material.opacity).toBe(0.5)
  })

  test('デフォルトの opacity は 0.85', () => {
    const panel = createPanel3D({})
    const material = panel.material as THREE.MeshStandardMaterial

    expect(material.opacity).toBe(0.85)
  })

  test('枠線が子として追加される', () => {
    const panel = createPanel3D({})

    expect(panel.children.length).toBe(1)
    expect(panel.children[0]).toBeInstanceOf(THREE.LineSegments)
  })

  test('カスタム色で作成できる', () => {
    const panel = createPanel3D({
      color: 0xff0000,
      borderColor: 0x00ff00
    })
    const material = panel.material as THREE.MeshStandardMaterial
    const borderMaterial = (panel.children[0] as THREE.LineSegments)
      .material as THREE.LineBasicMaterial

    expect(material.color.getHex()).toBe(0xff0000)
    expect(borderMaterial.color.getHex()).toBe(0x00ff00)
  })
})
