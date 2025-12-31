export class AudioManager {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private bgmGain: GainNode | null = null
  private sfxGain: GainNode | null = null

  private bgmOscillators: OscillatorNode[] = []
  private bgmPlaying = false

  public masterVolume = 0.7
  public bgmVolume = 0.5

  private isSilentMode = false

  // Base64エンコードされた短い無音mp3（約0.1秒）
  private static readonly SILENT_AUDIO_DATA =
    'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYWkJfyAAAAAAAAAAAAAAAAAAAAAAAA//tQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'

  constructor() {
    this.initAudioContext()
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

      this.masterGain = this.audioContext.createGain()
      this.masterGain.connect(this.audioContext.destination)
      this.masterGain.gain.value = this.masterVolume

      this.bgmGain = this.audioContext.createGain()
      this.bgmGain.connect(this.masterGain)
      this.bgmGain.gain.value = this.bgmVolume

      this.sfxGain = this.audioContext.createGain()
      this.sfxGain.connect(this.masterGain)
      this.sfxGain.gain.value = 1.0
    } catch {
      console.warn('Web Audio API not supported')
    }
  }

  async resume() {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume()
    }
    await this.detectSilentMode()
  }

  async detectSilentMode(): Promise<boolean> {
    const audio = new Audio(AudioManager.SILENT_AUDIO_DATA)
    audio.volume = 0.01

    try {
      await audio.play()
      await new Promise(resolve => setTimeout(resolve, 100))

      // サイレントモードの場合、HTML5 Audioは再生されない
      const isSilent = audio.paused || audio.currentTime === 0
      audio.pause()

      this.isSilentMode = isSilent
      return isSilent
    } catch {
      // 再生失敗 = サイレントモードの可能性
      this.isSilentMode = true
      return true
    }
  }

  private shouldPlayAudio(): boolean {
    return !this.isSilentMode
  }

  setMasterVolume(value: number) {
    this.masterVolume = value
    if (this.masterGain) {
      this.masterGain.gain.value = value
    }
  }

  setBgmVolume(value: number) {
    this.bgmVolume = value
    if (this.bgmGain) {
      this.bgmGain.gain.value = value
    }
  }

  playBgm() {
    if (!this.audioContext || !this.bgmGain || this.bgmPlaying || !this.shouldPlayAudio()) return

    this.bgmPlaying = true

    // Traditional Japanese-style melody using pentatonic scale
    const notes = [261.63, 293.66, 349.23, 392.00, 440.00] // C, D, F, G, A (pentatonic)

    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = this.audioContext!.createOscillator()
      const gain = this.audioContext!.createGain()

      osc.type = 'sine'
      osc.frequency.value = freq

      gain.connect(this.bgmGain!)
      osc.connect(gain)

      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.1)
      gain.gain.linearRampToValueAtTime(0, startTime + duration)

      osc.start(startTime)
      osc.stop(startTime + duration)

      this.bgmOscillators.push(osc)
    }

    const loopBgm = () => {
      if (!this.bgmPlaying || !this.audioContext) return

      const now = this.audioContext.currentTime
      const pattern = [0, 2, 4, 2, 0, 3, 4, 3, 0, 1, 2, 4, 3, 2, 1, 0]

      pattern.forEach((noteIndex, i) => {
        playNote(notes[noteIndex], now + i * 0.4, 0.35)
      })

      setTimeout(loopBgm, pattern.length * 400)
    }

    loopBgm()
  }

  stopBgm() {
    this.bgmPlaying = false
    this.bgmOscillators.forEach(osc => {
      try {
        osc.stop()
      } catch {
        // Already stopped
      }
    })
    this.bgmOscillators = []
  }

  playLaunch() {
    this.playTone(200, 0.15, 'sawtooth', 0.4, 400)
  }

  playLand() {
    this.playTone(150, 0.2, 'sine', 0.5)
    setTimeout(() => this.playTone(100, 0.3, 'sine', 0.3), 50)
  }

  playSuccess() {
    const notes = [523.25, 659.25, 783.99, 1046.50]
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 'sine', 0.4), i * 100)
    })
  }

  playFail() {
    this.playTone(200, 0.3, 'sawtooth', 0.3, 100)
  }

  playClick() {
    this.playTone(800, 0.05, 'square', 0.2)
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.5,
    freqEnd?: number
  ) {
    if (!this.audioContext || !this.sfxGain || !this.shouldPlayAudio()) return

    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    osc.type = type
    osc.frequency.value = freq
    if (freqEnd) {
      osc.frequency.linearRampToValueAtTime(freqEnd, this.audioContext.currentTime + duration)
    }

    gain.connect(this.sfxGain)
    osc.connect(gain)

    gain.gain.setValueAtTime(volume, this.audioContext.currentTime)
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration)

    osc.start()
    osc.stop(this.audioContext.currentTime + duration)
  }
}
