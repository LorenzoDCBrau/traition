import { useCallback, useEffect, useRef, useState } from 'react'
import GameCanvas, { type GameCanvasRefs } from '../components/GameCanvas'
import HUD from '../components/HUD'
import RoleReveal from '../components/RoleReveal'
import HackTerminalUI from '../components/HackTerminalUI'
import Discussion from '../components/Discussion'
import VictoryScreen from '../components/VictoryScreen'
import { HackTerminal } from '../game/missions/HackTerminal'
import type {
  GameStateManager,
  Phase,
  Role,
  MissionData,
  SabotageState,
  PlayerData,
} from '../game/state/GameState'
import type { SabotageType } from '../game/state/GameState'

interface UIState {
  phase: Phase
  playerRole: Role
  players: PlayerData[]
  missionProgress: number
  sabotages: SabotageState[]
  activeBlackout: boolean
  reactorMeltdown: { active: boolean; endsAt: number } | null
  winner: 'INNOCENT' | 'TRAITOR' | null
}

const DEFAULT_UI: UIState = {
  phase: 'ROLE_REVEAL',
  playerRole: 'INNOCENT',
  players: [],
  missionProgress: 0,
  sabotages: [],
  activeBlackout: false,
  reactorMeltdown: null,
  winner: null,
}

// Shared HackTerminal instance (lives outside React render cycle)
const hackTerminal = new HackTerminal()

