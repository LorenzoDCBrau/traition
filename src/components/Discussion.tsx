import { useEffect, useRef, useState } from 'react'
import type { GameStateManager, PlayerData, Role } from '../game/state/GameState'

interface Props {
  gsm: GameStateManager
  players: PlayerData[]
  playerRole: Role
  onVotingDone: (ejectedId: string | null) => void
}

const NPC_COMMENTS = [
  "I didn't see anything suspicious...",
  "We need to find the traitor fast!",
  "I was doing my mission the whole time.",
  "Has anyone checked the generator room?",
  "Something feels off about this...",
  "Let's not make a hasty decision.",
  "I trust everyone here... mostly.",
  "Stay calm, we can figure this out.",
  "Who was near the body last?",
]

const CHAT_TIME   = 30
const VOTE_TIME   = 20

export default function Discussion({ gsm, players, playerRole, onVotingDone }: Props) {
  const [phase, setPhase] = useState<'CHAT' | 'VOTING'>('CHAT')
  const [messages, setMessages] = useState<Array<{ author: string; text: string; key: number }>>([])
  const [votes, setVotes] = useState<Record<string, string>>({})
  const [playerVote, setPlayerVote] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(CHAT_TIME)
  const [revealedRole, setRevealedRole] = useState<{ name: string; role: Role } | null>(null)
  const [chatInput, setChatInput] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)
  const keyRef = useRef(0)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(iv)
          if (phase === 'CHAT') {
            setPhase('VOTING')
            setTimeLeft(VOTE_TIME)
            gsm.startVoting()
            scheduleNPCVotes()
          } else {
            onVotingDone(gsm.resolveVote())
          }
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [phase]) // eslint-disable-line

  // ── NPC auto-chat ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'CHAT') return
    const aliveNPCs = players.filter((p) => !p.isHuman && p.alive)
    const timeouts: ReturnType<typeof setTimeout>[] = []
    aliveNPCs.slice(0, 4).forEach((npc, i) => {
      const delay = 2000 + i * 4500 + Math.random() * 2000
      timeouts.push(setTimeout(() => {
        const text = NPC_COMMENTS[Math.floor(Math.random() * NPC_COMMENTS.length)]
        setMessages((m) => [...m, { author: npc.name, text, key: keyRef.current++ }])
        gsm.addChatMessage(npc.name, text)
      }, delay))
    })
    return () => timeouts.forEach(clearTimeout)
  }, [phase]) // eslint-disable-line

  function scheduleNPCVotes() {
    const aliveNPCs = players.filter((p) => !p.isHuman && p.alive)
    const targets = players.filter((p) => p.alive)
    aliveNPCs.forEach((npc, i) => {
      setTimeout(() => {
        const pool = npc.role === 'TRAITOR'
          ? targets.filter((t) => t.role !== 'TRAITOR' && t.alive)
          : targets.filter((t) => t.id !== npc.id && t.alive)
        if (!pool.length) return
        const target = pool[Math.floor(Math.random() * pool.length)]
        gsm.vote(npc.id, target.id)
        setVotes((v) => ({ ...v, [npc.id]: target.id }))
      }, 800 + i * 1000)
    })
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim()) return
    const text = chatInput.trim()
    setChatInput('')
    setMessages((m) => [...m, { author: 'You', text, key: keyRef.current++ }])
    gsm.addChatMessage('You', text)
  }

  function castVote(targetId: string) {
    if (playerVote) return
    setPlayerVote(targetId)
    gsm.vote('human', targetId)
    setVotes((v) => ({ ...v, human: targetId }))
  }

  function skipVote() {
    if (playerVote) return
    setPlayerVote('SKIP')
  }

  function useDetectiveReveal(targetId: string) {
    const result = gsm.revealRole(targetId)
    if (result) {
      setRevealedRole(result)
      setMessages((m) => [
        ...m,
        { author: '📋 DETECTIVE', text: `${result.name} is a ${result.role}!`, key: keyRef.current++ },
      ])
    }
  }

  const alivePlayers = players.filter((p) => p.alive)
  const detectiveCanReveal = playerRole === 'DETECTIVE' && !gsm.players.find((p) => p.isHuman)?.revealUsed
  const timerPct = (timeLeft / (phase === 'CHAT' ? CHAT_TIME : VOTE_TIME)) * 100
  const timerColor = timeLeft <= 5 ? '#ff4444' : phase === 'VOTING' ? '#ff8844' : '#ffcc00'

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(4,8,16,0.96)',
        zIndex: 400, display: 'flex', flexDirection: 'column',
        fontFamily: 'monospace', color: '#fff',
      }}
    >
      {/* ── Header with big timer ────────────────────────────────────────── */}
      <div
        style={{
          background: '#08101e',
          borderBottom: '1px solid #223',
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: 3, color: phase === 'CHAT' ? '#ffcc00' : '#ff4444' }}>
            {phase === 'CHAT' ? '⚠ BODY REPORTED' : '🗳 VOTE NOW'}
          </span>
          <span style={{ fontSize: 12, opacity: 0.45 }}>
            {gsm.discussion?.bodyOf} was found dead
          </span>
        </div>

        {/* Timer circle */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 42, fontWeight: 'bold', color: timerColor, lineHeight: 1 }}>
            {timeLeft}
          </div>
          <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.5, marginTop: 2 }}>
            {phase === 'CHAT' ? 'DISCUSS' : 'VOTE'}
          </div>
          {/* Progress bar */}
          <div style={{ width: 60, height: 4, background: '#1a2030', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, transition: 'width 1s linear, background 0.3s', borderRadius: 2 }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: chat ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1a2030' }}>
          <div
            ref={chatRef}
            style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {messages.length === 0 && (
              <div style={{ opacity: 0.3, fontSize: 12, marginTop: 8 }}>No messages yet...</div>
            )}
            {messages.map((msg) => (
              <div key={msg.key} style={{ fontSize: 13, lineHeight: 1.6 }}>
                <span style={{
                  color: msg.author === 'You' ? '#4488ff'
                    : msg.author === '📋 DETECTIVE' ? '#ffcc00' : '#88aacc',
                  fontWeight: 'bold',
                }}>
                  {msg.author}:
                </span>{' '}
                <span style={{ opacity: 0.85 }}>{msg.text}</span>
              </div>
            ))}
          </div>

          {phase === 'CHAT' && (
            <form onSubmit={sendChat} style={{ display: 'flex', borderTop: '1px solid #1a2030', padding: 8, gap: 8 }}>
              <input
                autoFocus
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Say something..."
                style={{
                  flex: 1, background: '#0a0f1e', border: '1px solid #334',
                  borderRadius: 4, color: '#fff', fontFamily: 'monospace',
                  fontSize: 13, padding: '7px 10px', outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#1a2840', border: '1px solid #4488ff', borderRadius: 4,
                  color: '#4488ff', fontFamily: 'monospace', fontSize: 12,
                  padding: '7px 14px', cursor: 'pointer',
                }}
              >
                Send
              </button>
            </form>
          )}

          {phase === 'VOTING' && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid #1a2030', fontSize: 12, color: '#556', fontStyle: 'italic' }}>
              Voting in progress — select a player on the right to eject.
            </div>
          )}
        </div>

        {/* ── Right: player vote list ──────────────────────────────────────── */}
        <div style={{ width: 280, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: phase === 'VOTING' ? '#ff4444' : '#556', marginBottom: 6, textAlign: 'center' }}>
            {phase === 'VOTING' ? '— CLICK TO VOTE —' : 'PLAYERS'}
          </div>

          {alivePlayers.map((p) => {
            const isMe = p.isHuman
            const myVoteTarget = playerVote === p.id
            const totalVotes = Object.values(votes).filter((v) => v === p.id).length
            const revealedThisPlayer = revealedRole?.name === p.name
            const canVoteThis = phase === 'VOTING' && !isMe && !playerVote

            return (
              <div
                key={p.id}
                onClick={() => canVoteThis && castVote(p.id)}
                style={{
                  background: myVoteTarget
                    ? 'rgba(255,68,68,0.2)'
                    : canVoteThis
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(255,255,255,0.03)',
                  border: myVoteTarget
                    ? '2px solid #ff4444'
                    : canVoteThis
                    ? '1px solid #334'
                    : '1px solid #1a2030',
                  borderRadius: 8,
                  padding: canVoteThis ? '12px 14px' : '8px 12px',
                  cursor: canVoteThis ? 'pointer' : 'default',
                  transition: 'background 0.15s, border 0.15s, padding 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontSize: canVoteThis ? 16 : 13,
                    fontWeight: canVoteThis || isMe ? 'bold' : 'normal',
                    color: isMe ? '#4488ff' : myVoteTarget ? '#ff8888' : '#cde',
                    transition: 'font-size 0.15s',
                  }}>
                    {isMe ? '▶ ' : ''}{p.name}
                  </span>
                  {revealedThisPlayer && (
                    <span style={{ fontSize: 10, color: '#ffcc00', letterSpacing: 1 }}>ROLE: {p.role}</span>
                  )}
                  {phase === 'CHAT' && detectiveCanReveal && !isMe && (
                    <button
                      onClick={(e) => { e.stopPropagation(); useDetectiveReveal(p.id) }}
                      style={{
                        background: 'rgba(255,204,0,0.15)', border: '1px solid #ffcc00',
                        borderRadius: 4, color: '#ffcc00', fontFamily: 'monospace',
                        fontSize: 10, padding: '2px 7px', cursor: 'pointer', marginTop: 2, width: 'fit-content',
                      }}
                    >
                      🔍 Reveal
                    </button>
                  )}
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {totalVotes > 0 && (
                    <span style={{ fontSize: 13, color: '#ff6666', fontWeight: 'bold' }}>
                      {totalVotes}🗳
                    </span>
                  )}
                  {canVoteThis && (
                    <div style={{ fontSize: 10, color: '#556', marginTop: 2 }}>tap to vote</div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Skip button */}
          {phase === 'VOTING' && !playerVote && (
            <button
              onClick={skipVote}
              style={{
                background: 'transparent', border: '1px dashed #334',
                borderRadius: 6, color: '#445', fontFamily: 'monospace',
                fontSize: 12, padding: '10px', cursor: 'pointer', marginTop: 4,
              }}
            >
              Skip Vote
            </button>
          )}

          {phase === 'VOTING' && playerVote && (
            <div style={{ fontSize: 13, color: '#88aacc', marginTop: 10, textAlign: 'center', opacity: 0.8 }}>
              {playerVote === 'SKIP' ? '— Skipped —' : '✓ Vote cast'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
