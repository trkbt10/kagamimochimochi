import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'

type GamePhase = 'direction' | 'elevation' | 'power' | 'flying' | 'landed' | 'complete'
type MochiType = 'base' | 'top' | 'mikan'

interface LaunchedObject {
  mesh: THREE.Mesh
  body: CANNON.Body
  type: MochiType
}

interface GaugeGroup {
  group: THREE.Group
  track: THREE.Mesh
  indicator: THREE.Mesh
  centerMark: THREE.Mesh
  fill?: THREE.Mesh
}

export class GameScene extends BaseScene {
  private world: CANNON.World | null = null
  private groundBody: CANNON.Body | null = null
  private daiBody: CANNON.Body | null = null

  // Physics materials
  private mochiMaterial: CANNON.Material | null = null
  private groundMaterial: CANNON.Material | null = null

  // Landing timeout
  private flyingStartTime = 0

  private launchedObjects: LaunchedObject[] = []
  private currentObject: LaunchedObject | null = null
  private currentType: MochiType = 'base'

  private phase: GamePhase = 'direction'
  private angleH = 0 // Horizontal angle (-60 to 60)
  private angleV = 45 // Vertical angle (15 to 75)
  private power = 50

  // Golf-style gauge values (0-100, oscillating)
  private gaugeValue = 50
  private gaugeDirection = 1
  private gaugeSpeed = 120 // Speed of gauge oscillation

  private aimArrow: THREE.Group | null = null
  private launchPosition = new THREE.Vector3(0, 0, 10)

  private dai: THREE.Mesh | null = null

  // 3D Gauge elements
  private directionGauge: GaugeGroup | null = null
  private elevationGauge: GaugeGroup | null = null
  private powerGauge: GaugeGroup | null = null
  private gaugeContainer: THREE.Group | null = null

  // Trajectory prediction line
  private trajectoryLine: THREE.Line | null = null
  private trajectoryPoints: THREE.Vector3[] = []

  // Target marker (shows where dai is)
  private targetMarker: THREE.Mesh | null = null

  // 3D UI elements (text sprites)
  private phaseSprite: THREE.Sprite | null = null
  private instructionSprite: THREE.Sprite | null = null
  private uiContainer: THREE.Group | null = null

  // Preview mesh (shown before launch)
  private previewMesh: THREE.Mesh | null = null

  constructor(game: Game) {
    super(game)
  }

  async enter() {
    this.resetState()
    this.setupPhysics()
    this.setupScene()
    this.createTrajectoryLine()
    this.create3DGauges()
    this.buildUI()
    this.setupEventListeners()
    this.setupCamera()
    this.createPreviewMesh() // 発射前のプレビューモデルを表示
    this.game.audioManager.playBgm()
  }

  async exit() {
    this.game.audioManager.stopBgm()
    this.removeUI()
    this.removeEventListeners()
    this.removePreviewMesh() // プレビューメッシュをクリーンアップ
    this.clearScene()
    this.world = null
  }

  update(delta: number) {
    // Update physics
    if (this.world) {
      this.world.step(1 / 60, delta, 3)
    }

    // Sync meshes with physics bodies
    for (const obj of this.launchedObjects) {
      obj.mesh.position.copy(obj.body.position as unknown as THREE.Vector3)
      obj.mesh.quaternion.copy(obj.body.quaternion as unknown as THREE.Quaternion)
    }

    // Update aim arrow during gauge phases
    if (this.aimArrow && (this.phase === 'direction' || this.phase === 'elevation' || this.phase === 'power')) {
      this.updateAimArrow()
    }

    // Update gauge position to follow camera (billboard style)
    if (this.gaugeContainer && this.gaugeContainer.visible) {
      this.updateGaugePosition()
    }

    // Update UI container position to follow camera
    if (this.uiContainer) {
      this.updateUIPosition()
    }

    // Golf-style gauge oscillation
    if (this.phase === 'direction' || this.phase === 'elevation' || this.phase === 'power') {
      this.gaugeValue += this.gaugeDirection * this.gaugeSpeed * delta
      if (this.gaugeValue >= 100) {
        this.gaugeValue = 100
        this.gaugeDirection = -1
      } else if (this.gaugeValue <= 0) {
        this.gaugeValue = 0
        this.gaugeDirection = 1
      }
      this.update3DGauges()
      this.updateTrajectory()
    }

    // Check if object has landed
    if (this.phase === 'flying' && this.currentObject) {
      const velocity = this.currentObject.body.velocity
      const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
      const yPos = this.currentObject.body.position.y
      const timeSinceLaunch = (Date.now() - this.flyingStartTime) / 1000

      // 着地判定：速度が遅くなったか、地面付近にいるか、時間が経ったか
      const isSlowEnough = speed < 0.5
      const isNearGround = yPos < 3
      const hasLandedOnSomething = yPos < 2 && speed < 1.5
      const timeoutReached = timeSinceLaunch > 8 // 8秒のタイムアウト

      if ((isSlowEnough && isNearGround) || hasLandedOnSomething || timeoutReached) {
        this.onObjectLanded()
      }
    }
  }

