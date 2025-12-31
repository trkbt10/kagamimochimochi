import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'

type GamePhase = 'aiming' | 'power' | 'flying' | 'landed' | 'complete'
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

  private phase: GamePhase = 'aiming'
  private angleH = 0 // Horizontal angle
  private angleV = 45 // Vertical angle (degrees)
  private power = 50
  private powerDirection = 1
  private powerSpeed = 100 // Speed of power meter

  private aimArrow: THREE.Group | null = null
  private launchPosition = new THREE.Vector3(0, 0, 10)

  private dai: THREE.Mesh | null = null

  // UI elements
  private phaseIndicator: HTMLElement | null = null
  private powerMeter: HTMLElement | null = null
  private powerMeterFill: HTMLElement | null = null
  private angleIndicator: HTMLElement | null = null
  private instruction: HTMLElement | null = null

  private isTouching = false
  private touchStartX = 0
  private touchStartY = 0

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

    // Update aim arrow
    if (this.aimArrow && this.phase === 'aiming') {
      this.updateAimArrow()
    }

    // Update power meter
    if (this.phase === 'power') {
      this.power += this.powerDirection * this.powerSpeed * delta
      if (this.power >= 100) {
        this.power = 100
        this.powerDirection = -1
      } else if (this.power <= 0) {
        this.power = 0
        this.powerDirection = 1
      }
      if (this.powerMeterFill) {
        this.powerMeterFill.style.width = `${this.power}%`
      }
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

  private resetState() {
    this.launchedObjects = []
    this.currentObject = null
    this.currentType = 'base'
    this.phase = 'aiming'
    this.angleH = 0
    this.angleV = 45
    this.power = 50
    this.powerDirection = 1
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
        <div class="angle-indicator">
          <span id="angleText">角度: H ${this.angleH}° / V ${this.angleV}°</span>
        </div>
        <div class="power-meter" style="display: none;">
          <div class="power-meter-fill"></div>
        </div>
        <div class="instruction">
          <span id="instructionText">スワイプで角度調整 / タップで確定</span>
        </div>
      </div>
    `)

    this.phaseIndicator = this.ui!.querySelector('#phaseText')
    this.powerMeter = this.ui!.querySelector('.power-meter')
    this.powerMeterFill = this.ui!.querySelector('.power-meter-fill')
    this.angleIndicator = this.ui!.querySelector('#angleText')
    this.instruction = this.ui!.querySelector('#instructionText')
  }

  private getPhaseText(): string {
    const typeNames = { base: 'ベース餅', top: '上餅', mikan: 'みかん' }
    return `${typeNames[this.currentType]} を発射！`
  }

  private setupEventListeners() {
    // Touch events
    window.addEventListener('touchstart', this.onTouchStart)
    window.addEventListener('touchmove', this.onTouchMove)
    window.addEventListener('touchend', this.onTouchEnd)

    // Mouse events for desktop
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)

    // Keyboard for desktop
    window.addEventListener('keydown', this.onKeyDown)
  }

  private removeEventListeners() {
    window.removeEventListener('touchstart', this.onTouchStart)
    window.removeEventListener('touchmove', this.onTouchMove)
    window.removeEventListener('touchend', this.onTouchEnd)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('keydown', this.onKeyDown)
  }

  private onTouchStart = (e: TouchEvent) => {
    if (this.phase !== 'aiming') return
    this.isTouching = true
    this.touchStartX = e.touches[0].clientX
    this.touchStartY = e.touches[0].clientY
  }

  private onTouchMove = (e: TouchEvent) => {
    if (!this.isTouching || this.phase !== 'aiming') return
    e.preventDefault()

    const deltaX = e.touches[0].clientX - this.touchStartX
    const deltaY = e.touches[0].clientY - this.touchStartY

    // Adjust angles based on swipe
    this.angleH = Math.max(-60, Math.min(60, this.angleH + deltaX * 0.3))
    this.angleV = Math.max(15, Math.min(75, this.angleV - deltaY * 0.3))

    this.touchStartX = e.touches[0].clientX
    this.touchStartY = e.touches[0].clientY

    this.updateAngleUI()
  }

  private onTouchEnd = () => {
    if (this.isTouching && this.phase === 'aiming') {
      this.startPowerPhase()
    }
    this.isTouching = false
  }

  private onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'aiming') return
    this.isTouching = true
    this.touchStartX = e.clientX
    this.touchStartY = e.clientY
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isTouching || this.phase !== 'aiming') return

    const deltaX = e.clientX - this.touchStartX
    const deltaY = e.clientY - this.touchStartY

    this.angleH = Math.max(-60, Math.min(60, this.angleH + deltaX * 0.3))
    this.angleV = Math.max(15, Math.min(75, this.angleV - deltaY * 0.3))

    this.touchStartX = e.clientX
    this.touchStartY = e.clientY

    this.updateAngleUI()
  }

  private onMouseUp = () => {
    if (this.isTouching && this.phase === 'aiming') {
      this.startPowerPhase()
    }
    this.isTouching = false
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.phase === 'aiming') {
      switch (e.key) {
        case 'ArrowLeft':
          this.angleH = Math.max(-60, this.angleH - 5)
          this.updateAngleUI()
          break
        case 'ArrowRight':
          this.angleH = Math.min(60, this.angleH + 5)
          this.updateAngleUI()
          break
        case 'ArrowUp':
          this.angleV = Math.min(75, this.angleV + 5)
          this.updateAngleUI()
          break
        case 'ArrowDown':
          this.angleV = Math.max(15, this.angleV - 5)
          this.updateAngleUI()
          break
        case ' ':
        case 'Enter':
          this.startPowerPhase()
          break
      }
    } else if (this.phase === 'power') {
      if (e.key === ' ' || e.key === 'Enter') {
        this.launch()
      }
    }
  }

  private updateAngleUI() {
    if (this.angleIndicator) {
      this.angleIndicator.textContent = `角度: H ${Math.round(this.angleH)}° / V ${Math.round(this.angleV)}°`
    }
  }

  private startPowerPhase() {
    this.phase = 'power'
    this.power = 0
    this.powerDirection = 1

    if (this.powerMeter) {
      this.powerMeter.style.display = 'block'
    }
    if (this.instruction) {
      this.instruction.textContent = 'タップでパワー決定！'
    }
    if (this.aimArrow) {
      this.aimArrow.visible = false
    }

    // Setup click/touch to launch
    const launchHandler = () => {
      if (this.phase === 'power') {
        this.launch()
        window.removeEventListener('click', launchHandler)
        window.removeEventListener('touchend', touchLaunchHandler)
      }
    }
    const touchLaunchHandler = (e: TouchEvent) => {
      e.preventDefault()
      if (this.phase === 'power') {
        this.launch()
        window.removeEventListener('click', launchHandler)
        window.removeEventListener('touchend', touchLaunchHandler)
      }
    }

    // Small delay to prevent immediate launch
    setTimeout(() => {
      window.addEventListener('click', launchHandler)
      window.addEventListener('touchend', touchLaunchHandler)
    }, 100)
  }

  private launch() {
    this.phase = 'flying'
    this.game.audioManager.playLaunch()

    if (this.powerMeter) {
      this.powerMeter.style.display = 'none'
    }
    if (this.instruction) {
      this.instruction.textContent = '飛んでいます...'
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

    // Reset for next launch
    this.phase = 'aiming'
    this.angleH = 0
    this.angleV = 45
    this.power = 50

    if (this.aimArrow) {
      this.aimArrow.visible = true
      this.aimArrow.rotation.set(0, 0, 0)
    }
    if (this.phaseIndicator) {
      this.phaseIndicator.textContent = this.getPhaseText()
    }
    if (this.instruction) {
      this.instruction.textContent = 'スワイプで角度調整 / タップで確定'
    }

    // Reset camera
    gsap.to(this.game.camera.position, {
      x: 0,
      y: 6,
      z: 15,
      duration: 0.5
    })

    this.updateAngleUI()
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
