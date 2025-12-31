import * as THREE from 'three'

const vertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  varying vec3 vWorldPosition;

  void main() {
    float h = normalize(vWorldPosition + offset).y;
    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
  }
`

type SkyColorPreset = {
  topColor: THREE.Color
  bottomColor: THREE.Color
}

const SKY_PRESETS: { night: SkyColorPreset; twilight: SkyColorPreset; sunrise: SkyColorPreset } = {
  night: {
    topColor: new THREE.Color(0x0a0a2e),
    bottomColor: new THREE.Color(0x1a1040)
  },
  twilight: {
    topColor: new THREE.Color(0x2a1050),
    bottomColor: new THREE.Color(0xff6030)
  },
  sunrise: {
    topColor: new THREE.Color(0x87ceeb),
    bottomColor: new THREE.Color(0xff8040)
  }
}

export class SkyGradient {
  private skyMesh: THREE.Mesh
  private skyMaterial: THREE.ShaderMaterial
  private stars: THREE.Points
  private starMaterial: THREE.PointsMaterial
  private _timeOfDay = 0

  // 太陽
  private sunGroup: THREE.Group
  private sunMesh: THREE.Mesh
  private sunGlow: THREE.Mesh
  private sunLight: THREE.PointLight

  constructor() {
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: SKY_PRESETS.night.topColor.clone() },
        bottomColor: { value: SKY_PRESETS.night.bottomColor.clone() },
        offset: { value: 33 },
        exponent: { value: 0.6 }
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide
    })

    const skyGeometry = new THREE.SphereGeometry(100, 32, 15)
    this.skyMesh = new THREE.Mesh(skyGeometry, this.skyMaterial)

    this.stars = this.createStars()
    this.starMaterial = this.stars.material as THREE.PointsMaterial

    // 太陽を作成
    const { sunGroup, sunMesh, sunGlow, sunLight } = this.createSun()
    this.sunGroup = sunGroup
    this.sunMesh = sunMesh
    this.sunGlow = sunGlow
    this.sunLight = sunLight
  }

  private createSun() {
    const sunGroup = new THREE.Group()

    // 太陽本体
    const sunGeometry = new THREE.SphereGeometry(5, 32, 32)
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0
    })
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial)

    // 太陽のグロー（大きめの半透明球体）
    const glowGeometry = new THREE.SphereGeometry(12, 32, 32)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide
    })
    const sunGlow = new THREE.Mesh(glowGeometry, glowMaterial)

    // 太陽光源
    const sunLight = new THREE.PointLight(0xffdd88, 0, 100)

    sunGroup.add(sunMesh)
    sunGroup.add(sunGlow)
    sunGroup.add(sunLight)

    // 初期位置（地平線の下）
    sunGroup.position.set(0, -20, -80)

    return { sunGroup, sunMesh, sunGlow, sunLight }
  }

  private createStars(): THREE.Points {
    const starsGeometry = new THREE.BufferGeometry()
    const starCount = 500
    const positions = new Float32Array(starCount * 3)
    const sizes = new Float32Array(starCount)

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 0.8 + 0.2)
      const radius = 90

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.cos(phi)
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)

      sizes[i] = Math.random() * 0.5 + 0.2
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      transparent: true,
      opacity: 1.0,
      sizeAttenuation: true
    })

    return new THREE.Points(starsGeometry, starsMaterial)
  }

  get timeOfDay(): number {
    return this._timeOfDay
  }

  set timeOfDay(value: number) {
    this._timeOfDay = Math.max(0, Math.min(1, value))
    this.updateColors()
  }

  private updateColors() {
    const t = this._timeOfDay
    const topUniform = this.skyMaterial.uniforms.topColor
    const bottomUniform = this.skyMaterial.uniforms.bottomColor

    if (t < 0.5) {
      const localT = t / 0.5
      topUniform.value.lerpColors(SKY_PRESETS.night.topColor, SKY_PRESETS.twilight.topColor, localT)
      bottomUniform.value.lerpColors(SKY_PRESETS.night.bottomColor, SKY_PRESETS.twilight.bottomColor, localT)
    } else {
      const localT = (t - 0.5) / 0.5
      topUniform.value.lerpColors(SKY_PRESETS.twilight.topColor, SKY_PRESETS.sunrise.topColor, localT)
      bottomUniform.value.lerpColors(SKY_PRESETS.twilight.bottomColor, SKY_PRESETS.sunrise.bottomColor, localT)
    }

    const starOpacity = Math.max(0, 1 - t * 2)
    this.starMaterial.opacity = starOpacity
    this.stars.visible = starOpacity > 0.01

    // 太陽の更新
    this.updateSun(t)
  }

  private updateSun(t: number) {
    // 太陽は t > 0.3 で出始め、t = 1.0 で完全に上昇
    const sunStartTime = 0.3
    const sunProgress = Math.max(0, (t - sunStartTime) / (1 - sunStartTime))

    // 太陽の位置（地平線の下から上に）
    // y: -20 (地平線下) → 15 (上昇)
    const sunY = -20 + sunProgress * 35
    this.sunGroup.position.y = sunY

    // 太陽の不透明度
    const sunOpacity = Math.min(1, sunProgress * 1.5)
    const sunMaterial = this.sunMesh.material as THREE.MeshBasicMaterial
    sunMaterial.opacity = sunOpacity

    // グローの不透明度（太陽より遅れて強くなる）
    const glowOpacity = Math.min(0.4, sunProgress * 0.5)
    const glowMaterial = this.sunGlow.material as THREE.MeshBasicMaterial
    glowMaterial.opacity = glowOpacity

    // 太陽光の強度
    this.sunLight.intensity = sunProgress * 2

    // 太陽の色を時間に応じて変化（赤っぽい → 黄色）
    if (sunProgress > 0) {
      const colorT = Math.min(1, sunProgress)
      const sunColor = new THREE.Color().lerpColors(
        new THREE.Color(0xff4400), // 日の出直後の赤
        new THREE.Color(0xffdd44), // 上昇後の黄色
        colorT
      )
      sunMaterial.color.copy(sunColor)

      const glowColor = new THREE.Color().lerpColors(
        new THREE.Color(0xff6600),
        new THREE.Color(0xffaa00),
        colorT
      )
      glowMaterial.color.copy(glowColor)
    }
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.skyMesh)
    scene.add(this.stars)
    scene.add(this.sunGroup)
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this.skyMesh)
    scene.remove(this.stars)
    scene.remove(this.sunGroup)
  }

  dispose() {
    this.skyMesh.geometry.dispose()
    this.skyMaterial.dispose()
    this.stars.geometry.dispose()
    this.starMaterial.dispose()

    // 太陽のdispose
    this.sunMesh.geometry.dispose()
    ;(this.sunMesh.material as THREE.Material).dispose()
    this.sunGlow.geometry.dispose()
    ;(this.sunGlow.material as THREE.Material).dispose()
  }

  update(_delta: number) {
    this.stars.rotation.y += _delta * 0.01
  }
}