  private updateGaugePosition() {
    if (!this.gaugeContainer) return

    const camera = this.game.camera

    // Position gauge in front of camera, slightly below center
    const distance = 5 // Distance from camera
    const offsetY = -1.5 // Below center of view

    // Get camera's forward direction
    const forward = new THREE.Vector3(0, 0, -1)
    forward.applyQuaternion(camera.quaternion)

    // Position gauge in front of camera
    this.gaugeContainer.position.copy(camera.position)
    this.gaugeContainer.position.add(forward.multiplyScalar(distance))
    this.gaugeContainer.position.y += offsetY

    // Make gauge face the camera (billboard)
    this.gaugeContainer.quaternion.copy(camera.quaternion)
  }

  private updateUIPosition() {
    if (!this.uiContainer) return

    const camera = this.game.camera

    // Position UI in front of camera, at top of view
    const distance = 6
    const offsetY = 2

    const forward = new THREE.Vector3(0, 0, -1)
    forward.applyQuaternion(camera.quaternion)

    this.uiContainer.position.copy(camera.position)
    this.uiContainer.position.add(forward.multiplyScalar(distance))
    this.uiContainer.position.y += offsetY

    // Make UI face the camera
    this.uiContainer.quaternion.copy(camera.quaternion)
  }

  private createTrajectoryLine() {
    // Create trajectory line with initial points
    const numPoints = 50
    this.trajectoryPoints = []
    for (let i = 0; i < numPoints; i++) {
      this.trajectoryPoints.push(new THREE.Vector3())
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(this.trajectoryPoints)
    const material = new THREE.LineDashedMaterial({
      color: 0x00ffff,
      dashSize: 0.3,
      gapSize: 0.15,
      transparent: true,
      opacity: 0.8
    })

    this.trajectoryLine = new THREE.Line(geometry, material)
    this.trajectoryLine.computeLineDistances()
    this.scene.add(this.trajectoryLine)

    // Create target marker ring on the ground to show where dai is
    const ringGeometry = new THREE.RingGeometry(1.8, 2.2, 32)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    })
    this.targetMarker = new THREE.Mesh(ringGeometry, ringMaterial)
    this.targetMarker.rotation.x = -Math.PI / 2
    this.targetMarker.position.set(0, -1.45, 0)
    this.scene.add(this.targetMarker)
  }

  private updateTrajectory() {
    if (!this.trajectoryLine) return

    // Calculate trajectory based on current angle and power
    const powerMultiplier = 0.12 + (this.power / 100) * 0.15
    const hRad = (this.angleH * Math.PI) / 180
    const vRad = (this.angleV * Math.PI) / 180
    const speed = 8 + powerMultiplier * 20

    // Initial velocity
    const vx = Math.sin(hRad) * speed * Math.cos(vRad)
    const vy = Math.sin(vRad) * speed
    const vz = -Math.cos(hRad) * speed * Math.cos(vRad)

    // Gravity (setupPhysics()と同じ値)
    const gravity = -9.8

    // Calculate trajectory points
    const dt = 0.05 // Time step
    let x = this.launchPosition.x
    let y = this.launchPosition.y
    let z = this.launchPosition.z
    let velY = vy

    for (let i = 0; i < this.trajectoryPoints.length; i++) {
      this.trajectoryPoints[i].set(x, y, z)

      // Update position
      x += vx * dt
      y += velY * dt
      z += vz * dt
      velY += gravity * dt

      // Stop if below ground
      if (y < -2) {
        // Fill remaining points with last valid position
        for (let j = i + 1; j < this.trajectoryPoints.length; j++) {
          this.trajectoryPoints[j].set(x, -2, z)
        }
        break
      }
    }

    // Update line geometry
    const positions = this.trajectoryLine.geometry.attributes.position
    for (let i = 0; i < this.trajectoryPoints.length; i++) {
      positions.setXYZ(i, this.trajectoryPoints[i].x, this.trajectoryPoints[i].y, this.trajectoryPoints[i].z)
    }
    positions.needsUpdate = true
    this.trajectoryLine.computeLineDistances()

    // Update line color based on where it lands relative to target
    const landingX = this.trajectoryPoints[this.trajectoryPoints.length - 1].x
    const landingZ = this.trajectoryPoints[this.trajectoryPoints.length - 1].z
    const distFromTarget = Math.sqrt(landingX ** 2 + landingZ ** 2)

    const lineMaterial = this.trajectoryLine.material as THREE.LineDashedMaterial
    if (distFromTarget < 2) {
      lineMaterial.color.setHex(0x00ff00) // Green - good aim
    } else if (distFromTarget < 4) {
      lineMaterial.color.setHex(0xffff00) // Yellow - close
    } else {
      lineMaterial.color.setHex(0x00ffff) // Cyan - default
    }
  }

  private setupCamera() {
    // Position camera to see both launch point (z=10) and dai (z=0)
    const camera = this.game.camera

    // カメラを斜め上から俯瞰するように配置
    // 発射点(0, 0, 10)と台(0, -1.75, 0)の両方が見えるように
    camera.position.set(0, 12, 22)
    camera.lookAt(0, 0, 5) // 発射点と台の中間を見る
  }

  private create3DGauges() {
    this.gaugeContainer = new THREE.Group()
    // Position will be updated every frame to follow camera
    this.scene.add(this.gaugeContainer)

    // Scale down for appropriate size in view
    const gaugeScale = 0.3

    // Create direction gauge (horizontal)
    this.directionGauge = this.createHorizontalGauge()
    this.directionGauge.group.scale.setScalar(gaugeScale)
    this.directionGauge.group.position.set(0, 0, 0)
    this.gaugeContainer.add(this.directionGauge.group)

    // Create elevation gauge (vertical)
    this.elevationGauge = this.createVerticalGauge()
    this.elevationGauge.group.scale.setScalar(gaugeScale)
    this.elevationGauge.group.position.set(0, 0, 0)
    this.elevationGauge.group.visible = false
    this.gaugeContainer.add(this.elevationGauge.group)

    // Create power gauge (vertical with fill)
    this.powerGauge = this.createPowerGauge()
    this.powerGauge.group.scale.setScalar(gaugeScale)
    this.powerGauge.group.position.set(0, 0, 0)
    this.powerGauge.group.visible = false
    this.gaugeContainer.add(this.powerGauge.group)
  }

  private createHorizontalGauge(): GaugeGroup {
    const group = new THREE.Group()

    // Track (background bar) - centered at origin
    const trackGeometry = new THREE.BoxGeometry(6, 0.4, 0.15)
    const trackMaterial = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.9
    })
    const track = new THREE.Mesh(trackGeometry, trackMaterial)
    group.add(track)

    // Track border (outline)
    const borderGeometry = new THREE.BoxGeometry(6.2, 0.6, 0.05)
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    })
    const border = new THREE.Mesh(borderGeometry, borderMaterial)
    border.position.z = -0.05
    group.add(border)

    // Center mark (target indicator)
    const centerMarkGeometry = new THREE.BoxGeometry(0.15, 0.8, 0.2)
    const centerMarkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 })
    const centerMark = new THREE.Mesh(centerMarkGeometry, centerMarkMaterial)
    centerMark.position.z = 0.05
    group.add(centerMark)

    // Indicator (moving marker) - starts at center
    const indicatorGeometry = new THREE.BoxGeometry(0.2, 0.7, 0.25)
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial)
    indicator.position.z = 0.1

    // Glow effect on indicator
    const glowGeometry = new THREE.BoxGeometry(0.35, 0.85, 0.05)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.5
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    glow.position.z = 0.15
    indicator.add(glow)

    group.add(indicator)

    // Label above the gauge - 左右のラベルを追加
    const labelSprite = this.createTextSprite('左 ← 方向 → 右', 0.5)
    labelSprite.position.set(0, 0.8, 0)
    group.add(labelSprite)

    return { group, track, indicator, centerMark }
  }

  private createVerticalGauge(): GaugeGroup {
    const group = new THREE.Group()

    // Track (background bar) - centered at origin
    const trackGeometry = new THREE.BoxGeometry(0.5, 4, 0.15)
    const trackMaterial = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.9
    })
    const track = new THREE.Mesh(trackGeometry, trackMaterial)
    group.add(track)

    // Track border
    const borderGeometry = new THREE.BoxGeometry(0.7, 4.2, 0.05)
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    })
    const border = new THREE.Mesh(borderGeometry, borderMaterial)
    border.position.z = -0.05
    group.add(border)

    // Center mark (target indicator)
    const centerMarkGeometry = new THREE.BoxGeometry(0.9, 0.15, 0.2)
    const centerMarkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 })
    const centerMark = new THREE.Mesh(centerMarkGeometry, centerMarkMaterial)
    centerMark.position.z = 0.05
    group.add(centerMark)

    // Indicator (moving marker)
    const indicatorGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.25)
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial)
    indicator.position.z = 0.1

    // Glow effect
    const glowGeometry = new THREE.BoxGeometry(0.95, 0.35, 0.05)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.5
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    glow.position.z = 0.15
    indicator.add(glow)

    group.add(indicator)

    // Label above the gauge
    const labelSprite = this.createTextSprite('▲ 角度 ▲', 0.5)
    labelSprite.position.set(0, 2.5, 0)
    group.add(labelSprite)

    return { group, track, indicator, centerMark }
  }

  private createPowerGauge(): GaugeGroup {
    const group = new THREE.Group()

    // Track (background)
    const trackGeometry = new THREE.BoxGeometry(0.6, 4, 0.15)
    const trackMaterial = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.9
    })
    const track = new THREE.Mesh(trackGeometry, trackMaterial)
    group.add(track)

    // Track border
    const borderGeometry = new THREE.BoxGeometry(0.8, 4.2, 0.05)
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    })
    const border = new THREE.Mesh(borderGeometry, borderMaterial)
    border.position.z = -0.05
    group.add(border)

    // Gradient background segments for power visualization
    const segments = 20
    const segmentHeight = 4 / segments
    for (let i = 0; i < segments; i++) {
      const t = i / segments
      const segGeometry = new THREE.BoxGeometry(0.5, segmentHeight * 0.85, 0.1)

      // Green to yellow to red gradient
      const color = new THREE.Color()
      if (t < 0.5) {
        color.setHSL(0.33 - t * 0.33, 1, 0.5) // Green to Yellow
      } else {
        color.setHSL(0.17 - (t - 0.5) * 0.34, 1, 0.5) // Yellow to Red
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

    // Fill bar (dynamic height) - pivot at bottom
    const fillGeometry = new THREE.BoxGeometry(0.5, 1, 0.15)
    // Move geometry so pivot is at bottom
    fillGeometry.translate(0, 0.5, 0)
    const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    const fill = new THREE.Mesh(fillGeometry, fillMaterial)
    fill.position.y = -2 // Start at bottom of gauge
    fill.position.z = 0.08
    fill.scale.y = 0.01 // Start with minimal height
    group.add(fill)

    // Dummy indicator and centerMark for interface compatibility
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01))
    indicator.visible = false
    group.add(indicator)

    const centerMark = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01))
    centerMark.visible = false
    group.add(centerMark)

    // Label above the gauge
    const labelSprite = this.createTextSprite('パワー', 0.5)
    labelSprite.position.set(0, 2.5, 0)
    group.add(labelSprite)

    return { group, track, indicator, centerMark, fill }
  }

  private createTextSprite(text: string, size: number): THREE.Sprite {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.width = 512
    canvas.height = 128

    context.fillStyle = 'rgba(0, 0, 0, 0)'
    context.fillRect(0, 0, canvas.width, canvas.height)

    context.font = 'bold 64px sans-serif'
    context.fillStyle = '#FFD700'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.strokeStyle = '#000000'
    context.lineWidth = 4
    context.strokeText(text, canvas.width / 2, canvas.height / 2)
    context.fillText(text, canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(size * 4, size, 1)

    return sprite
  }

  private update3DGauges() {
    if (this.phase === 'direction' && this.directionGauge) {
      // Move indicator along horizontal track (-3 to 3)
      const x = (this.gaugeValue / 100) * 6 - 3
      this.directionGauge.indicator.position.x = x
      // Preview angle in real-time
      this.angleH = (this.gaugeValue - 50) * 1.2

    } else if (this.phase === 'elevation' && this.elevationGauge) {
      // Move indicator along vertical track (-2 to 2)
      const y = (this.gaugeValue / 100) * 4 - 2
      this.elevationGauge.indicator.position.y = y
      // Preview angle in real-time
      this.angleV = 15 + this.gaugeValue * 0.6

    } else if (this.phase === 'power' && this.powerGauge && this.powerGauge.fill) {
      // Scale fill bar from bottom (pivot is at bottom of geometry)
      const fillHeight = (this.gaugeValue / 100) * 4
      this.powerGauge.fill.scale.y = Math.max(fillHeight, 0.01)

      // Update fill color based on power level
      const t = this.gaugeValue / 100
      const color = new THREE.Color()
      if (t < 0.5) {
        color.setHSL(0.33 - t * 0.33, 1, 0.5) // Green to Yellow
      } else {
        color.setHSL(0.17 - (t - 0.5) * 0.34, 1, 0.5) // Yellow to Red
      }
      ;(this.powerGauge.fill.material as THREE.MeshBasicMaterial).color = color
    }
  }

  private resetState() {
    this.launchedObjects = []
    this.currentObject = null
    this.currentType = 'base'
    this.phase = 'direction'
    this.angleH = 0
    this.angleV = 45
    this.power = 50
    this.gaugeValue = 50
    this.gaugeDirection = 1
  }

  private setupPhysics() {
    this.world = new CANNON.World()
    this.world.gravity.set(0, -9.8, 0) // より自然な重力に調整
    this.world.broadphase = new CANNON.NaiveBroadphase()

    // Create physics materials
    this.mochiMaterial = new CANNON.Material('mochi')
    this.groundMaterial = new CANNON.Material('ground')

    // Ground
    const groundShape = new CANNON.Plane()
    this.groundBody = new CANNON.Body({ mass: 0, material: this.groundMaterial })
    this.groundBody.addShape(groundShape)
    this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
    this.groundBody.position.set(0, -2, 0)
    this.world.addBody(this.groundBody)

    // Dai (platform) - 台にもgroundMaterialを適用
    const daiShape = new CANNON.Cylinder(1.8, 2, 0.5, 16)
    this.daiBody = new CANNON.Body({ mass: 0, material: this.groundMaterial })
    this.daiBody.addShape(daiShape)
    this.daiBody.position.set(0, -1.75, 0)
    this.world.addBody(this.daiBody)

    // Contact material: モチと地面/台
    const mochiGroundContact = new CANNON.ContactMaterial(this.mochiMaterial, this.groundMaterial, {
      friction: 0.9,        // 高い摩擦で滑りにくく
      restitution: 0.15     // 反発を低くしてバウンドを抑える
    })
    this.world.addContactMaterial(mochiGroundContact)

    // Contact material: モチ同士 - 粘り気を高くして積みやすくする
    const mochiMochiContact = new CANNON.ContactMaterial(this.mochiMaterial, this.mochiMaterial, {
      friction: 1.5,        // 非常に高い摩擦でモチ同士が滑りにくい
      restitution: 0.05     // ほとんど弾まない
    })
    this.world.addContactMaterial(mochiMochiContact)
  }

  private setupScene() {
    // Background
    this.scene.background = new THREE.Color(0x2a1515)
    this.scene.fog = new THREE.FogExp2(0x2a1515, 0.03)

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambient)

    const mainLight = new THREE.DirectionalLight(0xffffff, 1)
    mainLight.position.set(5, 10, 5)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.width = 2048
    mainLight.shadow.mapSize.height = 2048
    this.scene.add(mainLight)

    const spotLight = new THREE.SpotLight(0xffd700, 1, 30, Math.PI / 6, 0.5)
    spotLight.position.set(0, 15, 0)
    spotLight.target.position.set(0, 0, 0)
    this.scene.add(spotLight)
    this.scene.add(spotLight.target)

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(50, 50)
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B7355,
      roughness: 0.9
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -2
    floor.receiveShadow = true
    this.scene.add(floor)

    // Dai (stand)
    const daiGeometry = new THREE.CylinderGeometry(1.8, 2, 0.5, 32)
    const daiMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.6,
      metalness: 0.2
    })
    this.dai = new THREE.Mesh(daiGeometry, daiMaterial)
    this.dai.position.set(0, -1.75, 0)
    this.dai.castShadow = true
    this.dai.receiveShadow = true
    this.scene.add(this.dai)

    // Target glow
    const targetGlow = new THREE.PointLight(0xffd700, 0.5, 5)
    targetGlow.position.set(0, -1, 0)
    this.scene.add(targetGlow)

    // Create aim arrow
    this.createAimArrow()
  }

  private createAimArrow() {
    this.aimArrow = new THREE.Group()

    const arrowBodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8)
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    const arrowBody = new THREE.Mesh(arrowBodyGeometry, arrowMaterial)
    arrowBody.rotation.x = -Math.PI / 2  // 修正：-Z方向（ターゲット方向）を向くように
    arrowBody.position.z = -1            // 修正：前方に配置
    this.aimArrow.add(arrowBody)

    const arrowHeadGeometry = new THREE.ConeGeometry(0.2, 0.5, 8)
    const arrowHead = new THREE.Mesh(arrowHeadGeometry, arrowMaterial)
    arrowHead.rotation.x = -Math.PI / 2  // 修正：-Z方向を向くように
    arrowHead.position.z = -2.25         // 修正：前方に配置
    this.aimArrow.add(arrowHead)

    this.aimArrow.position.copy(this.launchPosition)
    this.scene.add(this.aimArrow)
  }

  private updateAimArrow() {
    if (!this.aimArrow) return

    const hRad = (this.angleH * Math.PI) / 180
    const vRad = (this.angleV * Math.PI) / 180

    this.aimArrow.rotation.y = -hRad
    this.aimArrow.rotation.x = -vRad
  }

  /**
   * 発射前のプレビュー用メッシュを作成（物理なし、ビジュアルのみ）
   */
  private createPreviewMesh() {
    // 既存のプレビューメッシュがあれば削除
    this.removePreviewMesh()

    let geometry: THREE.BufferGeometry
    let material: THREE.Material

    switch (this.currentType) {
      case 'base':
        geometry = this.createMochiGeometry(1.5, 0.75)
        material = new THREE.MeshStandardMaterial({
          color: 0xfff8e7,
          roughness: 0.9,
          metalness: 0.0,
          transparent: true,
          opacity: 0.85
        })
        break
      case 'top':
        geometry = this.createMochiGeometry(1.1, 0.55)
        material = new THREE.MeshStandardMaterial({
          color: 0xfff8e7,
          roughness: 0.9,
          metalness: 0.0,
          transparent: true,
          opacity: 0.85
        })
        break
      case 'mikan':
      default:
        geometry = new THREE.SphereGeometry(0.5, 32, 24)
        material = new THREE.MeshStandardMaterial({
          color: 0xff8c00,
          roughness: 0.8,
          metalness: 0.0,
          transparent: true,
          opacity: 0.85
        })
        break
    }

    this.previewMesh = new THREE.Mesh(geometry, material)
    this.previewMesh.castShadow = true
    this.previewMesh.position.copy(this.launchPosition)
    this.scene.add(this.previewMesh)
  }

  /**
   * プレビューメッシュを削除
   */
  private removePreviewMesh() {
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh)
      this.previewMesh.geometry.dispose()
      if (this.previewMesh.material instanceof THREE.Material) {
        this.previewMesh.material.dispose()
      }
      this.previewMesh = null
    }
  }

  private buildUI() {
    // 3D UI コンテナを作成（カメラに追従）
    this.uiContainer = new THREE.Group()
    this.scene.add(this.uiContainer)

    // フェーズ表示スプライト
    this.phaseSprite = this.createUITextSprite(this.getPhaseText(), 64, '#FFD700')
    this.phaseSprite.position.set(0, 1.5, 0)
    this.uiContainer.add(this.phaseSprite)

    // 指示テキストスプライト
    this.instructionSprite = this.createUITextSprite('タップで方向を決定！', 48, '#FFFFFF')
    this.instructionSprite.position.set(0, 0.8, 0)
    this.uiContainer.add(this.instructionSprite)
  }

  private createUITextSprite(text: string, fontSize: number, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.width = 1024
    canvas.height = 256

    context.clearRect(0, 0, canvas.width, canvas.height)

    context.font = `bold ${fontSize}px "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif`
    context.fillStyle = color
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    // 縁取り
    context.strokeStyle = '#000000'
    context.lineWidth = 6
    context.strokeText(text, canvas.width / 2, canvas.height / 2)
    context.fillText(text, canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(4, 1, 1)

    return sprite
  }

  private updateUITextSprite(sprite: THREE.Sprite, text: string, fontSize: number, color: string) {
    const material = sprite.material as THREE.SpriteMaterial
    const oldTexture = material.map

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.width = 1024
    canvas.height = 256

    context.clearRect(0, 0, canvas.width, canvas.height)

    context.font = `bold ${fontSize}px "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif`
    context.fillStyle = color
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    context.strokeStyle = '#000000'
    context.lineWidth = 6
    context.strokeText(text, canvas.width / 2, canvas.height / 2)
    context.fillText(text, canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    material.map = texture

    if (oldTexture) {
      oldTexture.dispose()
    }
  }

  private getPhaseText(): string {
    const typeNames = { base: 'ベース餅', top: '上餅', mikan: 'みかん' }
    return `${typeNames[this.currentType]} を発射！`
  }

  private setupEventListeners() {
    window.addEventListener('touchend', this.onConfirmGauge)
    window.addEventListener('click', this.onConfirmGauge)
    window.addEventListener('keydown', this.onKeyDown)
  }

  private removeEventListeners() {
    window.removeEventListener('touchend', this.onConfirmGauge)
    window.removeEventListener('click', this.onConfirmGauge)
    window.removeEventListener('keydown', this.onKeyDown)
  }

  private onConfirmGauge = (e: Event) => {
    e.preventDefault()

    if (this.phase === 'direction') {
      this.confirmDirection()
    } else if (this.phase === 'elevation') {
      this.confirmElevation()
    } else if (this.phase === 'power') {
      this.confirmPowerAndLaunch()
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (this.phase === 'direction') {
        this.confirmDirection()
      } else if (this.phase === 'elevation') {
        this.confirmElevation()
      } else if (this.phase === 'power') {
        this.confirmPowerAndLaunch()
      }
    }
  }

  private confirmDirection() {
    this.angleH = (this.gaugeValue - 50) * 1.2
    this.game.audioManager.playLand()

    // Switch gauges
    if (this.directionGauge) this.directionGauge.group.visible = false
    if (this.elevationGauge) this.elevationGauge.group.visible = true

    this.gaugeValue = 50
    this.gaugeDirection = 1
    this.phase = 'elevation'

    if (this.instructionSprite) {
      this.updateUITextSprite(this.instructionSprite, 'タップで角度を決定！', 48, '#FFFFFF')
    }
  }

  private confirmElevation() {
    this.angleV = 15 + this.gaugeValue * 0.6
    this.game.audioManager.playLand()

    // Switch gauges
    if (this.elevationGauge) this.elevationGauge.group.visible = false
    if (this.powerGauge) this.powerGauge.group.visible = true

    this.gaugeValue = 0
    this.gaugeDirection = 1
    this.phase = 'power'

    if (this.instructionSprite) {
      this.updateUITextSprite(this.instructionSprite, 'タップでパワーを決定！', 48, '#FFFFFF')
    }
  }

  private confirmPowerAndLaunch() {
    this.power = this.gaugeValue
    this.launch()
  }

  private launch() {
    this.phase = 'flying'
    this.flyingStartTime = Date.now() // 飛行開始時間を記録
    this.game.audioManager.playLaunch()

    // プレビューメッシュを削除（発射オブジェクトに置き換え）
    this.removePreviewMesh()

    // Hide all gauges and trajectory
    if (this.gaugeContainer) this.gaugeContainer.visible = false
    if (this.aimArrow) this.aimArrow.visible = false
    if (this.trajectoryLine) this.trajectoryLine.visible = false

    if (this.instructionSprite) {
      this.updateUITextSprite(this.instructionSprite, '飛んでいます...', 48, '#FFFFFF')
    }

    // Create object
    const obj = this.createLaunchObject()
    this.currentObject = obj
    this.launchedObjects.push(obj)

    // Calculate velocity
    const powerMultiplier = 0.12 + (this.power / 100) * 0.15
    const hRad = (this.angleH * Math.PI) / 180
    const vRad = (this.angleV * Math.PI) / 180
    const speed = 8 + powerMultiplier * 20

    const randomX = (Math.random() - 0.5) * 2
    const randomZ = (Math.random() - 0.5) * 1

    obj.body.velocity.set(
      Math.sin(hRad) * speed * Math.cos(vRad) + randomX,
      Math.sin(vRad) * speed,
      -Math.cos(hRad) * speed * Math.cos(vRad) + randomZ
    )

    obj.body.angularVelocity.set(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5
    )

    // 飛行中のカメラ：少しだけ追従
    gsap.to(this.game.camera.position, {
      x: Math.sin(hRad) * 3,
      y: 10,
      z: 18,
      duration: 0.5
    })
    gsap.to(this.game.camera, {
      duration: 0.5,
      onUpdate: () => {
        this.game.camera.lookAt(0, 0, 3)
      }
    })
  }

  /**
   * 鏡餅の断面プロファイルを計算（視覚・物理で共通使用）
   */
  private getMochiProfile(radius: number, height: number, segments: number = 8): { r: number; y: number }[] {
    const points: { r: number; y: number }[] = []
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

  /**
   * お餅らしい形状を作成（下が広く上が丸い鏡餅型）- 視覚用
   */
  private createMochiGeometry(radius: number, height: number): THREE.BufferGeometry {
    const profile = this.getMochiProfile(radius, height, 16)
    const points = profile.map(p => new THREE.Vector2(p.r, p.y))
    // 上面を閉じる
    points.push(new THREE.Vector2(0, height / 2))
    return new THREE.LatheGeometry(points, 32)
  }

  /**
   * お餅の物理形状を作成（視覚と一致するConvexPolyhedron）
   */
  private createMochiPhysicsShape(radius: number, height: number): CANNON.Shape {
    const profile = this.getMochiProfile(radius, height, 6) // 物理用は軽量化
    const radialSegments = 12

    const vertices: CANNON.Vec3[] = []
    const faces: number[][] = []

    // 回転体の頂点を生成
    for (let i = 0; i < profile.length; i++) {
      const { r, y } = profile[i]
      for (let j = 0; j < radialSegments; j++) {
        const angle = (j / radialSegments) * Math.PI * 2
        vertices.push(new CANNON.Vec3(
          r * Math.cos(angle),
          y,
          r * Math.sin(angle)
        ))
      }
    }

    // 上端の中心点を追加
    const topCenterIndex = vertices.length
    vertices.push(new CANNON.Vec3(0, height / 2, 0))

    // 底面の中心点を追加
    const bottomCenterIndex = vertices.length
    vertices.push(new CANNON.Vec3(0, -height / 2, 0))

    // 側面の面を生成
    for (let i = 0; i < profile.length - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const curr = i * radialSegments + j
        const next = i * radialSegments + ((j + 1) % radialSegments)
        const currUp = (i + 1) * radialSegments + j
        const nextUp = (i + 1) * radialSegments + ((j + 1) % radialSegments)

        // 2つの三角形で四角形を構成
        faces.push([curr, next, nextUp])
        faces.push([curr, nextUp, currUp])
      }
    }

    // 上面（最後のリングから中心点へ）
    const topRing = (profile.length - 1) * radialSegments
    for (let j = 0; j < radialSegments; j++) {
      const curr = topRing + j
      const next = topRing + ((j + 1) % radialSegments)
      faces.push([curr, topCenterIndex, next])
    }

    // 底面
    for (let j = 0; j < radialSegments; j++) {
      const curr = j
      const next = (j + 1) % radialSegments
      faces.push([next, bottomCenterIndex, curr])
    }

    return new CANNON.ConvexPolyhedron({ vertices, faces })
  }

  private createLaunchObject(): LaunchedObject {
    let geometry: THREE.BufferGeometry
    let material: THREE.Material
    let shape: CANNON.Shape
    let mass: number

    switch (this.currentType) {
      case 'base':
        // お餅らしい形状：下が広く上が丸い鏡餅型
        geometry = this.createMochiGeometry(1.5, 0.75)
        material = new THREE.MeshStandardMaterial({
          color: 0xfff8e7,
          roughness: 0.9,
          metalness: 0.0
        })
        // 視覚と一致するConvexPolyhedron
        shape = this.createMochiPhysicsShape(1.5, 0.75)
        mass = 3
        break
      case 'top':
        // 上餅も同様に鏡餅型
        geometry = this.createMochiGeometry(1.1, 0.55)
        material = new THREE.MeshStandardMaterial({
          color: 0xfff8e7,
          roughness: 0.9,
          metalness: 0.0
        })
        // 視覚と一致するConvexPolyhedron
        shape = this.createMochiPhysicsShape(1.1, 0.55)
        mass = 2
        break
      case 'mikan':
      default:
        geometry = new THREE.SphereGeometry(0.5, 32, 24)
        material = new THREE.MeshStandardMaterial({
          color: 0xff8c00,
          roughness: 0.8,
          metalness: 0.0
        })
        shape = new CANNON.Sphere(0.5)
        mass = 0.5
        break
    }

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.position.copy(this.launchPosition)
    this.scene.add(mesh)

    const body = new CANNON.Body({
      mass,
      material: this.mochiMaterial!,
      linearDamping: 0.4,    // 空気抵抗で減速
      angularDamping: 0.6    // 回転も減衰
    })
    body.addShape(shape)
    body.position.set(this.launchPosition.x, this.launchPosition.y, this.launchPosition.z)
    this.world!.addBody(body)

    return { mesh, body, type: this.currentType }
  }

  private onObjectLanded() {
    this.phase = 'landed'
    this.game.audioManager.playLand()

    if (this.instructionSprite) {
      this.updateUITextSprite(this.instructionSprite, '着地！', 48, '#00FF00')
    }

    setTimeout(() => {
      this.proceedToNextObject()
    }, 1500)
  }

  private proceedToNextObject() {
    if (this.currentType === 'base') {
      this.currentType = 'top'
    } else if (this.currentType === 'top') {
      this.currentType = 'mikan'
    } else {
      this.phase = 'complete'
      this.calculateAndShowResult()
      return
    }

    // Reset for next launch
    this.phase = 'direction'
    this.angleH = 0
    this.angleV = 45
    this.power = 50
    this.gaugeValue = 50
    this.gaugeDirection = 1

    // Show gauges and trajectory again
    if (this.gaugeContainer) this.gaugeContainer.visible = true
    if (this.trajectoryLine) this.trajectoryLine.visible = true
    if (this.directionGauge) this.directionGauge.group.visible = true
    if (this.elevationGauge) this.elevationGauge.group.visible = false
    if (this.powerGauge) {
      this.powerGauge.group.visible = false
      // Reset power fill
      if (this.powerGauge.fill) {
        this.powerGauge.fill.scale.y = 1
        this.powerGauge.fill.position.y = -2
      }
    }

    if (this.aimArrow) {
      this.aimArrow.visible = true
      this.aimArrow.rotation.set(0, 0, 0)
    }
    if (this.phaseSprite) {
      this.updateUITextSprite(this.phaseSprite, this.getPhaseText(), 64, '#FFD700')
    }
    if (this.instructionSprite) {
      this.updateUITextSprite(this.instructionSprite, 'タップで方向を決定！', 48, '#FFFFFF')
    }

    // Reset camera to good viewing position (setupCamera()と同じ)
    gsap.to(this.game.camera.position, {
      x: 0,
      y: 12,
      z: 22,
      duration: 0.5
    })
    gsap.to(this.game.camera, {
      duration: 0.5,
      onUpdate: () => {
        this.game.camera.lookAt(0, 0, 5)
      }
    })

    // 次の発射オブジェクトのプレビューを表示
    this.createPreviewMesh()
  }

  private calculateAndShowResult() {
    const score = this.calculateScore()
    this.game.sceneManager.switchTo('result', { score })
  }

  private calculateScore(): number {
    const positions = this.launchedObjects.map(obj => ({
      type: obj.type,
      x: obj.body.position.x,
      y: obj.body.position.y,
      z: obj.body.position.z
    }))

    const base = positions.find(p => p.type === 'base')
    const top = positions.find(p => p.type === 'top')
    const mikan = positions.find(p => p.type === 'mikan')

    if (!base || !top || !mikan) return 0

    let score = 0

    const baseDistFromCenter = Math.sqrt(base.x ** 2 + base.z ** 2)
    if (baseDistFromCenter < 1.5 && base.y > -2 && base.y < 0) {
      score += 30
    } else if (baseDistFromCenter < 3) {
      score += 15
    }

    const topOnBase = Math.sqrt((top.x - base.x) ** 2 + (top.z - base.z) ** 2) < 1.2
    const topAboveBase = top.y > base.y && top.y < base.y + 2
    if (topOnBase && topAboveBase) {
      score += 35
    } else if (Math.sqrt((top.x - base.x) ** 2 + (top.z - base.z) ** 2) < 2) {
      score += 15
    }

    const mikanOnTop = Math.sqrt((mikan.x - top.x) ** 2 + (mikan.z - top.z) ** 2) < 0.8
    const mikanAboveTop = mikan.y > top.y && mikan.y < top.y + 1.5
    if (mikanOnTop && mikanAboveTop) {
      score += 35
    } else if (Math.sqrt((mikan.x - top.x) ** 2 + (mikan.z - top.z) ** 2) < 1.5) {
      score += 15
    }

    return Math.min(100, score)
  }
}
