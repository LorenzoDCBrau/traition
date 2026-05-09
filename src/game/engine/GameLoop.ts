export class GameLoop {
  private rafId = 0
  private lastTime = 0

  constructor(private onTick: (dt: number) => void) {}

  start() {
    this.lastTime = performance.now()
    this.tick(this.lastTime)
  }

  private tick = (now: number) => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now
    this.onTick(dt)
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop() {
    cancelAnimationFrame(this.rafId)
  }
}
