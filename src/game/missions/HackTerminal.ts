const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const SEQ_LENGTH = 5
const SHOW_TIME = 3    // seconds to display sequence before accepting input
const TIME_LIMIT = 15  // seconds to type once ACTIVE

export type HackStatus = 'IDLE' | 'SHOWING' | 'ACTIVE' | 'SUCCESS' | 'FAIL'

export class HackTerminal {
  sequence = ''
  input = ''
  timeLeft = SHOW_TIME
  status: HackStatus = 'IDLE'

  start() {
    this.sequence = Array.from(
      { length: SEQ_LENGTH },
      () => LETTERS[Math.floor(Math.random() * LETTERS.length)],
    ).join('')
    this.input = ''
    this.timeLeft = SHOW_TIME
    this.status = 'SHOWING'
  }

  handleKey(key: string): boolean {
    if (this.status !== 'ACTIVE') return false
    if (key.length !== 1) return false
    const ch = key.toUpperCase()
    if (!LETTERS.includes(ch)) return false

    this.input += ch
    if (this.input.length === SEQ_LENGTH) {
      this.status = this.input === this.sequence ? 'SUCCESS' : 'FAIL'
      return true
    }
    return false
  }

  update(dt: number): boolean {
    if (this.status === 'SHOWING') {
      this.timeLeft -= dt
      if (this.timeLeft <= 0) {
        this.timeLeft = TIME_LIMIT
        this.status = 'ACTIVE'
      }
      return false
    }
    if (this.status !== 'ACTIVE') return false
    this.timeLeft -= dt
    if (this.timeLeft <= 0) {
      this.timeLeft = 0
      this.status = 'FAIL'
      return true
    }
    return false
  }

  reset() {
    this.status = 'IDLE'
    this.sequence = ''
    this.input = ''
    this.timeLeft = SHOW_TIME
  }
}
