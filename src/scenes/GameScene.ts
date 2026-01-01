import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'
import type { LayoutInfo } from '../core/layout'
import { calculateLayoutScale } from '../core/layout'
import {
  MochiManager,
  createMochiGeometry,
  type MochiType,
  type MochiObject,
  MOCHI_CONFIGS
} from '../objects'
import { ScoreSystem } from '../systems/ScoreSystem'
import type { GameMode } from '../types/game-mode'
import { ENDLESS_MODE_CONFIG } from '../types/game-mode'
import type { NormalResultData, EndlessResultData } from '../types/scene-data'
import {
  calculateTrajectory,
  getTrajectoryColor,
  createTrajectoryLine,
  updateTrajectoryLine,
  createTargetMarker,
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
import { EffectManager } from '../effects'
import { StickinessManager } from './game/stickiness-manager'
import { SkyGradient } from '../effects/SkyGradient'
import { SnowEffect } from '../effects/SnowEffect'
import { MountainFuji } from '../objects/MountainFuji'

type GamePhase = 'direction' | 'elevation' | 'power' | 'flying' | 'landed' | 'complete'

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
  private stickinessManager: StickinessManager | null = null

  private flyingStartTime = 0

  // MochiManager統合
  private mochiManager: MochiManager | null = null
  private currentMochi: MochiObject | null = null
  private currentType: MochiType = 'base'

  // ScoreSystem統合
  private scoreSystem: ScoreSystem | null = null

  private phase: GamePhase = 'direction'
  private launchParams: LaunchParameters = createDefaultLaunchParameters()

  private gaugeValue = 50
  private gaugeDirection = 1
  private gaugeSpeed = 120

  // ゲームモード関連
  private gameMode: GameMode = 'normal'
  private endlessMochiIndex = 0
  private maxStackHeight = 0
  private gameStartTime = 0
  private isCollapsed = false

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

  private effectManager: EffectManager | null = null
  private timeScale = 1

  // お正月演出
  private skyGradient: SkyGradient | null = null
  private snowEffect: SnowEffect | null = null
  private mountain: MountainFuji | null = null
  private skyTime = 0
  private ambientLight: THREE.AmbientLight | null = null
  private mainLight: THREE.DirectionalLight | null = null

  constructor(game: Game) {
    super(game)
  }

  async enter(data?: Record<string, unknown>) {
    // ゲームモードを取得
    this.gameMode = (data?.mode as GameMode) ?? 'normal'
    this.gameStartTime = Date.now()

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
    this.effectManager = new EffectManager(this.scene)
  }

  async exit() {
    this.removeUI()
    this.removeEventListeners()
    this.unregisterLayoutListener()
    this.removePreviewMesh()
    this.effectManager?.dispose()
    this.effectManager = null

    // カメラ追従を停止
    this.game.cameraController.stopFollow()

    // MochiManagerのクリーンアップ
    this.mochiManager?.dispose()
    this.mochiManager = null
    this.currentMochi = null

    // ScoreSystemのクリーンアップ
    this.scoreSystem = null

    // 粘性マネージャーのクリーンアップ
    this.stickinessManager?.dispose()
    this.stickinessManager = null

    // お正月演出のクリーンアップ
    this.skyGradient?.dispose()
    this.snowEffect?.dispose()
    this.mountain?.dispose()
    this.skyGradient = null
    this.snowEffect = null
    this.mountain = null
    this.ambientLight = null
    this.mainLight = null

    this.clearScene()
    this.world = null
  }

  update(delta: number) {
    const scaledDelta = delta * this.timeScale
    this.updatePhysics(scaledDelta)
    this.syncMeshesWithBodies()
    this.updateAimArrowIfNeeded()
    this.updateGaugePositionIfVisible()
    this.updateUIPositionIfVisible()
    this.updateGaugeOscillation(delta)
    this.checkLandingCondition()
    this.effectManager?.update(delta)

    // 空と雪のアニメーション
    this.skyGradient?.update(delta)
    this.snowEffect?.update(delta)

    // エンドレスモード: 最大高度の追跡と崩壊チェック
    if (this.gameMode === 'endless' && !this.isCollapsed) {
      this.updateMaxHeight()
      this.checkCollapse()
    }
  }

  /**
   * 現在のスタック最大高度を更新
   */
  private updateMaxHeight(): void {
    if (!this.mochiManager) return
    const currentMaxHeight = this.mochiManager.getMaxHeight() - DAI_POSITION.y
    if (currentMaxHeight > this.maxStackHeight) {
      this.maxStackHeight = currentMaxHeight
    }
  }

  /**
   * 崩壊を検出（エンドレスモード用）
   */
  private checkCollapse(): void {
    // 飛行中・着地直後は判定しない
    if (this.phase === 'flying' || this.phase === 'landed') return
    if (!this.mochiManager || this.mochiManager.getCount() === 0) return

    const daiPos = new THREE.Vector3(DAI_POSITION.x, DAI_POSITION.y, DAI_POSITION.z)
    if (this.mochiManager.detectCollapse(daiPos, 3, -1.5)) {
      this.onCollapse()
    }
  }

  /**
   * 崩壊時の処理（エンドレスモード）
   */
  private onCollapse(): void {
    if (this.isCollapsed) return
    this.isCollapsed = true

    this.game.audioManager.playFail()

    // ゲームオーバー演出
    this.effectManager?.showCutIn('崩壊！', this.game.camera, () => {
      const survivalTime = (Date.now() - this.gameStartTime) / 1000
      const resultData: EndlessResultData = {
        mode: 'endless',
        maxHeight: Math.round(this.maxStackHeight * 10) / 10,
        mochiCount: this.mochiManager?.getCount() ?? 0,
        survivalTime: Math.round(survivalTime)
      }
      this.game.sceneManager.switchTo('result', resultData)
    })
  }

  private updatePhysics(delta: number) {
    this.world?.step(1 / 60, delta, 3)
    this.stickinessManager?.update()
  }

  private syncMeshesWithBodies() {
    // MochiManagerが自動的にメッシュと物理ボディを同期
    this.mochiManager?.update()
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
    if (this.phase !== 'flying' || !this.currentMochi) return

    const speed = this.currentMochi.getSpeed()
    const yPos = this.currentMochi.height
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
    // game-defaultプリセットを適用
    this.game.cameraController.applyPreset('game-default')
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
    // MochiManagerをクリア（setupPhysicsで再作成）
    this.mochiManager?.dispose()
    this.mochiManager = null
    this.currentMochi = null
    this.currentType = 'base'
    this.phase = 'direction'
    this.launchParams = createDefaultLaunchParameters()
    this.gaugeValue = 50
    this.gaugeDirection = 1
    this.timeScale = 1
    this.skyTime = 0
    this.stickinessManager?.dispose()

    // ScoreSystemを初期化
    this.scoreSystem = new ScoreSystem(this.gameMode)

    // エンドレスモード用のリセット
    this.endlessMochiIndex = 0
    this.maxStackHeight = 0
    this.isCollapsed = false
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

    // MochiManagerの初期化
    this.mochiManager = new MochiManager(
      this.world!,
      this.scene,
      this.mochiMaterial!,
      this.gameMode
    )

    // 粘性マネージャーの初期化
    this.stickinessManager = new StickinessManager(this.world!)
    this.setupCollisionListeners()
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

  private setupCollisionListeners(): void {
    // 餅オブジェクト同士の衝突を検出
    this.world!.addEventListener(
      'beginContact',
      (event: { bodyA: CANNON.Body; bodyB: CANNON.Body }) => {
        const { bodyA, bodyB } = event
        if (!this.mochiManager) return

        // 両方が餅オブジェクト（地面・台座ではない）かをチェック
        const allMochi = this.mochiManager.getAll()
        const isMochiA = allMochi.some((m) => m.body === bodyA)
        const isMochiB = allMochi.some((m) => m.body === bodyB)

        if (!isMochiA || !isMochiB) return

        // 接触法線を取得
        const contact = this.world!.contacts.find(
          (c) =>
            (c.bi === bodyA && c.bj === bodyB) ||
            (c.bi === bodyB && c.bj === bodyA)
        )

        if (contact) {
          const normal = contact.ni.clone()
          // 法線の向きを正規化（常に下から上への向き）
          if (contact.bi === bodyB) normal.negate()

          this.stickinessManager?.onCollision(bodyA, bodyB, normal)
        }
      }
    )
  }

  private setupScene() {
    // グラデーション空（夜空からスタート）
    this.skyGradient = new SkyGradient()
    this.skyGradient.timeOfDay = 0
    this.skyGradient.addToScene(this.scene)

    this.scene.background = null
    this.scene.fog = new THREE.FogExp2(0x0a0a1e, 0.01)

    // 雪エフェクト
    this.snowEffect = new SnowEffect()
    this.snowEffect.addToScene(this.scene)

    // 富士山を奥に配置
    this.mountain = new MountainFuji(1.5)
    this.mountain.setPosition(0, -2, -60)
    this.mountain.addToScene(this.scene)

    this.setupLights()
    this.setupFloor()
    this.setupDai()
    this.createAimArrow()
  }

  private setupLights() {
    // 月明かり（夜間用）
    const moonLight = new THREE.DirectionalLight(0x8888ff, 0.3)
    moonLight.position.set(-10, 15, -5)
    this.scene.add(moonLight)

    // アンビエント（時刻で変化）
    this.ambientLight = new THREE.AmbientLight(0x6666aa, 0.3)
    this.scene.add(this.ambientLight)

    // メインライト（時刻で変化）
    this.mainLight = new THREE.DirectionalLight(0xffffff, 0.5)
    this.mainLight.position.set(5, 10, 5)
    this.mainLight.castShadow = true
    this.mainLight.shadow.mapSize.width = 2048
    this.mainLight.shadow.mapSize.height = 2048
    // シャドウアクネ（モアレ模様）防止
    this.mainLight.shadow.bias = -0.0005
    this.mainLight.shadow.normalBias = 0.02
    this.scene.add(this.mainLight)

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
    this.aimArrow.rotation.x = vRad
  }

  private createPreviewMesh() {
    this.removePreviewMesh()

    const config = MOCHI_CONFIGS[this.currentType]
    const geometry = this.createPreviewGeometry(config)
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: config.roughness,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    })

    this.previewMesh = new THREE.Mesh(geometry, material)
    this.previewMesh.castShadow = true
    this.previewMesh.position.copy(this.launchParams.launchPosition)
    this.scene.add(this.previewMesh)
  }

  private createPreviewGeometry(config: typeof MOCHI_CONFIGS[MochiType]): THREE.BufferGeometry {
    if (config.type === 'mikan') {
      return new THREE.SphereGeometry(config.radius, 32, 24)
    }
    return createMochiGeometry(config.radius, config.height)
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

    this.phaseSprite = createUITextSprite(this.getPhaseText(), 80, '#FFD700')
    this.phaseSprite.position.set(0, 1.6, 0)
    this.uiContainer.add(this.phaseSprite)

    this.instructionSprite = createUITextSprite('タップで方向を決定！', 60, '#FFFFFF')
    this.instructionSprite.position.set(0, 0.7, 0)
    this.uiContainer.add(this.instructionSprite)
  }

  private getPhaseText(): string {
    const config = MOCHI_CONFIGS[this.currentType]
    return `${config.displayName} を発射！`
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

    updateUITextSprite(this.instructionSprite!, 'タップで角度を決定！', 60, '#FFFFFF')
  }

  private confirmElevation() {
    this.launchParams.angleV = 15 + this.gaugeValue * 0.6
    this.game.audioManager.playLand()

    this.elevationGauge!.group.visible = false
    this.powerGauge!.group.visible = true

    this.gaugeValue = 0
    this.gaugeDirection = 1
    this.phase = 'power'

    updateUITextSprite(this.instructionSprite!, 'タップでパワーを決定！', 60, '#FFFFFF')
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

    updateUITextSprite(this.instructionSprite!, '飛んでいます...', 60, '#FFFFFF')

    // MochiManagerで餅を作成
    const mochi = this.mochiManager!.createMochi(
      this.currentType,
      this.launchParams.launchPosition
    )
    this.currentMochi = mochi

    this.applyLaunchVelocity(mochi)

    const launchDirection = calculateInitialVelocity(this.launchParams).normalize()
    this.effectManager?.emitSmoke(this.launchParams.launchPosition, launchDirection)

    this.animateCameraForFlight()
  }

  private applyLaunchVelocity(mochi: MochiObject) {
    const velocity = calculateInitialVelocity(this.launchParams)

    const randomX = (Math.random() - 0.5) * 2
    const randomZ = (Math.random() - 0.5) * 1

    mochi.setVelocity(new THREE.Vector3(
      velocity.x + randomX,
      velocity.y,
      velocity.z + randomZ
    ))

    mochi.setAngularVelocity(new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5
    ))
  }

  private animateCameraForFlight() {
    const hRad = degreesToRadians(this.launchParams.angleH)

    const targetPos = new THREE.Vector3(
      Math.sin(hRad) * 3,
      10,
      18
    )
    const targetLookAt = new THREE.Vector3(0, 0, 3)

    // 初期位置へアニメーション後、餅を追従開始
    this.game.cameraController.animateTo(targetPos, targetLookAt, {
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        // 飛行中の餅を追従（ゆるやかに）
        if (this.currentMochi && this.phase === 'flying') {
          this.game.cameraController.startFollow(this.currentMochi.mesh, {
            offset: new THREE.Vector3(0, 5, 12),
            lookAtOffset: new THREE.Vector3(0, 0, 0),
            smoothness: 0.92, // ゆるやかな追従
            bounds: {
              minY: 5,   // カメラが低くなりすぎない
              maxY: 20   // 高くなりすぎない
            }
          })
        }
      }
    })
  }

  private onObjectLanded() {
    this.phase = 'landed'
    this.game.audioManager.playLand()

    // 追従を停止
    this.game.cameraController.stopFollow()

    const landingPos = this.currentMochi!.position

    // ヒットストップ開始
    this.timeScale = 0.05

    // 土埃と衝撃波
    this.effectManager?.emitDust(landingPos, 1)
    this.effectManager?.triggerShockwave(landingPos)

    // 着地エフェクト（シェイク）
    this.game.cameraEffects?.triggerLandingEffect(0.5)

    updateUITextSprite(this.instructionSprite!, '', 60, '#00FF00')

    // カメラの現在位置を保存してカット
    const cutPosition = new THREE.Vector3(
      landingPos.x + 2,
      landingPos.y + 2,
      landingPos.z + 3
    )

    // ヒットストップ後にカメラカット
    gsap.timeline()
      .to({}, { duration: 0.15 }) // ヒットストップ維持
      .call(() => {
        // カメラをお餅にカット（瞬時に移動、元位置を保存）
        this.game.cameraController.cutTo(cutPosition, landingPos, { saveState: true })

        // ヒットストップ解除
        gsap.to(this, {
          timeScale: 1,
          duration: 0.3,
          ease: 'power2.out'
        })

        // 文字表示（完了後にカメラを戻す）
        this.effectManager?.showCutIn('着地！', this.game.camera, () => {
          // カメラを元に戻す（スムーズに）
          this.game.cameraController.returnToSaved({
            duration: 0.4,
            ease: 'power2.out',
            onComplete: () => {
              this.proceedToNextObject()
            }
          })
        })
      })
  }

  private proceedToNextObject() {
    if (this.gameMode === 'endless') {
      // エンドレスモード: base → top → base → top ... のループ
      this.endlessMochiIndex++
      const sequence = ENDLESS_MODE_CONFIG.mochiSequence
      this.currentType = sequence[this.endlessMochiIndex % sequence.length] as MochiType
      this.resetForNextLaunch()
      this.createPreviewMesh()
      return
    }

    // 通常モード: base → top → mikan → 終了
    const nextType = this.getNextMochiType(this.currentType)

    if (!nextType) {
      this.phase = 'complete'
      this.calculateAndShowResult()
      return
    }

    this.currentType = nextType
    this.resetForNextLaunch()
    this.createPreviewMesh()
  }

  /**
   * 通常モードの餅シーケンス
   */
  private getNextMochiType(current: MochiType): MochiType | null {
    const sequence: Record<MochiType, MochiType | null> = {
      base: 'top',
      top: 'mikan',
      mikan: null
    }
    return sequence[current]
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

    updateUITextSprite(this.phaseSprite!, this.getPhaseText(), 80, '#FFD700')
    updateUITextSprite(this.instructionSprite!, 'タップで方向を決定！', 60, '#FFFFFF')

    // 空の時間を進める（餅の種類に応じて）
    this.transitionSky()

    this.animateCameraToStart()
  }

  private transitionSky() {
    // 餅の種類に応じた目標時刻
    const targetSkyTimes: Record<MochiType, number> = {
      base: 0.0,   // 夜空
      top: 0.4,    // 薄明
      mikan: 0.8   // 朝焼け
    }

    const targetTime = targetSkyTimes[this.currentType]

    gsap.to(this, {
      skyTime: targetTime,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        if (this.skyGradient) {
          this.skyGradient.timeOfDay = this.skyTime
        }
        this.updateLightingForSkyTime()
      }
    })
  }

  private updateLightingForSkyTime() {
    if (!this.ambientLight || !this.mainLight) return

    // 夜 (0) → 朝 (1) でライティングを変化
    const t = this.skyTime

    // アンビエントライト: 青っぽい暗め → 明るい白
    const ambientIntensity = 0.3 + t * 0.4
    this.ambientLight.intensity = ambientIntensity
    this.ambientLight.color.setHex(t < 0.5 ? 0x6666aa : 0xffffff)

    // メインライト: 暗い → 明るいオレンジ/白
    const mainIntensity = 0.5 + t * 0.8
    this.mainLight.intensity = mainIntensity
    if (t > 0.5) {
      this.mainLight.color.setHex(0xffddaa) // 朝日のオレンジがかった色
    }

    // 霧の色も変化
    if (this.scene.fog instanceof THREE.FogExp2) {
      if (t < 0.3) {
        this.scene.fog.color.setHex(0x0a0a1e) // 夜
      } else if (t < 0.6) {
        this.scene.fog.color.setHex(0x2a1030) // 薄明
      } else {
        this.scene.fog.color.setHex(0xff8060) // 朝焼け
      }
    }
  }

  private animateCameraToStart() {
    // game-defaultプリセットの位置へ戻る
    const preset = this.game.cameraController.getPreset('game-default')
    if (preset) {
      this.game.cameraController.animateTo(preset.position, preset.lookAt, {
        duration: 0.5,
        ease: 'power2.out'
      })
    }
  }

  private calculateAndShowResult() {
    // ScoreSystemを使ってスコア計算
    const scoreResult = this.scoreSystem?.calculate(this.mochiManager!) ?? {
      total: 0,
      breakdown: [],
      maxHeight: 0,
      stackCount: 0,
      isPerfect: false
    }

    if (this.uiContainer) {
      this.uiContainer.visible = false
    }

    // 第1段階: 台座を見下ろす位置へ
    const pos1 = new THREE.Vector3(DAI_POSITION.x, DAI_POSITION.y + 4, DAI_POSITION.z + 5)
    const lookAt1 = new THREE.Vector3(DAI_POSITION.x, DAI_POSITION.y + 1, DAI_POSITION.z)

    this.game.cameraController.animateTo(pos1, lookAt1, {
      duration: 1.2,
      ease: 'power2.inOut',
      onComplete: () => {
        // 第2段階: 結果表示へズームイン
        const pos2 = new THREE.Vector3(DAI_POSITION.x, DAI_POSITION.y + 2, DAI_POSITION.z + 2)
        const lookAt2 = new THREE.Vector3(DAI_POSITION.x, DAI_POSITION.y + 0.5, DAI_POSITION.z)

        this.game.cameraController.animateTo(pos2, lookAt2, {
          duration: 0.6,
          ease: 'power3.in',
          onComplete: () => {
            // 結果発表エフェクト
            this.game.cameraEffects?.triggerResultZoomEffect()

            setTimeout(() => {
              const resultData: NormalResultData = {
                mode: 'normal',
                score: scoreResult.total
              }
              this.game.sceneManager.switchTo('result', resultData)
            }, 100)
          }
        })
      }
    })
  }

  /**
   * レイアウト変更時の調整
   */
  protected adjustLayout(layout: LayoutInfo): void {
    // ゲージコンテナのスケールを調整
    if (this.gaugeContainer) {
      const scale = calculateLayoutScale(layout)
      // 基本スケールは0.3なので、それに掛け合わせる
      const adjustedScale = 0.3 * scale
      this.gaugeContainer.children.forEach((child) => {
        child.scale.setScalar(adjustedScale)
      })
    }

    // UIコンテナのスケールを調整
    if (this.uiContainer) {
      const scale = calculateLayoutScale(layout)
      this.uiContainer.scale.setScalar(scale)
    }
  }
}
