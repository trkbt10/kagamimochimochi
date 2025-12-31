import * as THREE from 'three'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'

export class ResultScene extends BaseScene {
  private score = 0
  private particles: THREE.Points | null = null
  private kagamimochi: THREE.Group | null = null
  private confettiElements: HTMLElement[] = []

  constructor(game: Game) {
    super(game)
  }

  async enter(data?: Record<string, unknown>) {
    this.score = (data?.score as number) || 0

    this.setupScene()
    this.buildUI()
    this.setupEventListeners()
    this.playResultAnimation()

    if (this.score >= 80) {
      this.game.audioManager.playSuccess()
      this.spawnConfetti()
    } else {
      this.game.audioManager.playFail()
    }
  }

  async exit() {
    this.removeUI()
    this.clearConfetti()
    this.clearScene()
  }

  update(delta: number) {
    if (this.particles) {
      this.particles.rotation.y += delta * 0.2
    }

    if (this.kagamimochi) {
      this.kagamimochi.rotation.y += delta * 0.5
    }
  }

  private setupScene() {
    // Background based on score
    const bgColor = this.score >= 80 ? 0x1a0a2a : this.score >= 50 ? 0x1a1a0a : 0x2a0a0a
    this.scene.background = new THREE.Color(bgColor)
    this.scene.fog = new THREE.FogExp2(bgColor, 0.05)

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambient)

    const spotlight = new THREE.SpotLight(0xffd700, 2, 30, Math.PI / 4, 0.5)
    spotlight.position.set(0, 15, 5)
    this.scene.add(spotlight)

    // Create floating particles
    this.createParticles()

