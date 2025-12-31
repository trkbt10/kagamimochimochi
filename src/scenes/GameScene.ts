import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'
import type { LayoutInfo } from '../core/layout'
import { calculateLayoutScale } from '../core/layout'
import {
  type MochiType,
  MOCHI_HANDLERS,
  getNextMochiType
} from './game/mochi-handler'
import {
  calculateTrajectory,
  getTrajectoryColor,
  createTrajectoryLine,
  updateTrajectoryLine,
  createTargetMarker,
  TARGET_POSITION,
  DAI_POSITION
} from './game/trajectory'
import {
  type LaunchParameters,
  createDefaultLaunchParameters,
  calculateInitialVelocity,
  degreesToRadians
} from '../types/launch'
import {
  type GaugeGroup,
  createHorizontalGauge,
  createVerticalGauge,
  createPowerGauge,
  updateDirectionGauge,
  updateElevationGauge,
  updatePowerGauge,
  resetPowerGauge,
  updateGaugeContainerPosition
} from './game/gauge'
import {
  createUITextSprite,
  updateUITextSprite,
  updateUIContainerPosition
} from './game/text-sprite'

type GamePhase = 'direction' | 'elevation' | 'power' | 'flying' | 'landed' | 'complete'

type LaunchedObject = {
  mesh: THREE.Mesh
  body: CANNON.Body
  type: MochiType
}

const TRAJECTORY_POINTS = 50
const LANDING_TIMEOUT_SECONDS = 8
const LANDING_SPEED_THRESHOLD = 0.5
const LANDING_SPEED_SOFT_THRESHOLD = 1.5
const LANDING_HEIGHT_THRESHOLD = 3
const LANDING_HEIGHT_SOFT_THRESHOLD = 2

export class GameScene extends BaseScene {
  private world: CANNON.World | null = null
  private groundBody: CANNON.Body | null = null
  private daiBody: CANNON.Body | null = null

  private mochiMaterial: CANNON.Material | null = null
  private groundMaterial: CANNON.Material | null = null

  private flyingStartTime = 0

  private launchedObjects: LaunchedObject[] = []
  private currentObject: LaunchedObject | null = null
  private currentType: MochiType = 'base'

  private phase: GamePhase = 'direction'
  private launchParams: LaunchParameters = createDefaultLaunchParameters()

  private gaugeValue = 50
  private gaugeDirection = 1
  private gaugeSpeed = 120

  private aimArrow: THREE.Group | null = null

  private dai: THREE.Mesh | null = null

  private directionGauge: GaugeGroup | null = null
  private elevationGauge: GaugeGroup | null = null
  private powerGauge: GaugeGroup | null = null
  private gaugeContainer: THREE.Group | null = null

  private trajectoryLine: THREE.Line | null = null
  private targetMarker: THREE.Mesh | null = null

  private phaseSprite: THREE.Sprite | null = null
  private instructionSprite: THREE.Sprite | null = null
  private uiContainer: THREE.Group | null = null

  private previewMesh: THREE.Mesh | null = null

  constructor(game: Game) {
    super(game)
  }

  async enter() {
    this.resetState()
    this.setupPhysics()
    this.setupScene()
    this.setupTrajectory()
    this.setup3DGauges()
    this.buildUI()
    this.setupEventListeners()
    this.setupCamera()
    this.createPreviewMesh()
    this.registerLayoutListener()
    this.game.audioManager.playBgm()
  }

  async exit() {
    this.game.audioManager.stopBgm()
    this.removeUI()
    this.removeEventListeners()
    this.unregisterLayoutListener()
    this.removePreviewMesh()
    this.clearScene()
    this.world = null
  }

  update(delta: number) {
    this.updatePhysics(delta)
    this.syncMeshesWithBodies()
    this.updateAimArrowIfNeeded()
    this.updateGaugePositionIfVisible()
    this.updateUIPositionIfVisible()
    this.updateGaugeOscillation(delta)
    this.checkLandingCondition()
  }

  private updatePhysics(delta: number) {
    this.world?.step(1 / 60, delta, 3)
  }

  private syncMeshesWithBodies() {
    for (const obj of this.launchedObjects) {
      obj.mesh.position.copy(obj.body.position as unknown as THREE.Vector3)
      obj.mesh.quaternion.copy(obj.body.quaternion as unknown as THREE.Quaternion)
    }
  }