export default function Game() {
  const refsRef = useRef<GameCanvasRefs | null>(null)
  const gsmRef = useRef<GameStateManager | null>(null)
  const [ui, setUI] = useState<UIState>(DEFAULT_UI)
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 })
  const [nearMission, setNearMission] = useState<MissionData | null>(null)
  const [nearBody, setNearBody] = useState(false)
  const [nearEnemy, setNearEnemy] = useState(false)
  const [showHackTerminal, setShowHackTerminal] = useState(false)
  const [ejectedId, setEjectedId] = useState<string | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  const syncUI = useCallback((gsm: GameStateManager) => {
    setUI({
      phase: gsm.phase,
      playerRole: gsm.playerRole,
      players: [...gsm.players],
      missionProgress: gsm.missionProgress,
      sabotages: gsm.sabotages.map((s) => ({ ...s })),
      activeBlackout: gsm.activeBlackout,
      reactorMeltdown: gsm.reactorMeltdown ? { ...gsm.reactorMeltdown } : null,
      winner: gsm.winner,
    })
  }, [])

  const onReady = useCallback(
    (refs: GameCanvasRefs) => {
      refsRef.current = refs
      gsmRef.current = refs.gsm
      const gsm = refs.gsm

      syncUI(gsm)

      gsm.addEventListener('state_changed', () => syncUI(gsm))
      gsm.addEventListener('open_hack_terminal', () => setShowHackTerminal(true))

      // Poll proximity state at 10fps (cheap, avoids 60fps React renders)
      const pollId = window.setInterval(() => {
        if (!refsRef.current) return
        setPlayerPos(refsRef.current.getPlayerPos())
        setNearMission(refsRef.current.getNearMission())
        setNearBody(refsRef.current.getNearBody())
        setNearEnemy(refsRef.current.getNearEnemy())
      }, 100)

      // Cleanup stored in gsm for when component unmounts
      ;(gsm as any)._pollId = pollId
    },
    [syncUI],
  )

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      const pollId = (gsmRef.current as any)?._pollId
      if (pollId) clearInterval(pollId)
    }
  }, [])

  function handleRoleRevealDone() {
    setShowInstructions(true)
  }

  function handleInstructionsDone() {
    setShowInstructions(false)
    gsmRef.current?.startPlaying()
  }

  function handleHackTerminalClose(success: boolean) {
    setShowHackTerminal(false)
    if (success && nearMission) {
      gsmRef.current?.completeMission('HACK_TERMINAL')
    }
  }

  function handleVotingDone(ejectedPlayerId: string | null) {
    setEjectedId(ejectedPlayerId)
    const gsm = gsmRef.current
    if (!gsm) return

    // Show result for 3 seconds then return to playing
    setTimeout(() => {
      setEjectedId(null)
      gsm.backToPlaying()
    }, 3000)
  }

  function handleSabotage(type: SabotageType) {
    refsRef.current?.activateSabotage(type)
  }

  function handleRestart() {
    window.location.reload()
  }

  const gsm = gsmRef.current
  const ejectedPlayer = ejectedId ? gsm?.getPlayer(ejectedId) : null

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <GameCanvas onReady={onReady} />

      {/* Always-on HUD (only after game starts) */}
      {ui.phase !== 'ROLE_REVEAL' && ui.phase !== 'GAME_OVER' && (
        <HUD
          gsm={gsm}
          playerPos={playerPos}
          missionProgress={ui.missionProgress}
          playerRole={ui.playerRole}
          players={ui.players}
          nearMission={nearMission}
          nearBody={nearBody}
          nearEnemy={nearEnemy}
          sabotages={ui.sabotages}
          activeBlackout={ui.activeBlackout}
          reactorMeltdown={ui.reactorMeltdown}
          onSabotage={handleSabotage}
        />
      )}

      {/* Role reveal overlay */}
      {ui.phase === 'ROLE_REVEAL' && gsm && (
        <RoleReveal role={ui.playerRole} onDone={handleRoleRevealDone} />
      )}

      {/* How to Play overlay (shown once after role reveal) */}
      {showInstructions && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(4,8,18,0.96)', zIndex: 250,
            fontFamily: 'monospace', color: '#fff',
          }}
        >
          <div
            style={{
              background: '#080f1e',
              border: '2px solid #2a4060',
              borderRadius: 16,
              padding: '44px 56px',
              maxWidth: 460,
              textAlign: 'center',
              boxShadow: '0 0 60px #0033aa44',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 'bold', letterSpacing: 6, marginBottom: 32, color: '#aaccff' }}>
              HOW TO PLAY
            </div>
            <div style={{ textAlign: 'left', lineHeight: 2.2, fontSize: 14, color: '#cde' }}>
              <div><span style={{ color: '#4488ff', fontWeight: 'bold' }}>WASD</span> — Move</div>
              <div><span style={{ color: '#4488ff', fontWeight: 'bold' }}>E</span> — Interact with terminals</div>
              <div><span style={{ color: '#4488ff', fontWeight: 'bold' }}>F</span> — Report dead body</div>
              <div style={{ marginTop: 16, borderTop: '1px solid #1a2a3a', paddingTop: 16, color: '#88aacc', fontSize: 13, lineHeight: 1.8 }}>
                Complete <b style={{ color: '#fff' }}>5 missions</b> to win as Innocent.
                <br />
                Find and eject the <b style={{ color: '#ff4444' }}>Traitor</b> during discussions.
                <br />
                Report bodies to trigger a vote.
              </div>
            </div>
            <button
              onClick={handleInstructionsDone}
              style={{
                marginTop: 32,
                background: '#1a3a60',
                border: '2px solid #4488ff',
                borderRadius: 8,
                color: '#aaccff',
                fontFamily: 'monospace',
                fontSize: 16,
                fontWeight: 'bold',
                padding: '12px 48px',
                cursor: 'pointer',
                letterSpacing: 4,
              }}
            >
              GOT IT
            </button>
          </div>
        </div>
      )}

      {/* Hack Terminal minigame */}
      {showHackTerminal && (
        <HackTerminalUI terminal={hackTerminal} onClose={handleHackTerminalClose} />
      )}

      {/* Discussion + voting overlay */}
      {(ui.phase === 'DISCUSSION' || ui.phase === 'VOTING') && gsm && (
        <Discussion
          gsm={gsm}
          players={ui.players}
          playerRole={ui.playerRole}
          onVotingDone={handleVotingDone}
        />
      )}

      {/* Ejection result banner (phase === 'RESULT') */}
      {ui.phase === 'RESULT' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.78)',
            zIndex: 450,
            fontFamily: 'monospace',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {ejectedPlayer ? (
            <>
              <div style={{ fontSize: 16, color: '#aaa', letterSpacing: 3 }}>EJECTED</div>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: '#fff' }}>
                {ejectedPlayer.name}
              </div>
              <div
                style={{
                  fontSize: 18,
                  color:
                    ejectedPlayer.role === 'TRAITOR'
                      ? '#ff4444'
                      : ejectedPlayer.role === 'DETECTIVE'
                      ? '#ffcc00'
                      : '#4488ff',
                  letterSpacing: 2,
                }}
              >
                was {ejectedPlayer.role}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 22, color: '#aaa' }}>No one was ejected (tie vote)</div>
          )}
        </div>
      )}

      {/* Victory / defeat screen */}
      {ui.phase === 'GAME_OVER' && ui.winner && (
        <VictoryScreen
          winner={ui.winner}
          ejectedName={ejectedPlayer?.name}
          ejectedRole={ejectedPlayer?.role}
          onRestart={handleRestart}
        />
      )}
    </div>
  )
}
