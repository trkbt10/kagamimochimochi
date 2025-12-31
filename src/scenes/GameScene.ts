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

  // UI elements
  private phaseIndicator: HTMLElement | null = null
  private directionGauge: HTMLElement | null = null
  private directionGaugeFill: HTMLElement | null = null
  private elevationGauge: HTMLElement | null = null
  private elevationGaugeFill: HTMLElement | null = null
  private powerGauge: HTMLElement | null = null
  private powerGaugeFill: HTMLElement | null = null
  private instruction: HTMLElement | null = null
  private gaugeLabel: HTMLElement | null = null

  constructor(game: Game) {
    super(game)
  }

  async enter() {
    this.resetState()
    this.setupPhysics()
    this.setupScene()
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
      this.updateCurrentGauge()
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

  private updateCurrentGauge() {
    if (this.phase === 'direction' && this.directionGaugeFill) {
      this.directionGaugeFill.style.left = `${this.gaugeValue}%`
      // Preview the angle in real-time
      this.angleH = (this.gaugeValue - 50) * 1.2 // -60 to 60
    } else if (this.phase === 'elevation' && this.elevationGaugeFill) {
      this.elevationGaugeFill.style.bottom = `${this.gaugeValue}%`
      // Preview the angle in real-time
      this.angleV = 15 + this.gaugeValue * 0.6 // 15 to 75
    } else if (this.phase === 'power' && this.powerGaugeFill) {
      this.powerGaugeFill.style.height = `${this.gaugeValue}%`
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
    this.world.gravity.set(0, -15, 0) // Slightly stronger gravity for "heavier" feel
    this.world.broadphase = new CANNON.NaiveBroadphase()

    // Ground
    const groundShape = new CANNON.Plane()
    this.groundBody = new CANNON.Body({ mass: 0, material: new CANNON.Material() })
    this.groundBody.addShape(groundShape)
    this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
    this.groundBody.position.set(0, -2, 0)
    this.world.addBody(this.groundBody)

    // Dai (platform for kagamimochi)
    const daiShape = new CANNON.Cylinder(1.8, 2, 0.5, 16)
    this.daiBody = new CANNON.Body({ mass: 0, material: new CANNON.Material() })
    this.daiBody.addShape(daiShape)
    this.daiBody.position.set(0, -1.75, 0)
    this.world.addBody(this.daiBody)

    // Add contact material for bounciness
    const mochiMaterial = new CANNON.Material('mochi')
    const groundMaterial = new CANNON.Material('ground')

    const contactMaterial = new CANNON.ContactMaterial(mochiMaterial, groundMaterial, {
      friction: 0.8,
      restitution: 0.3 // Some bounce
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

    // Target indicator (subtle glow on dai)
    const targetGlow = new THREE.PointLight(0xffd700, 0.5, 5)
    targetGlow.position.set(0, -1, 0)
    this.scene.add(targetGlow)

    // Create aim arrow
    this.createAimArrow()

    // Position camera for mobile-friendly view
    this.game.camera.position.set(0, 6, 15)
    this.game.camera.lookAt(0, 0, 0)
  }

  private createAimArrow() {
    this.aimArrow = new THREE.Group()

    // Arrow body
    const arrowBodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8)
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    const arrowBody = new THREE.Mesh(arrowBodyGeometry, arrowMaterial)
    arrowBody.rotation.x = Math.PI / 2
    arrowBody.position.z = 1
    this.aimArrow.add(arrowBody)

    // Arrow head
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

    // Point arrow in launch direction
    this.aimArrow.rotation.y = -hRad
    this.aimArrow.rotation.x = -vRad
  }

  private buildUI() {
    this.ui = this.createUI(`
      <div class="game-ui active">
        <div class="phase-indicator">
          <span id="phaseText">${this.getPhaseText()}</span>
        </div>

        <!-- Golf-style gauges -->
        <div class="golf-gauge-container">
          <!-- Direction gauge (horizontal) -->
          <div class="golf-gauge direction-gauge" id="directionGauge">
            <div class="gauge-label">◀ 方向 ▶</div>
            <div class="gauge-track horizontal">
              <div class="gauge-center-mark"></div>
              <div class="gauge-fill-indicator" id="directionGaugeFill"></div>
            </div>
          </div>

          <!-- Elevation gauge (vertical) -->
          <div class="golf-gauge elevation-gauge" id="elevationGauge" style="display: none;">
            <div class="gauge-label">角度 ▲</div>
            <div class="gauge-track vertical">
              <div class="gauge-center-mark"></div>
              <div class="gauge-fill-indicator" id="elevationGaugeFill"></div>
            </div>
          </div>

          <!-- Power gauge (vertical) -->
          <div class="golf-gauge power-gauge" id="powerGauge" style="display: none;">
            <div class="gauge-label">パワー</div>
            <div class="gauge-track vertical power">
              <div class="gauge-fill-bar" id="powerGaugeFill"></div>
            </div>
          </div>
        </div>

        <div class="gauge-value-display" id="gaugeLabel"></div>

        <div class="instruction">
          <span id="instructionText">タップで方向を決定！</span>
        </div>
      </div>
    `)

    this.phaseIndicator = this.ui!.querySelector('#phaseText')
    this.directionGauge = this.ui!.querySelector('#directionGauge')
    this.directionGaugeFill = this.ui!.querySelector('#directionGaugeFill')
    this.elevationGauge = this.ui!.querySelector('#elevationGauge')
    this.elevationGaugeFill = this.ui!.querySelector('#elevationGaugeFill')
    this.powerGauge = this.ui!.querySelector('#powerGauge')
    this.powerGaugeFill = this.ui!.querySelector('#powerGaugeFill')
    this.instruction = this.ui!.querySelector('#instructionText')
    this.gaugeLabel = this.ui!.querySelector('#gaugeLabel')
  }

  private getPhaseText(): string {
    const typeNames = { base: 'ベース餅', top: '上餅', mikan: 'みかん' }
    return `${typeNames[this.currentType]} を発射！`
  }

  private setupEventListeners() {
    // Touch/Click to confirm gauge
    window.addEventListener('touchend', this.onConfirmGauge)
    window.addEventListener('click', this.onConfirmGauge)

    // Keyboard for desktop
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
    // Lock in the horizontal angle
    this.angleH = (this.gaugeValue - 50) * 1.2 // -60 to 60
    this.game.audioManager.playLand() // Confirmation sound

    // Hide direction gauge, show elevation gauge
    if (this.directionGauge) this.directionGauge.style.display = 'none'
    if (this.elevationGauge) this.elevationGauge.style.display = 'flex'

    // Reset gauge for next phase
    this.gaugeValue = 50
    this.gaugeDirection = 1
    this.phase = 'elevation'

    if (this.instruction) {
      this.instruction.textContent = 'タップで角度を決定！'
    }
    if (this.gaugeLabel) {
      this.gaugeLabel.textContent = `方向: ${Math.round(this.angleH)}°`
    }
  }

  private confirmElevation() {
    // Lock in the vertical angle
    this.angleV = 15 + this.gaugeValue * 0.6 // 15 to 75
    this.game.audioManager.playLand() // Confirmation sound

    // Hide elevation gauge, show power gauge
    if (this.elevationGauge) this.elevationGauge.style.display = 'none'
    if (this.powerGauge) this.powerGauge.style.display = 'flex'

    // Reset gauge for next phase
    this.gaugeValue = 0
    this.gaugeDirection = 1
    this.phase = 'power'

    if (this.instruction) {
      this.instruction.textContent = 'タップでパワーを決定！'
    }
    if (this.gaugeLabel) {
      this.gaugeLabel.textContent = `方向: ${Math.round(this.angleH)}° / 角度: ${Math.round(this.angleV)}°`
    }
  }

  private confirmPowerAndLaunch() {
    // Lock in the power
    this.power = this.gaugeValue
    this.launch()
  }

  private launch() {
    this.phase = 'flying'
    this.game.audioManager.playLaunch()

    // Hide all gauges
    if (this.directionGauge) this.directionGauge.style.display = 'none'
    if (this.elevationGauge) this.elevationGauge.style.display = 'none'
    if (this.powerGauge) this.powerGauge.style.display = 'none'

    if (this.instruction) {
      this.instruction.textContent = '飛んでいます...'
    }
    if (this.gaugeLabel) {
      this.gaugeLabel.textContent = `パワー: ${Math.round(this.power)}%`
    }
    if (this.aimArrow) {
      this.aimArrow.visible = false
    }

    // Create the object to launch
    const obj = this.createLaunchObject()
    this.currentObject = obj
    this.launchedObjects.push(obj)

    // Calculate launch velocity
    // Make it very difficult - small power window for success
    const powerMultiplier = 0.12 + (this.power / 100) * 0.15 // Very narrow range
    const hRad = (this.angleH * Math.PI) / 180
    const vRad = (this.angleV * Math.PI) / 180

    const speed = 8 + powerMultiplier * 20

    // Add some randomness to make it more chaotic (クソゲー factor)
    const randomX = (Math.random() - 0.5) * 2
    const randomZ = (Math.random() - 0.5) * 1

    obj.body.velocity.set(
      Math.sin(hRad) * speed * Math.cos(vRad) + randomX,
      Math.sin(vRad) * speed,
      -Math.cos(hRad) * speed * Math.cos(vRad) + randomZ
    )

    // Add random spin (even more クソゲー)
    obj.body.angularVelocity.set(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5
    )

    // Animate camera to follow
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

    // Wait a moment then proceed
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
      // All objects launched, calculate score
      this.phase = 'complete'
      this.calculateAndShowResult()
      return
    }

    // Reset for next launch - start with direction phase
    this.phase = 'direction'
    this.angleH = 0
    this.angleV = 45
    this.power = 50
    this.gaugeValue = 50
    this.gaugeDirection = 1

    // Show direction gauge, hide others
    if (this.directionGauge) this.directionGauge.style.display = 'flex'
    if (this.elevationGauge) this.elevationGauge.style.display = 'none'
    if (this.powerGauge) this.powerGauge.style.display = 'none'

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
    if (this.gaugeLabel) {
      this.gaugeLabel.textContent = ''
    }

    // Reset camera
    gsap.to(this.game.camera.position, {
      x: 0,
      y: 6,
      z: 15,
      duration: 0.5
    })
  }

  private calculateAndShowResult() {
    const score = this.calculateScore()

    // Transition to result scene
    this.game.sceneManager.switchTo('result', { score })
  }

  private calculateScore(): number {
    // Find positions of all objects
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

    // Check if base is on dai (center)
    const baseDistFromCenter = Math.sqrt(base.x ** 2 + base.z ** 2)
    if (baseDistFromCenter < 1.5 && base.y > -2 && base.y < 0) {
      score += 30
    } else if (baseDistFromCenter < 3) {
      score += 15
    }

    // Check if top is on base
    const topOnBase = Math.sqrt((top.x - base.x) ** 2 + (top.z - base.z) ** 2) < 1.2
    const topAboveBase = top.y > base.y && top.y < base.y + 2
    if (topOnBase && topAboveBase) {
      score += 35
    } else if (Math.sqrt((top.x - base.x) ** 2 + (top.z - base.z) ** 2) < 2) {
      score += 15
    }

    // Check if mikan is on top
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