    // Create result kagamimochi representation
    this.createResultKagamimochi()
  }

  private createParticles() {
    const geometry = new THREE.BufferGeometry()
    const count = 300
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = Math.random() * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30

      // Colors based on score
      if (this.score >= 80) {
        colors[i * 3] = 1
        colors[i * 3 + 1] = 0.84
        colors[i * 3 + 2] = 0
      } else if (this.score >= 50) {
        colors[i * 3] = 0.8
        colors[i * 3 + 1] = 0.8
        colors[i * 3 + 2] = 0.8
      } else {
        colors[i * 3] = 0.5
        colors[i * 3 + 1] = 0.5
        colors[i * 3 + 2] = 0.5
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.6
    })

    this.particles = new THREE.Points(geometry, material)
    this.scene.add(this.particles)
  }

  private createResultKagamimochi() {
    this.kagamimochi = new THREE.Group()

    // Create a visual representation based on score
    const mochiMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff8e7,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: this.score >= 30 ? 1 : 0.3
    })

    // Base mochi
    const baseGeometry = new THREE.SphereGeometry(1.5, 32, 24)
    baseGeometry.scale(1, 0.5, 1)
    const baseMochi = new THREE.Mesh(baseGeometry, mochiMaterial)
    baseMochi.position.y = -0.5

    // Offset based on score (lower score = more offset)
    const baseOffset = this.score >= 30 ? 0 : (100 - this.score) * 0.02
    baseMochi.position.x = baseOffset * (Math.random() - 0.5)
    baseMochi.position.z = baseOffset * (Math.random() - 0.5)
    this.kagamimochi.add(baseMochi)

    // Top mochi
    const topGeometry = new THREE.SphereGeometry(1.1, 32, 24)
    topGeometry.scale(1, 0.5, 1)
    const topMochiMaterial = mochiMaterial.clone()
    topMochiMaterial.opacity = this.score >= 60 ? 1 : 0.3
    const topMochi = new THREE.Mesh(topGeometry, topMochiMaterial)
    topMochi.position.y = 0.3

    const topOffset = this.score >= 60 ? 0 : (100 - this.score) * 0.03
    topMochi.position.x = topOffset * (Math.random() - 0.5)
    topMochi.position.z = topOffset * (Math.random() - 0.5)
    this.kagamimochi.add(topMochi)

    // Mikan
    const mikanGeometry = new THREE.SphereGeometry(0.5, 32, 24)
    const mikanMaterial = new THREE.MeshStandardMaterial({
      color: 0xff8c00,
      roughness: 0.8,
      transparent: true,
      opacity: this.score >= 80 ? 1 : 0.3
    })
    const mikan = new THREE.Mesh(mikanGeometry, mikanMaterial)
    mikan.position.y = 1

    const mikanOffset = this.score >= 80 ? 0 : (100 - this.score) * 0.04
    mikan.position.x = mikanOffset * (Math.random() - 0.5)
    mikan.position.z = mikanOffset * (Math.random() - 0.5)
    this.kagamimochi.add(mikan)

    this.kagamimochi.position.y = 2
    this.scene.add(this.kagamimochi)
  }

  private buildUI() {
    const rating = this.getRating()

    this.ui = this.createUI(`
      <div class="result-overlay active">
        <div class="score-label">YOUR SCORE</div>
        <div class="score-display" id="scoreDisplay">0</div>
        <div class="rating" id="rating">${rating.emoji}</div>
        <div class="subtitle" style="margin-top: 1rem; color: #fff;">${rating.text}</div>

        <div class="share-buttons">
          <button class="share-btn twitter" id="shareTwitter">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Xでシェア
          </button>
        </div>

        <button class="btn" style="margin-top: 2rem;" id="backToTitle">タイトルに戻る</button>
      </div>
    `)
  }

  private getRating(): { emoji: string; text: string } {
    if (this.score >= 100) {
      return { emoji: '🎊🏆🎊', text: '完璧！神業です！' }
    } else if (this.score >= 80) {
      return { emoji: '🎉✨', text: '素晴らしい！見事な鏡餅！' }
    } else if (this.score >= 60) {
      return { emoji: '😊👍', text: 'まあまあ！惜しい！' }
    } else if (this.score >= 40) {
      return { emoji: '😅', text: 'うーん...もう一回！' }
    } else if (this.score >= 20) {
      return { emoji: '😢', text: 'ヤバイ...修行が必要' }
    } else {
      return { emoji: '💀', text: '鏡餅崩壊...あけましておめでとう！' }
    }
  }

  private setupEventListeners() {
    if (!this.ui) return

    const shareTwitterBtn = this.ui.querySelector('#shareTwitter') as HTMLButtonElement
    const backBtn = this.ui.querySelector('#backToTitle') as HTMLButtonElement

    shareTwitterBtn.addEventListener('click', () => {
      this.shareToTwitter()
    })

    backBtn.addEventListener('click', () => {
      this.game.audioManager.playClick()
      this.game.sceneManager.switchTo('intro')
    })
  }

  private shareToTwitter() {
    const rating = this.getRating()
    const text = `🎍 鏡餅スタッキングゲーム 🎍\n\nスコア: ${this.score}点\n${rating.emoji} ${rating.text}\n\n#鏡餅スタッキング #あけおめ`
    const url = encodeURIComponent(window.location.href)
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`
    window.open(tweetUrl, '_blank')
  }

  private playResultAnimation() {
    // Animate score counter
    const scoreDisplay = this.ui?.querySelector('#scoreDisplay')
    if (scoreDisplay) {
      gsap.fromTo(
        { val: 0 },
        { val: this.score },
        {
          duration: 2,
          ease: 'power2.out',
          onUpdate: function (this: gsap.core.Tween) {
            const target = this.targets()[0] as { val: number }
            scoreDisplay.textContent = Math.round(target.val).toString()
          }
        }
      )
    }

    // Animate rating
    const rating = this.ui?.querySelector('#rating')
    if (rating) {
      gsap.fromTo(
        rating,
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          delay: 1.5,
          ease: 'elastic.out(1, 0.5)'
        }
      )
    }

    // Animate kagamimochi
    if (this.kagamimochi) {
      gsap.from(this.kagamimochi.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 1,
        ease: 'elastic.out(1, 0.5)'
      })
    }

    // Animate camera
    gsap.from(this.game.camera.position, {
      z: 20,
      y: 10,
      duration: 1.5,
      ease: 'power2.out'
    })
  }

  private spawnConfetti() {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF8C00']

    for (let i = 0; i < 100; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div')
        confetti.className = 'confetti'
        confetti.style.left = `${Math.random() * 100}%`
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
        confetti.style.animationDelay = `${Math.random() * 2}s`
        confetti.style.animationDuration = `${2 + Math.random() * 2}s`
        document.body.appendChild(confetti)
        this.confettiElements.push(confetti)

        // Remove after animation
        setTimeout(() => {
          confetti.remove()
        }, 5000)
      }, i * 50)
    }
  }

  private clearConfetti() {
    this.confettiElements.forEach(el => el.remove())
    this.confettiElements = []
  }
}
