import * as THREE from 'three'
import { createTextSprite } from './text-sprite'

export type GaugeGroup = {
  group: THREE.Group
  track: THREE.Mesh
  indicator: THREE.Mesh
  centerMark: THREE.Mesh
  fill?: THREE.Mesh
}

export type GaugeType = 'direction' | 'elevation' | 'power'

const createTrackWithBorder = (
  trackSize: { width: number; height: number; depth: number },
  borderSize: { width: number; height: number; depth: number }
): { track: THREE.Mesh; border: THREE.Mesh } => {
  const trackGeometry = new THREE.BoxGeometry(trackSize.width, trackSize.height, trackSize.depth)
  const trackMaterial = new THREE.MeshBasicMaterial({
    color: 0x222222,
    transparent: true,
    opacity: 0.9
  })
  const track = new THREE.Mesh(trackGeometry, trackMaterial)

  const borderGeometry = new THREE.BoxGeometry(borderSize.width, borderSize.height, borderSize.depth)
  const borderMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8
  })
  const border = new THREE.Mesh(borderGeometry, borderMaterial)
  border.position.z = -0.05

  return { track, border }
}

const createIndicatorWithGlow = (
  size: { width: number; height: number; depth: number },
  glowSize: { width: number; height: number; depth: number }
): THREE.Mesh => {
  const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth)
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const indicator = new THREE.Mesh(geometry, material)
  indicator.position.z = 0.1

  const glowGeometry = new THREE.BoxGeometry(glowSize.width, glowSize.height, glowSize.depth)
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.5
  })
  const glow = new THREE.Mesh(glowGeometry, glowMaterial)
  glow.position.z = 0.15
  indicator.add(glow)

  return indicator
}

const createCenterMark = (
  size: { width: number; height: number; depth: number }
): THREE.Mesh => {
  const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth)
  const material = new THREE.MeshBasicMaterial({ color: 0xffd700 })
  const mark = new THREE.Mesh(geometry, material)
  mark.position.z = 0.05
  return mark
}

export const createHorizontalGauge = (): GaugeGroup => {
  const group = new THREE.Group()

  const { track, border } = createTrackWithBorder(
    { width: 6, height: 0.4, depth: 0.15 },
    { width: 6.2, height: 0.6, depth: 0.05 }
  )
  group.add(track)
  group.add(border)

  const centerMark = createCenterMark({ width: 0.15, height: 0.8, depth: 0.2 })
  group.add(centerMark)

  const indicator = createIndicatorWithGlow(
    { width: 0.2, height: 0.7, depth: 0.25 },
    { width: 0.35, height: 0.85, depth: 0.05 }
  )
  group.add(indicator)

  const labelSprite = createTextSprite('左 ← 方向 → 右', 0.5)
  labelSprite.position.set(0, 0.8, 0)
  group.add(labelSprite)

  return { group, track, indicator, centerMark }
}

export const createVerticalGauge = (): GaugeGroup => {
  const group = new THREE.Group()

  const { track, border } = createTrackWithBorder(
    { width: 0.5, height: 4, depth: 0.15 },
    { width: 0.7, height: 4.2, depth: 0.05 }
  )
  group.add(track)
  group.add(border)

  const centerMark = createCenterMark({ width: 0.9, height: 0.15, depth: 0.2 })
  group.add(centerMark)

  const indicator = createIndicatorWithGlow(
    { width: 0.8, height: 0.2, depth: 0.25 },
    { width: 0.95, height: 0.35, depth: 0.05 }
  )
  group.add(indicator)

  const labelSprite = createTextSprite('▲ 角度 ▲', 0.5)
  labelSprite.position.set(0, 2.5, 0)
  group.add(labelSprite)

  return { group, track, indicator, centerMark }
}

const createPowerGradientSegments = (group: THREE.Group): void => {
  const segments = 20
  const segmentHeight = 4 / segments

  for (let i = 0; i < segments; i++) {
    const t = i / segments
    const segGeometry = new THREE.BoxGeometry(0.5, segmentHeight * 0.85, 0.1)

    const color = new THREE.Color()
    if (t < 0.5) {
      color.setHSL(0.33 - t * 0.33, 1, 0.5)
    } else {
      color.setHSL(0.17 - (t - 0.5) * 0.34, 1, 0.5)
    }

    const segMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.25
    })
    const segment = new THREE.Mesh(segGeometry, segMaterial)
    segment.position.y = -2 + segmentHeight * 0.5 + i * segmentHeight
    segment.position.z = 0.02
    group.add(segment)
  }
}

export const createPowerGauge = (): GaugeGroup => {
  const group = new THREE.Group()

  const { track, border } = createTrackWithBorder(
    { width: 0.6, height: 4, depth: 0.15 },
    { width: 0.8, height: 4.2, depth: 0.05 }
  )
  group.add(track)
  group.add(border)

  createPowerGradientSegments(group)

  const fillGeometry = new THREE.BoxGeometry(0.5, 1, 0.15)
  fillGeometry.translate(0, 0.5, 0)
  const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  const fill = new THREE.Mesh(fillGeometry, fillMaterial)
  fill.position.y = -2
  fill.position.z = 0.08
  fill.scale.y = 0.01
  group.add(fill)

  const dummyIndicator = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01))
  dummyIndicator.visible = false
  group.add(dummyIndicator)

  const dummyCenterMark = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01))
  dummyCenterMark.visible = false
  group.add(dummyCenterMark)

  const labelSprite = createTextSprite('パワー', 0.5)
  labelSprite.position.set(0, 2.5, 0)
  group.add(labelSprite)

  return { group, track, indicator: dummyIndicator, centerMark: dummyCenterMark, fill }
}

export const updateDirectionGauge = (gauge: GaugeGroup, gaugeValue: number): number => {
  const x = (gaugeValue / 100) * 6 - 3
  gauge.indicator.position.x = x
  return (gaugeValue - 50) * 1.2
}

export const updateElevationGauge = (gauge: GaugeGroup, gaugeValue: number): number => {
  const y = (gaugeValue / 100) * 4 - 2
  gauge.indicator.position.y = y
  return 15 + gaugeValue * 0.6
}

export const updatePowerGauge = (gauge: GaugeGroup, gaugeValue: number): void => {
  if (!gauge.fill) return

  const fillHeight = (gaugeValue / 100) * 4
  gauge.fill.scale.y = Math.max(fillHeight, 0.01)

  const t = gaugeValue / 100
  const color = new THREE.Color()
  if (t < 0.5) {
    color.setHSL(0.33 - t * 0.33, 1, 0.5)
  } else {
    color.setHSL(0.17 - (t - 0.5) * 0.34, 1, 0.5)
  }
  ;(gauge.fill.material as THREE.MeshBasicMaterial).color = color
}

export const resetPowerGauge = (gauge: GaugeGroup): void => {
  if (gauge.fill) {
    gauge.fill.scale.y = 1
    gauge.fill.position.y = -2
  }
}

export const updateGaugeContainerPosition = (
  container: THREE.Group,
  camera: THREE.Camera
): void => {
  const distance = 5
  const offsetY = -1.5

  const forward = new THREE.Vector3(0, 0, -1)
  forward.applyQuaternion(camera.quaternion)

  container.position.copy(camera.position)
  container.position.add(forward.multiplyScalar(distance))
  container.position.y += offsetY
  container.quaternion.copy(camera.quaternion)
}
