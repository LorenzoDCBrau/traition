import GameCanvas from './components/GameCanvas'
import HUD from './components/HUD'

export default function App() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <GameCanvas />
      <HUD />
    </div>
  )
}