  private updateAimArrowIfNeeded() {
    const isGaugePhase = this.phase === 'direction' || this.phase === 'elevation' || this.phase === 'power'
    if (this.aimArrow && isGaugePhase) {
      this.updateAimArrow()
    }
  }

  private updateGaugePositionIfVisible() {
    if (this.gaugeContainer?.visible) {
      updateGaugeContainerPosition(this.gaugeContainer, this.game.camera)
    }
  }

  private updateUIPositionIfVisible() {
    if (this.uiContainer) {
      updateUIContainerPosition(this.uiContainer, this.game.camera)
    }
  }

  private updateGaugeOscillation(delta: number) {
    const isGaugePhase = this.phase === 'direction' || this.phase === 'elevation' || this.phase === 'power'
    if (!isGaugePhase) return

    this.gaugeValue += this.gaugeDirection * this.gaugeSpeed * delta

    if (this.gaugeValue >= 100) {
      this.gaugeValue = 100
      this.gaugeDirection = -1
    } else if (this.gaugeValue <= 0) {
      this.gaugeValue = 0
      this.gaugeDirection = 1
    }

    this.updateCurrentGauge()
    this.updateTrajectoryDisplay()
  }

  private updateCurrentGauge() {
    if (this.phase === 'direction' && this.directionGauge) {
      this.launchParams.angleH = updateDirectionGauge(this.directionGauge, this.gaugeValue)
    } else if (this.phase === 'elevation' && this.elevationGauge) {
      this.launchParams.angleV = updateElevationGauge(this.elevationGauge, this.gaugeValue)
    } else if (this.phase === 'power' && this.powerGauge) {
      updatePowerGauge(this.powerGauge, this.gaugeValue)
    }
  }

  private checkLandingCondition() {
    if (this.phase !== 'flying' || !this.currentObject) return

    const velocity = this.currentObject.body.velocity
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
    const yPos = this.currentObject.body.position.y
    const timeSinceLaunch = (Date.now() - this.flyingStartTime) / 1000

    const isSlowEnough = speed < LANDING_SPEED_THRESHOLD
    const isNearGround = yPos < LANDING_HEIGHT_THRESHOLD
    const hasLandedOnSomething = yPos < LANDING_HEIGHT_SOFT_THRESHOLD && speed < LANDING_SPEED_SOFT_THRESHOLD
    const timeoutReached = timeSinceLaunch > LANDING_TIMEOUT_SECONDS

    if ((isSlowEnough && isNearGround) || hasLandedOnSomething || timeoutReached) {
      this.onObjectLanded()
    }
  }

  private setupTrajectory() {
    this.trajectoryLine = createTrajectoryLine(TRAJECTORY_POINTS)
    this.scene.add(this.trajectoryLine)

    this.targetMarker = createTargetMarker()
    this.scene.add(this.targetMarker)
  }

  private updateTrajectoryDisplay() {
    if (!this.trajectoryLine) return

    // パワーフェーズ中はgaugeValueを使用、それ以外はpowerを使用
    const currentPower = this.phase === 'power' ? this.gaugeValue : this.launchParams.power

    const result = calculateTrajectory(
      {
        ...this.launchParams,
        power: currentPower
      },
      TRAJECTORY_POINTS
    )

    const color = getTrajectoryColor(result.landingDistance)
    updateTrajectoryLine(this.trajectoryLine, result.points, color)
  }

  private setupCamera() {
    const camera = this.game.camera
    camera.position.set(0, 12, 22)
    camera.lookAt(0, 0, 5)
  }

  private setup3DGauges() {
    this.gaugeContainer = new THREE.Group()
    this.scene.add(this.gaugeContainer)

    const gaugeScale = 0.3

    this.directionGauge = createHorizontalGauge()
    this.directionGauge.group.scale.setScalar(gaugeScale)
    this.directionGauge.group.position.set(0, 0, 0)
    this.gaugeContainer.add(this.directionGauge.group)

    this.elevationGauge = createVerticalGauge()
    this.elevationGauge.group.scale.setScalar(gaugeScale)
    this.elevationGauge.group.position.set(0, 0, 0)
    this.elevationGauge.group.visible = false
    this.gaugeContainer.add(this.elevationGauge.group)

    this.powerGauge = createPowerGauge()
    this.powerGauge.group.scale.setScalar(gaugeScale)
    this.powerGauge.group.position.set(0, 0, 0)
    this.powerGauge.group.visible = false
    this.gaugeContainer.add(this.powerGauge.group)
  }

