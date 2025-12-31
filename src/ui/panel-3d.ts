import * as THREE from 'three'

/**
 * 3Dパネルのオプション
 */
export type Panel3DOptions = {
  width?: number
  height?: number
  depth?: number
  color?: number
  opacity?: number
  borderColor?: number
  borderWidth?: number
}

/**
 * パネルメッシュを作成する
 */
function createPanelMesh(
  geometry: THREE.BoxGeometry,
  color: number,
  opacity: number
): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.9
  })
  return new THREE.Mesh(geometry, material)
}

/**
 * パネルの枠線を作成する
 */
function createPanelBorder(
  geometry: THREE.BoxGeometry,
  borderColor: number
): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry)
  const material = new THREE.LineBasicMaterial({ color: borderColor, linewidth: 2 })
  return new THREE.LineSegments(edges, material)
}

/**
 * 3Dパネルを作成する
 */
export function createPanel3D(options: Panel3DOptions): THREE.Mesh {
  const {
    width = 4,
    height = 3,
    depth = 0.1,
    color = 0x000000,
    opacity = 0.85,
    borderColor = 0xffd700
  } = options

  const geometry = new THREE.BoxGeometry(width, height, depth)
  const panel = createPanelMesh(geometry, color, opacity)

  const border = createPanelBorder(geometry, borderColor)
  panel.add(border)

  return panel
}
