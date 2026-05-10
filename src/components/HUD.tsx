import Minimap from './Minimap'
import type { GameStateManager, Role, MissionData, SabotageState } from '../game/state/GameState'

interface Props {
  gsm: GameStateManager | null
  playerPos: { x: number; z: number }
  missionProgress: number
  playerRole: Role
  players: Array<{ id: string; name: string; alive: boolean; isHuman: boolean }>
  nearMission: MissionData | null
  nearBody: boolean
  nearEnemy: boolean
  sabotages: SabotageState[]
  activeBlackout: boolean
  reactorMeltdown: { active: boolean; endsAt: number } | null
  onSabotage: (type: import('../game/state/GameState').SabotageType) => void
}

const ROLE_COLORS: Record<Role, string> = {
  INNOCENT: '#4488ff',
  TRAITOR: '#ff4444',
  DETECTIVE: '#ffcc00',
}

const ROLE_LABELS: Record<Role, string> = {
  INNOCENT: 'INNOCENT',
  TRAITOR: 'TRAITOR',
  DETECTIVE: 'DETECTIVE',
}

const SABOTAGE_LABELS = {
  BLACKOUT: 'Blackout',
  LOCK_DOORS: 'Lock Doors',
  REACTOR_MELTDOWN: 'Reactor',
}

function fmtCooldown(s: SabotageState): string {
  if (s.active) return 'ACTIVE'
  const left = Math.max(0, s.cooldownEndsAt - Date.now())
  if (left === 0) return 'READY'
  return `${Math.ceil(left / 1000)}s`
}

export default function HUD({
  gsm,
  playerPos,
  missionProgress,
  playerRole,
  players,
  nearMission,
  nearBody,
  nearEnemy,
  sabotages,
  activeBlackout,
  reactorMeltdown,
  onSabotage,
}: Props) {
  const roleColor = ROLE_COLORS[playerRole]
  const aliveList = players.filter((p) => p.alive)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        fontFamily: 'monospace',
        color: '#fff',
        userSelect: 'none',
      }}
    >
      {/* ── Blackout overlay ── */}
      {activeBlackout && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.5) 60px, rgba(0,0,0,0.97) 200px)',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── Reactor Meltdown alert ── */}
      {reactorMeltdown?.active && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(200,0,0,0.85)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 'bold',
            padding: '8px 22px',
            borderRadius: 6,
            letterSpacing: 2,
            zIndex: 60,
            animation: 'pulse 0.8s infinite',
          }}
        >
          ⚠ REACTOR MELTDOWN — {Math.max(0, Math.ceil((reactorMeltdown.endsAt - Date.now()) / 1000))}s
        </div>
      )}

      {/* ── Top: mission progress bar ── */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 320,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: 2, marginBottom: 4, opacity: 0.7 }}>
          MISSIONS
        </div>
        <div
          style={{
            height: 8,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${missionProgress}%`,
              background: 'linear-gradient(90deg, #00ffcc, #4488ff)',
              transition: 'width 0.5s',
              borderRadius: 4,
            }}
          />
        </div>
        <div style={{ fontSize: 11, marginTop: 3, opacity: 0.6 }}>{missionProgress}%</div>
      </div>

      {/* ── Top-left: role panel ── */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(0,0,0,0.7)',
          border: `2px solid ${roleColor}`,
          borderRadius: 8,
          padding: '8px 14px',
          minWidth: 120,
        }}
      >
        <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 2 }}>YOUR ROLE</div>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: roleColor, letterSpacing: 3 }}>
          {ROLE_LABELS[playerRole]}
        </div>
      </div>

      {/* ── Right: player list ── */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'rgba(0,0,0,0.65)',
          borderRadius: 8,
          padding: '8px 14px',
          minWidth: 130,
        }}
      >
        <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 2, marginBottom: 6 }}>
          PLAYERS — {aliveList.length}
        </div>
        {aliveList.map((p) => (
          <div
            key={p.id}
            style={{
              fontSize: 12,
              lineHeight: '1.7',
              color: p.isHuman ? '#ffffff' : '#aabbcc',
              fontWeight: p.isHuman ? 'bold' : 'normal',
            }}
          >
            {p.isHuman ? '▶ ' : '  '}
            {p.name}
          </div>
        ))}
      </div>

      {/* ── Bottom-center: action hints ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 16,
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {nearMission && (
          <div style={hintStyle('#00ffcc')}>
            <Kbd>E</Kbd>
            {nearMission.type === 'HACK_TERMINAL' ? ' Hack Terminal' : ` ${nearMission.label}`}
          </div>
        )}
        {nearEnemy && playerRole === 'TRAITOR' && (
          <div style={hintStyle('#ff4444')}>
            <Kbd>E</Kbd> Eliminate
          </div>
        )}
        {nearBody && (
          <div style={hintStyle('#ffcc00')}>
            <Kbd>F</Kbd> Report Body
          </div>
        )}
      </div>

      {/* ── Traitor sabotage panel (bottom-left above minimap) ── */}
      {playerRole === 'TRAITOR' && (
        <div
          style={{
            position: 'absolute',
            bottom: 190,
            left: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            pointerEvents: 'auto',
          }}
        >
          {sabotages.map((s) => {
            const ready = !s.active && Date.now() >= s.cooldownEndsAt
            return (
              <button
                key={s.type}
                onClick={() => onSabotage(s.type)}
                disabled={!ready}
                style={{
                  background: ready ? 'rgba(180,0,0,0.8)' : 'rgba(60,60,60,0.7)',
                  border: `1px solid ${ready ? '#ff4444' : '#555'}`,
                  color: ready ? '#fff' : '#888',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  cursor: ready ? 'pointer' : 'default',
                  letterSpacing: 1,
                  minWidth: 140,
                  textAlign: 'left',
                }}
              >
                {SABOTAGE_LABELS[s.type]} — {fmtCooldown(s)}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Minimap ── */}
      <Minimap gsm={gsm} playerPos={playerPos} />
    </div>
  )
}

function hintStyle(color: string): React.CSSProperties {
  return {
    background: 'rgba(0,0,0,0.72)',
    border: `1px solid ${color}`,
    borderRadius: 6,
    padding: '5px 14px',
    fontSize: 13,
    color,
    letterSpacing: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 3,
        padding: '1px 6px',
        fontSize: 12,
        fontWeight: 'bold',
      }}
    >
      {children}
    </span>
  )
}