  private resetState() {
    this.launchedObjects = []
    this.currentObject = null
    this.currentType = 'base'
    this.phase = 'direction'
    this.launchParams = createDefaultLaunchParameters()
    this.gaugeValue = 50
    this.gaugeDirection = 1
  }

  private setupPhysics() {
    this.world = new CANNON.World()
    this.world.gravity.set(0, -9.8, 0)
    this.world.broadphase = new CANNON.NaiveBroadphase()

    this.mochiMaterial = new CANNON.Material('mochi')
    this.groundMaterial = new CANNON.Material('ground')

    this.setupGroundBody()
    this.setupDaiBody()
    this.setupContactMaterials()
  }

  private setupGroundBody() {
    const groundShape = new CANNON.Plane()
    this.groundBody = new CANNON.Body({ mass: 0, material: this.groundMaterial! })
    this.groundBody.addShape(groundShape)
    this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
    this.groundBody.position.set(0, -2, 0)
    this.world!.addBody(this.groundBody)
  }

  private setupDaiBody() {
    const daiShape = new CANNON.Cylinder(1.8, 2, 0.5, 16)
    this.daiBody = new CANNON.Body({ mass: 0, material: this.groundMaterial! })
    this.daiBody.addShape(daiShape)
    this.daiBody.position.set(DAI_POSITION.x, DAI_POSITION.y, DAI_POSITION.z)
    this.world!.addBody(this.daiBody)
  }

  private setupContactMaterials() {
    const mochiGroundContact = new CANNON.ContactMaterial(this.mochiMaterial!, this.groundMaterial!, {
      friction: 1.2,
      restitution: 0.02
    })
    this.world!.addContactMaterial(mochiGroundContact)

    const mochiMochiContact = new CANNON.ContactMaterial(this.mochiMaterial!, this.mochiMaterial!, {
      friction: 1.5,
      restitution: 0.01
    })
    this.world!.addContactMaterial(mochiMochiContact)
  }

  private setupScene() {
    this.scene.background = new THREE.Color(0x2a1515)
    this.scene.fog = new THREE.FogExp2(0x2a1515, 0.03)

    this.setupLights()
    this.setupFloor()
    this.setupDai()
    this.createAimArrow()
  }

  private setupLights() {
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

    const targetGlow = new THREE.PointLight(0xffd700, 0.5, 5)
    targetGlow.position.set(0, -1, 0)
    this.scene.add(targetGlow)
  }

  private setupFloor() {
    const floorGeometry = new THREE.PlaneGeometry(50, 50)
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 0.9
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -2
    floor.receiveShadow = true
    this.scene.add(floor)
  }

