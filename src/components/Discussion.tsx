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

export default function Discussion({ gsm, players, playerRole, onVotingDone }: Props) {
  const [phase, setPhase] = useState<'CHAT' | 'VOTING'>('CHAT')
  const [messages, setMessages] = useState<Array<{ author: string; text: string; key: number }>>([])
  const [votes, setVotes] = useState<Record<string, string>>({})
  const [playerVote, setPlayerVote] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(60)
  const [revealedRole, setRevealedRole] = useState<{ name: string; role: Role } | null>(null)
  const [chatInput, setChatInput] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)
  const keyRef = useRef(0)

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  // Timer countdown
  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(iv)
          if (phase === 'CHAT') {
            setPhase('VOTING')
            setTimeLeft(30)
            gsm.startVoting()
            // NPC votes
            scheduleNPCVotes()
          } else {
            // Resolve vote
            const ejected = gsm.resolveVote()
            onVotingDone(ejected)
          }
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [phase]) // eslint-disable-line

  // NPC auto-chat during discussion
  useEffect(() => {
    if (phase !== 'CHAT') return
    const aliveNPCs = players.filter((p) => !p.isHuman && p.alive)

    const timeouts: ReturnType<typeof setTimeout>[] = []
    aliveNPCs.slice(0, 5).forEach((npc, i) => {
      const delay = 3000 + i * 5000 + Math.random() * 3000
      timeouts.push(
        setTimeout(() => {
          const text = NPC_COMMENTS[Math.floor(Math.random() * NPC_COMMENTS.length)]
          setMessages((m) => [...m, { author: npc.name, text, key: keyRef.current++ }])
          gsm.addChatMessage(npc.name, text)
        }, delay),
      )
    })

    return () => timeouts.forEach(clearTimeout)
  }, [phase]) // eslint-disable-line

  function scheduleNPCVotes() {
    const aliveNPCs = players.filter((p) => !p.isHuman && p.alive)
    const targets = players.filter((p) => p.alive)

    aliveNPCs.forEach((npc, i) => {
      setTimeout(() => {
        // Traitors don't vote for each other
        const pool = npc.role === 'TRAITOR'
          ? targets.filter((t) => t.role !== 'TRAITOR' && t.alive)
          : targets.filter((t) => t.id !== npc.id && t.alive)

        if (pool.length === 0) return
        const target = pool[Math.floor(Math.random() * pool.length)]
        gsm.vote(npc.id, target.id)
        setVotes((v) => ({ ...v, [npc.id]: target.id }))
      }, 1000 + i * 1200)
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

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(4,8,16,0.95)',
        zIndex: 400,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        color: '#fff',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#0a0f1e',
          borderBottom: '1px solid #223',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 3, color: phase === 'CHAT' ? '#ffcc00' : '#ff4444' }}>
            {phase === 'CHAT' ? '⚠ BODY REPORTED' : '🗳 VOTING'}
          </span>
          <span style={{ fontSize: 12, opacity: 0.5, marginLeft: 16 }}>
            {gsm.discussion?.bodyOf} was found dead
          </span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: timeLeft < 10 ? '#ff4444' : '#fff' }}>
          {timeLeft}s
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Chat / Voting left panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #223' }}>
          {/* Messages */}
          <div
            ref={chatRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {messages.map((msg) => (
              <div key={msg.key} style={{ fontSize: 13, lineHeight: 1.5 }}>
                <span style={{ color: msg.author === 'You' ? '#4488ff' : msg.author === '📋 DETECTIVE' ? '#ffcc00' : '#88aacc', fontWeight: 'bold' }}>
                  {msg.author}:
                </span>{' '}
                <span style={{ opacity: 0.85 }}>{msg.text}</span>
              </div>
            ))}
          </div>

          {/* Chat input */}
          {phase === 'CHAT' && (
            <form onSubmit={sendChat} style={{ display: 'flex', borderTop: '1px solid #223', padding: 8, gap: 8 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Say something..."
                style={{
                  flex: 1,
                  background: '#0a0f1e',
                  border: '1px solid #334',
                  borderRadius: 4,
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  padding: '6px 10px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#1a2840',
                  border: '1px solid #4488ff',
                  borderRadius: 4,
                  color: '#4488ff',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
              >
                Send
              </button>
            </form>
          )}
        </div>

        {/* Right: player list + vote/accuse */}
        <div style={{ width: 260, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.5, marginBottom: 4 }}>
            {phase === 'VOTING' ? 'VOTE TO EJECT' : 'PLAYERS'}
          </div>

          {alivePlayers.map((p) => {
            const isMe = p.isHuman
            const myVoteTarget = votes['human'] === p.id
            const totalVotes = Object.values(votes).filter((v) => v === p.id).length
            const revealedThisPlayer = revealedRole?.name === p.name

            return (
              <div
                key={p.id}
                style={{
                  background: myVoteTarget ? 'rgba(255,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                  border: myVoteTarget ? '1px solid #ff4444' : '1px solid #223',
                  borderRadius: 6,
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: isMe ? '#4488ff' : '#cdd', fontWeight: isMe ? 'bold' : 'normal', fontSize: 13 }}>
                    {isMe ? '▶ ' : ''}{p.name}
                  </span>
                  {totalVotes > 0 && (
                    <span style={{ fontSize: 11, color: '#ff8888', fontWeight: 'bold' }}>
                      {totalVotes} vote{totalVotes > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {revealedThisPlayer && (
                  <div style={{ fontSize: 10, color: '#ffcc00', letterSpacing: 1 }}>
                    ROLE: {p.role}
                  </div>
                )}

                {phase === 'VOTING' && !isMe && !playerVote && (
                  <button
                    onClick={() => castVote(p.id)}
                    style={{
                      background: 'rgba(255,68,68,0.2)',
                      border: '1px solid #ff4444',
                      borderRadius: 4,
                      color: '#ff8888',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      padding: '3px 8px',
                      cursor: 'pointer',
                      marginTop: 2,
                    }}
                  >
                    Vote Eject
                  </button>
                )}

                {phase === 'CHAT' && detectiveCanReveal && !isMe && (
                  <button
                    onClick={() => useDetectiveReveal(p.id)}
                    style={{
                      background: 'rgba(255,204,0,0.15)',
                      border: '1px solid #ffcc00',
                      borderRadius: 4,
                      color: '#ffcc00',
                      fontFamily: 'monospace',
                      fontSize: 10,
                      padding: '3px 8px',
                      cursor: 'pointer',
                      marginTop: 2,
                    }}
                  >
                    🔍 Reveal Role
                  </button>
                )}
              </div>
            )
          })}

          {phase === 'VOTING' && playerVote && (
            <div style={{ fontSize: 12, color: '#88aacc', marginTop: 8, textAlign: 'center', opacity: 0.7 }}>
              Vote cast. Waiting...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
