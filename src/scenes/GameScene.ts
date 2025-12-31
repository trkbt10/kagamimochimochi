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

  // HTML UI elements (minimal - only text)
  private phaseIndicator: HTMLElement | null = null
  private instruction: HTMLElement | null = null

  constructor(game: Game) {
    super(game)
  }

  async enter() {
    this.resetState()
    this.setupPhysics()
    this.setupScene()
    this.create3DGauges()
    this.buildUI()
    this.setupEventListeners()
    this.game.audioManager.playBgm()
  }

  async exit() {
    this.game.audioManager.stopBgm()
    this.removeUI()
    this.removeEventListeners()
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
    }

    // Check if object has landed
    if (this.phase === 'flying' && this.currentObject) {
      const velocity = this.currentObject.body.velocity
      const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)

      if (speed < 0.1 && this.currentObject.body.position.y < 5) {
        this.onObjectLanded()
      }
    }
  }

  private create3DGauges() {
    this.gaugeContainer = new THREE.Group()
    this.gaugeContainer.position.set(0, 3, 12)
    this.scene.add(this.gaugeContainer)

    // Create direction gauge (horizontal)
    this.directionGauge = this.createHorizontalGauge()
    this.directionGauge.group.position.set(0, 0.5, 0)
    this.gaugeContainer.add(this.directionGauge.group)

    // Create elevation gauge (vertical)
    this.elevationGauge = this.createVerticalGauge()
    this.elevationGauge.group.position.set(0, 0.5, 0)
    this.elevationGauge.group.visible = false
    this.gaugeContainer.add(this.elevationGauge.group)

    // Create power gauge (vertical with fill)
    this.powerGauge = this.createPowerGauge()
    this.powerGauge.group.position.set(0, 0.5, 0)
    this.powerGauge.group.visible = false
    this.gaugeContainer.add(this.powerGauge.group)
  }

  private createHorizontalGauge(): GaugeGroup {
    const group = new THREE.Group()

    // Track (background bar)
    const trackGeometry = new THREE.BoxGeometry(6, 0.3, 0.2)
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8
    })
    const track = new THREE.Mesh(trackGeometry, trackMaterial)
    group.add(track)

    // Track border (glow effect)
    const borderGeometry = new THREE.BoxGeometry(6.1, 0.4, 0.1)
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5
    })
    const border = new THREE.Mesh(borderGeometry, borderMaterial)
    border.position.z = -0.1
    group.add(border)

    // Center mark
    const centerMarkGeometry = new THREE.BoxGeometry(0.1, 0.6, 0.25)
    const centerMarkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 })
    const centerMark = new THREE.Mesh(centerMarkGeometry, centerMarkMaterial)
    centerMark.position.z = 0.05
    group.add(centerMark)

    // Indicator (moving marker)
    const indicatorGeometry = new THREE.BoxGeometry(0.15, 0.5, 0.3)
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial)
    indicator.position.z = 0.1

    // Add glow to indicator
    const glowGeometry = new THREE.BoxGeometry(0.25, 0.6, 0.05)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.6
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    glow.position.z = 0.2
    indicator.add(glow)

    group.add(indicator)

    // Add label text using sprite
    const labelSprite = this.createTextSprite('◀ 方向 ▶', 0.4)
    labelSprite.position.set(0, 0.5, 0)
    group.add(labelSprite)

    return { group, track, indicator, centerMark }
  }

  private createVerticalGauge(): GaugeGroup {
    const group = new THREE.Group()

    // Track (background bar)
    const trackGeometry = new THREE.BoxGeometry(0.3, 4, 0.2)
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8
    })
    const track = new THREE.Mesh(trackGeometry, trackMaterial)
    group.add(track)

    // Track border
    const borderGeometry = new THREE.BoxGeometry(0.4, 4.1, 0.1)
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5
    })
    const border = new THREE.Mesh(borderGeometry, borderMaterial)
    border.position.z = -0.1
    group.add(border)

    // Center mark
    const centerMarkGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.25)
    const centerMarkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 })
    const centerMark = new THREE.Mesh(centerMarkGeometry, centerMarkMaterial)
    centerMark.position.z = 0.05
    group.add(centerMark)

    // Indicator (moving marker)
    const indicatorGeometry = new THREE.BoxGeometry(0.5, 0.15, 0.3)
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial)
    indicator.position.z = 0.1

    // Add glow
    const glowGeometry = new THREE.BoxGeometry(0.6, 0.25, 0.05)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.6
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    glow.position.z = 0.2
    indicator.add(glow)

    group.add(indicator)

    // Add label
    const labelSprite = this.createTextSprite('角度 ▲', 0.4)
    labelSprite.position.set(0, 2.5, 0)
    group.add(labelSprite)

    return { group, track, indicator, centerMark }
  }

  private createPowerGauge(): GaugeGroup {
    const group = new THREE.Group()

    // Track (background with gradient effect using segments)
    const trackGeometry = new THREE.BoxGeometry(0.5, 4, 0.2)
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.8
    })
    const track = new THREE.Mesh(trackGeometry, trackMaterial)
    group.add(track)

    // Track border
    const borderGeometry = new THREE.BoxGeometry(0.6, 4.1, 0.1)
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5
    })
    const border = new THREE.Mesh(borderGeometry, borderMaterial)
    border.position.z = -0.1
    group.add(border)

    // Gradient segments for power visualization
    const segments = 20
    const segmentHeight = 4 / segments
    for (let i = 0; i < segments; i++) {
      const t = i / segments
      const segGeometry = new THREE.BoxGeometry(0.4, segmentHeight * 0.9, 0.15)

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
        opacity: 0.3
      })
      const segment = new THREE.Mesh(segGeometry, segMaterial)
      segment.position.y = -2 + segmentHeight * 0.5 + i * segmentHeight
      segment.position.z = 0.05
      group.add(segment)
    }

    // Fill bar (dynamic height)
    const fillGeometry = new THREE.BoxGeometry(0.4, 0.01, 0.2)
    const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    const fill = new THREE.Mesh(fillGeometry, fillMaterial)
    fill.position.y = -2
    fill.position.z = 0.1
    group.add(fill)

    // Dummy indicator and centerMark for interface
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01))
    indicator.visible = false
    group.add(indicator)

    const centerMark = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01))
    centerMark.visible = false
    group.add(centerMark)

    // Add label
    const labelSprite = this.createTextSprite('パワー', 0.4)
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
      // Preview angle
      this.angleH = (this.gaugeValue - 50) * 1.2

    } else if (this.phase === 'elevation' && this.elevationGauge) {
      // Move indicator along vertical track (-2 to 2)
      const y = (this.gaugeValue / 100) * 4 - 2
      this.elevationGauge.indicator.position.y = y
      // Preview angle
      this.angleV = 15 + this.gaugeValue * 0.6

    } else if (this.phase === 'power' && this.powerGauge && this.powerGauge.fill) {
      // Scale fill bar height
      const height = (this.gaugeValue / 100) * 4
      this.powerGauge.fill.scale.y = Math.max(height * 100, 1)
      this.powerGauge.fill.position.y = -2 + height / 2

      // Update fill color based on power
      const t = this.gaugeValue / 100
      const color = new THREE.Color()
      if (t < 0.5) {
        color.setHSL(0.33 - t * 0.33, 1, 0.5)
      } else {
        color.setHSL(0.17 - (t - 0.5) * 0.34, 1, 0.5)
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
    this.world.gravity.set(0, -15, 0)
    this.world.broadphase = new CANNON.NaiveBroadphase()

    // Ground
    const groundShape = new CANNON.Plane()
    this.groundBody = new CANNON.Body({ mass: 0, material: new CANNON.Material() })
    this.groundBody.addShape(groundShape)
    this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
    this.groundBody.position.set(0, -2, 0)
    this.world.addBody(this.groundBody)

    // Dai (platform)
    const daiShape = new CANNON.Cylinder(1.8, 2, 0.5, 16)
    this.daiBody = new CANNON.Body({ mass: 0, material: new CANNON.Material() })
    this.daiBody.addShape(daiShape)
    this.daiBody.position.set(0, -1.75, 0)
    this.world.addBody(this.daiBody)

    // Contact material
    const mochiMaterial = new CANNON.Material('mochi')
    const groundMaterial = new CANNON.Material('ground')
    const contactMaterial = new CANNON.ContactMaterial(mochiMaterial, groundMaterial, {
      friction: 0.8,
      restitution: 0.3
    })
    this.world.addContactMaterial(contactMaterial)
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

    // Position camera
    this.game.camera.position.set(0, 6, 15)
    this.game.camera.lookAt(0, 0, 0)
  }

  private createAimArrow() {
    this.aimArrow = new THREE.Group()

    const arrowBodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8)
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    const arrowBody = new THREE.Mesh(arrowBodyGeometry, arrowMaterial)
    arrowBody.rotation.x = Math.PI / 2
    arrowBody.position.z = 1
    this.aimArrow.add(arrowBody)

    const arrowHeadGeometry = new THREE.ConeGeometry(0.2, 0.5, 8)
    const arrowHead = new THREE.Mesh(arrowHeadGeometry, arrowMaterial)
    arrowHead.rotation.x = Math.PI / 2
    arrowHead.position.z = 2.25
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

  private buildUI() {
    this.ui = this.createUI(`
      <div class="game-ui active">
        <div class="phase-indicator">
          <span id="phaseText">${this.getPhaseText()}</span>
        </div>
        <div class="instruction">
          <span id="instructionText">タップで方向を決定！</span>
        </div>
      </div>
    `)

    this.phaseIndicator = this.ui!.querySelector('#phaseText')
    this.instruction = this.ui!.querySelector('#instructionText')
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

    if (this.instruction) {
      this.instruction.textContent = 'タップで角度を決定！'
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

    if (this.instruction) {
      this.instruction.textContent = 'タップでパワーを決定！'
    }
  }

  private confirmPowerAndLaunch() {
    this.power = this.gaugeValue
    this.launch()
  }

  private launch() {
    this.phase = 'flying'
    this.game.audioManager.playLaunch()

    // Hide all gauges
    if (this.gaugeContainer) this.gaugeContainer.visible = false
    if (this.aimArrow) this.aimArrow.visible = false

    if (this.instruction) {
      this.instruction.textContent = '飛んでいます...'
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

    gsap.to(this.game.camera.position, {
      x: Math.sin(hRad) * 5,
      z: 12 - Math.cos(hRad) * 3,
      duration: 0.5
    })
  }

  private createLaunchObject(): LaunchedObject {
    let geometry: THREE.BufferGeometry
    let material: THREE.Material
    let shape: CANNON.Shape
    let mass: number

    switch (this.currentType) {
      case 'base':
        geometry = new THREE.SphereGeometry(1.5, 32, 24)
        geometry.scale(1, 0.5, 1)
        material = new THREE.MeshStandardMaterial({
          color: 0xfff8e7,
          roughness: 0.9,
          metalness: 0.0
        })
        shape = new CANNON.Sphere(1.2)
        mass = 3
        break
      case 'top':
        geometry = new THREE.SphereGeometry(1.1, 32, 24)
        geometry.scale(1, 0.5, 1)
        material = new THREE.MeshStandardMaterial({
          color: 0xfff8e7,
          roughness: 0.9,
          metalness: 0.0
        })
        shape = new CANNON.Sphere(0.9)
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

    const body = new CANNON.Body({ mass })
    body.addShape(shape)
    body.position.set(this.launchPosition.x, this.launchPosition.y, this.launchPosition.z)
    this.world!.addBody(body)

    return { mesh, body, type: this.currentType }
  }

  private onObjectLanded() {
    this.phase = 'landed'
    this.game.audioManager.playLand()

    if (this.instruction) {
      this.instruction.textContent = '着地！'
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

    // Show gauges again
    if (this.gaugeContainer) this.gaugeContainer.visible = true
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
    if (this.phaseIndicator) {
      this.phaseIndicator.textContent = this.getPhaseText()
    }
    if (this.instruction) {
      this.instruction.textContent = 'タップで方向を決定！'
    }

    gsap.to(this.game.camera.position, {
      x: 0,
      y: 6,
      z: 15,
      duration: 0.5
    })
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