  private setupDai() {
    const daiGeometry = new THREE.CylinderGeometry(1.8, 2, 0.5, 32)
    const daiMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.6,
      metalness: 0.2
    })
    this.dai = new THREE.Mesh(daiGeometry, daiMaterial)
    this.dai.position.set(DAI_POSITION.x, DAI_POSITION.y, DAI_POSITION.z)
    this.dai.castShadow = true
    this.dai.receiveShadow = true
    this.scene.add(this.dai)
  }

  private createAimArrow() {
    this.aimArrow = new THREE.Group()

    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })

    const arrowBodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8)
    const arrowBody = new THREE.Mesh(arrowBodyGeometry, arrowMaterial)
    arrowBody.rotation.x = -Math.PI / 2
    arrowBody.position.z = -1
    this.aimArrow.add(arrowBody)

    const arrowHeadGeometry = new THREE.ConeGeometry(0.2, 0.5, 8)
    const arrowHead = new THREE.Mesh(arrowHeadGeometry, arrowMaterial)
    arrowHead.rotation.x = -Math.PI / 2
    arrowHead.position.z = -2.25
    this.aimArrow.add(arrowHead)

    this.aimArrow.position.copy(this.launchParams.launchPosition)
    this.scene.add(this.aimArrow)
  }

  private updateAimArrow() {
    if (!this.aimArrow) return

    const hRad = degreesToRadians(this.launchParams.angleH)
    const vRad = degreesToRadians(this.launchParams.angleV)

    this.aimArrow.rotation.y = -hRad
    this.aimArrow.rotation.x = -vRad
  }

  private createPreviewMesh() {
    this.removePreviewMesh()

    const handler = MOCHI_HANDLERS[this.currentType]
    const geometry = handler.createGeometry()
    const material = handler.createMaterial(0.85)

    this.previewMesh = new THREE.Mesh(geometry, material)
    this.previewMesh.castShadow = true
    this.previewMesh.position.copy(this.launchParams.launchPosition)
    this.scene.add(this.previewMesh)
  }

  private removePreviewMesh() {
    if (!this.previewMesh) return

    this.scene.remove(this.previewMesh)
    this.previewMesh.geometry.dispose()
    if (this.previewMesh.material instanceof THREE.Material) {
      this.previewMesh.material.dispose()
    }
    this.previewMesh = null
  }

  private buildUI() {
    this.uiContainer = new THREE.Group()
    this.scene.add(this.uiContainer)

    this.phaseSprite = createUITextSprite(this.getPhaseText(), 64, '#FFD700')
    this.phaseSprite.position.set(0, 1.5, 0)
    this.uiContainer.add(this.phaseSprite)

    this.instructionSprite = createUITextSprite('タップで方向を決定！', 48, '#FFFFFF')
    this.instructionSprite.position.set(0, 0.8, 0)
    this.uiContainer.add(this.instructionSprite)
  }

  private getPhaseText(): string {
    const handler = MOCHI_HANDLERS[this.currentType]
    return `${handler.displayName} を発射！`
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

    const phaseHandlers: Record<string, () => void> = {
      direction: () => this.confirmDirection(),
      elevation: () => this.confirmElevation(),
      power: () => this.confirmPowerAndLaunch()
    }

    phaseHandlers[this.phase]?.()
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== ' ' && e.key !== 'Enter') return

    e.preventDefault()
    const phaseHandlers: Record<string, () => void> = {
      direction: () => this.confirmDirection(),
      elevation: () => this.confirmElevation(),
      power: () => this.confirmPowerAndLaunch()
    }

    phaseHandlers[this.phase]?.()
  }

  private confirmDirection() {
    this.launchParams.angleH = (this.gaugeValue - 50) * 1.2
    this.game.audioManager.playLand()

    this.directionGauge!.group.visible = false
    this.elevationGauge!.group.visible = true

    this.gaugeValue = 50
    this.gaugeDirection = 1
    this.phase = 'elevation'

    updateUITextSprite(this.instructionSprite!, 'タップで角度を決定！', 48, '#FFFFFF')
  }

  private confirmElevation() {
    this.launchParams.angleV = 15 + this.gaugeValue * 0.6
    this.game.audioManager.playLand()

    this.elevationGauge!.group.visible = false
    this.powerGauge!.group.visible = true

    this.gaugeValue = 0
    this.gaugeDirection = 1
    this.phase = 'power'

    updateUITextSprite(this.instructionSprite!, 'タップでパワーを決定！', 48, '#FFFFFF')
  }

  private confirmPowerAndLaunch() {
    this.launchParams.power = this.gaugeValue
    this.launch()
  }

  private launch() {
    this.phase = 'flying'
    this.flyingStartTime = Date.now()
    this.game.audioManager.playLaunch()

    this.removePreviewMesh()

    this.gaugeContainer!.visible = false
    this.aimArrow!.visible = false
    this.trajectoryLine!.visible = false

    updateUITextSprite(this.instructionSprite!, '飛んでいます...', 48, '#FFFFFF')

    const obj = this.createLaunchObject()
    this.currentObject = obj
    this.launchedObjects.push(obj)

    this.applyLaunchVelocity(obj)
    this.animateCameraForFlight()
  }

  private applyLaunchVelocity(obj: LaunchedObject) {
    const velocity = calculateInitialVelocity(this.launchParams)

    const randomX = (Math.random() - 0.5) * 2
    const randomZ = (Math.random() - 0.5) * 1

    obj.body.velocity.set(
      velocity.x + randomX,
      velocity.y,
      velocity.z + randomZ
    )

    obj.body.angularVelocity.set(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5
    )
  }

  private animateCameraForFlight() {
    const hRad = degreesToRadians(this.launchParams.angleH)

    gsap.to(this.game.camera.position, {
      x: Math.sin(hRad) * 3,
      y: 10,
      z: 18,
      duration: 0.5,
      onUpdate: () => {
        this.game.camera.lookAt(0, 0, 3)
      },
      onComplete: () => {
        this.game.camera.lookAt(0, 0, 3)
      }
    })
  }

  private createLaunchObject(): LaunchedObject {
    const handler = MOCHI_HANDLERS[this.currentType]

    const geometry = handler.createGeometry()
    const material = handler.createMaterial()
    const shape = handler.createPhysicsShape()

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.position.copy(this.launchParams.launchPosition)
    this.scene.add(mesh)

    const body = new CANNON.Body({
      mass: handler.mass,
      material: this.mochiMaterial!,
      linearDamping: 0.4,
      angularDamping: 0.6
    })
    body.addShape(shape)
    const pos = this.launchParams.launchPosition
    body.position.set(pos.x, pos.y, pos.z)
    this.world!.addBody(body)

    return { mesh, body, type: this.currentType }
  }

  private onObjectLanded() {
    this.phase = 'landed'
    this.game.audioManager.playLand()

    updateUITextSprite(this.instructionSprite!, '着地！', 48, '#00FF00')

    setTimeout(() => {
      this.proceedToNextObject()
    }, 1500)
  }

  private proceedToNextObject() {
    const nextType = getNextMochiType(this.currentType)

    if (!nextType) {
      this.phase = 'complete'
      this.calculateAndShowResult()
      return
    }

    this.currentType = nextType
    this.resetForNextLaunch()
    this.createPreviewMesh()
  }

  private resetForNextLaunch() {
    this.phase = 'direction'
    this.launchParams = createDefaultLaunchParameters()
    this.gaugeValue = 50
    this.gaugeDirection = 1

    this.gaugeContainer!.visible = true
    this.trajectoryLine!.visible = true
    this.directionGauge!.group.visible = true
    this.elevationGauge!.group.visible = false
    this.powerGauge!.group.visible = false

    if (this.powerGauge) {
      resetPowerGauge(this.powerGauge)
    }

    this.aimArrow!.visible = true
    this.aimArrow!.rotation.set(0, 0, 0)

    updateUITextSprite(this.phaseSprite!, this.getPhaseText(), 64, '#FFD700')
    updateUITextSprite(this.instructionSprite!, 'タップで方向を決定！', 48, '#FFFFFF')

    this.animateCameraToStart()
  }

  private animateCameraToStart() {
    gsap.to(this.game.camera.position, {
      x: 0,
      y: 12,
      z: 22,
      duration: 0.5,
      onUpdate: () => {
        this.game.camera.lookAt(0, 0, 5)
      },
      onComplete: () => {
        this.game.camera.lookAt(0, 0, 5)
      }
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
    score += this.calculateBaseScore(base)
    score += this.calculateTopScore(top, base)
    score += this.calculateMikanScore(mikan, top)

    return Math.min(100, score)
  }

  private calculateBaseScore(base: { x: number; y: number; z: number }): number {
    const dx = base.x - TARGET_POSITION.x
    const dz = base.z - TARGET_POSITION.z
    const distFromTarget = Math.sqrt(dx ** 2 + dz ** 2)

    if (distFromTarget < 1.5 && base.y > -2 && base.y < 0) return 30
    if (distFromTarget < 3) return 15
    return 0
  }

  private calculateTopScore(
    top: { x: number; y: number; z: number },
    base: { x: number; y: number; z: number }
  ): number {
    const dist = Math.sqrt((top.x - base.x) ** 2 + (top.z - base.z) ** 2)
    const isOnBase = dist < 1.2
    const isAboveBase = top.y > base.y && top.y < base.y + 2

    if (isOnBase && isAboveBase) return 35
    if (dist < 2) return 15
    return 0
  }

  private calculateMikanScore(
    mikan: { x: number; y: number; z: number },
    top: { x: number; y: number; z: number }
  ): number {
    const dist = Math.sqrt((mikan.x - top.x) ** 2 + (mikan.z - top.z) ** 2)
    const isOnTop = dist < 0.8
    const isAboveTop = mikan.y > top.y && mikan.y < top.y + 1.5

    if (isOnTop && isAboveTop) return 35
    if (dist < 1.5) return 15
    return 0
  }

  /**
   * レイアウト変更時の調整
   */
  protected adjustLayout(layout: LayoutInfo): void {
    // ゲージコンテナのスケールを調整
    if (this.gaugeContainer) {
      const scale = calculateLayoutScale(layout, 0.7)
      // 基本スケールは0.3なので、それに掛け合わせる
      const adjustedScale = 0.3 * scale
      this.gaugeContainer.children.forEach((child) => {
        child.scale.setScalar(adjustedScale)
      })
    }

    // UIコンテナのスケールを調整
    if (this.uiContainer) {
      const scale = calculateLayoutScale(layout, 0.7)
      this.uiContainer.scale.setScalar(scale)
    }
  }
}
