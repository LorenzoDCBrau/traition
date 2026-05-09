import GameCanvas from '../components/GameCanvas'
import HUD from '../components/HUD'

export default function Game() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <GameCanvas />
      <HUD />
    </div>
  )
}
