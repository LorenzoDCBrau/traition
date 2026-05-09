import { io, Socket } from 'socket.io-client'

export interface PlayerState {
  id: string
  x: number
  y: number
  z: number
  rotY: number
}

export class NetworkManager {
  private socket: Socket | null = null
  onPlayerUpdate?: (state: PlayerState) => void
  onPlayerLeft?: (id: string) => void

  connect(url: string) {
    this.socket = io(url, { autoConnect: true })

    this.socket.on('player:update', (state: PlayerState) => {
      this.onPlayerUpdate?.(state)
    })

    this.socket.on('player:left', (id: string) => {
      this.onPlayerLeft?.(id)
    })
  }

  sendState(state: Omit<PlayerState, 'id'>) {
    this.socket?.emit('player:update', state)
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }
}
