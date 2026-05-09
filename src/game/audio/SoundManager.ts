import { Howl, Howler } from 'howler'

type SoundKey = 'shoot' | 'footstep' | 'hit' | 'ambient'

export class SoundManager {
  private sounds = new Map<SoundKey, Howl>()

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

  dispose() {
    for (const sound of this.sounds.values()) sound.unload()
    this.sounds.clear()
  }
}
