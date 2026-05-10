const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const SEQ_LENGTH = 5
const TIME_LIMIT = 10

export type HackStatus = 'IDLE' | 'ACTIVE' | 'SUCCESS' | 'FAIL'

export class HackTerminal {
  sequence = ''
  input = ''
  timeLeft = TIME_LIMIT
  status: HackStatus = 'IDLE'

  start() {
    this.sequence = Array.from(
      { length: SEQ_LENGTH },
      () => LETTERS[Math.floor(Math.random() * LETTERS.length)],
    ).join('')
    this.input = ''
    this.timeLeft = TIME_LIMIT
    this.status = 'ACTIVE'
  }

  handleKey(key: string): boolean {
    if (this.status !== 'ACTIVE') return false
    if (key.length !== 1) return false

    const ch = key.toUpperCase()
    if (!LETTERS.includes(ch)) return false

    this.input += ch

    if (this.input.length === SEQ_LENGTH) {
      if (this.input === this.sequence) {
        this.status = 'SUCCESS'
      } else {
        this.status = 'FAIL'
      }
      return true
    }
    return false
  }

  update(dt: number): boolean {
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
    this.timeLeft = TIME_LIMIT
  }
}
