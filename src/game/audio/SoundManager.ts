import { Howl, Howler } from 'howler'

type SoundKey = 'shoot' | 'footstep' | 'hit' | 'ambient'

export class SoundManager {
  private sounds = new Map<SoundKey, Howl>()
  private ctx: AudioContext | null = null

  private _getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    return this.ctx
  }

  load(key: SoundKey, src: string, options: { loop?: boolean; volume?: number } = {}) {
    this.sounds.set(
      key,
      new Howl({ src: [src], loop: options.loop ?? false, volume: options.volume ?? 1 }),
    )
  }

  play(key: SoundKey) {
    this.sounds.get(key)?.play()
  }

  stop(key: SoundKey) {
    this.sounds.get(key)?.stop()
  }

  setMasterVolume(vol: number) {
    Howler.volume(vol)
  }

  // ── Procedural sounds ─────────────────────────────────────────────────────

  playAlert() {
    const ctx = this._getCtx()
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'square'
      const t = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0.18, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
      osc.start(t)
      osc.stop(t + 0.18)
    }
  }

  playReport() {
    const ctx = this._getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(220, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.8)
    osc.type = 'sawtooth'
    gain.gain.setValueAtTime(0.22, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.8)
  }

  playVictory() {
    const ctx = this._getCtx()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  }

  playDefeat() {
    const ctx = this._getCtx()
    const notes = [330, 277, 220, 185]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sawtooth'
      const t = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0.18, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.start(t)
      osc.stop(t + 0.5)
    })
  }

  playInteract() {
    const ctx = this._getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 1320
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  }

  dispose() {
    for (const sound of this.sounds.values()) sound.unload()
    this.sounds.clear()
    this.ctx?.close()
  }
}
