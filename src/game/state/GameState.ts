import { assignRoles, type Role } from '../roles/RoleSystem'

export type { Role }

export type Phase =
  | 'ROLE_REVEAL'
  | 'PLAYING'
  | 'DISCUSSION'
  | 'VOTING'
  | 'RESULT'
  | 'GAME_OVER'

export type MissionType =
  | 'HACK_TERMINAL'
  | 'FIX_GENERATOR'
  | 'REPAIR_PANEL'
  | 'UPLOAD_DATA'
  | 'SCAN_ID'

export type SabotageType = 'BLACKOUT' | 'LOCK_DOORS' | 'REACTOR_MELTDOWN'

export interface PlayerData {
  id: string
  name: string
  role: Role
  alive: boolean
  position: { x: number; z: number }
  isHuman: boolean
  /** Detective reveal used */
  revealUsed?: boolean
}

export interface MissionData {
  id: string
  type: MissionType
  label: string
  position: { x: number; z: number }
  completed: boolean
  /** NPC currently working on it */
  workedBy?: string
}

export interface BodyData {
  id: string
  playerId: string
  playerName: string
  position: { x: number; z: number }
  reported: boolean
}

export interface ChatMessage {
  author: string
  text: string
  ts: number
}

export interface DiscussionData {
  phase: 'CHAT' | 'VOTING'
  messages: ChatMessage[]
  accusations: Record<string, string>   // accuserId → accusedId
  votes: Record<string, string>          // voterId → targetId
  endsAt: number                         // Date.now() + duration
  reportedBy: string
  bodyOf: string
  revealedRole?: { name: string; role: Role }
}

export interface SabotageState {
  type: SabotageType
  active: boolean
  endsAt: number          // when the effect ends (0 if not active)
  cooldownEndsAt: number  // when it can be used again
}

const MISSION_DEFS: Array<{ type: MissionType; label: string; x: number; z: number }> = [
  { type: 'HACK_TERMINAL',  label: 'Hack Terminal',   x: -3,  z: -3 },
  { type: 'FIX_GENERATOR',  label: 'Fix Generator',   x: -9,  z: -9 },
  { type: 'REPAIR_PANEL',   label: 'Repair Panel',    x: -9,  z:  3 },
  { type: 'UPLOAD_DATA',    label: 'Upload Data',     x:  3,  z:  3 },
  { type: 'SCAN_ID',        label: 'Scan ID',         x:  9,  z: -1 },
]

export class GameStateManager extends EventTarget {
  phase: Phase = 'ROLE_REVEAL'
  playerRole: Role = 'INNOCENT'
  playerName = 'You'
  players: PlayerData[] = []
  missions: MissionData[] = []
  missionProgress = 0
  bodies: BodyData[] = []
  activeBlackout = false
  lockedRoomId: string | null = null
  reactorMeltdown: { active: boolean; endsAt: number } | null = null
  discussion: DiscussionData | null = null
  winner: 'INNOCENT' | 'TRAITOR' | null = null

  sabotages: SabotageState[] = [
    { type: 'BLACKOUT',          active: false, endsAt: 0, cooldownEndsAt: 0 },
    { type: 'LOCK_DOORS',        active: false, endsAt: 0, cooldownEndsAt: 0 },
    { type: 'REACTOR_MELTDOWN',  active: false, endsAt: 0, cooldownEndsAt: 0 },
  ]

  // ── Initialisation ────────────────────────────────────────────────────────

  init(npcNames: string[]) {
    const totalCount = 1 + npcNames.length
    const roles = assignRoles(totalCount)

    // Human player gets first role slot
    this.playerRole = roles[0]

    this.players = [
      {
        id: 'human',
        name: this.playerName,
        role: roles[0],
        alive: true,
        position: { x: 0, z: 0 },
        isHuman: true,
      },
      ...npcNames.map((name, i) => ({
        id: `npc-${i}`,
        name,
        role: roles[i + 1],
        alive: true,
        position: { x: 0, z: 0 },
        isHuman: false,
      })),
    ]

    this.missions = MISSION_DEFS.map((def) => ({
      id: def.type,
      type: def.type,
      label: def.label,
      position: { x: def.x, z: def.z },
      completed: false,
    }))

    this.missionProgress = 0
    this.bodies = []
    this.discussion = null
    this.winner = null
    this.phase = 'ROLE_REVEAL'

    this.dispatch('state_changed')
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getPlayer(id: string) {
    return this.players.find((p) => p.id === id)
  }

  aliveCount() {
    return this.players.filter((p) => p.alive).length
  }

  aliveTraitorCount() {
    return this.players.filter((p) => p.alive && p.role === 'TRAITOR').length
  }

  aliveInnocentCount() {
    return this.players.filter(
      (p) => p.alive && (p.role === 'INNOCENT' || p.role === 'DETECTIVE'),
    ).length
  }

  getMissionDefs() {
    return MISSION_DEFS
  }

  // ── Phase transitions ─────────────────────────────────────────────────────

  startPlaying() {
    this.phase = 'PLAYING'
    this.dispatch('phase_changed')
    this.dispatch('state_changed')
  }

  startDiscussion(reportedBy: string, bodyOf: string) {
    if (this.phase !== 'PLAYING') return
    this.phase = 'DISCUSSION'
    this.discussion = {
      phase: 'CHAT',
      messages: [],
      accusations: {},
      votes: {},
      endsAt: Date.now() + 60_000,
      reportedBy,
      bodyOf,
    }
    this.dispatch('discussion_started')
    this.dispatch('state_changed')
  }

  startVoting() {
    if (!this.discussion) return
    this.phase = 'VOTING'
    this.discussion.phase = 'VOTING'
    this.discussion.endsAt = Date.now() + 30_000
    this.dispatch('voting_started')
    this.dispatch('state_changed')
  }

  addChatMessage(author: string, text: string) {
    if (!this.discussion) return
    this.discussion.messages.push({ author, text, ts: Date.now() })
    this.dispatch('chat_message')
    this.dispatch('state_changed')
  }

  vote(voterId: string, targetId: string) {
    if (!this.discussion || this.discussion.phase !== 'VOTING') return
    this.discussion.votes[voterId] = targetId
    this.dispatch('state_changed')
  }

  resolveVote(): string | null {
    if (!this.discussion) return null

    const tally: Record<string, number> = {}
    for (const targetId of Object.values(this.discussion.votes)) {
      tally[targetId] = (tally[targetId] ?? 0) + 1
    }

    let maxVotes = 0
    let ejected: string | null = null
    let tie = false

    for (const [id, count] of Object.entries(tally)) {
      if (count > maxVotes) { maxVotes = count; ejected = id; tie = false }
      else if (count === maxVotes) { tie = true }
    }

    if (tie) ejected = null

    if (ejected) {
      const p = this.getPlayer(ejected)
      if (p) p.alive = false
    }

    this.phase = 'RESULT'
    this.dispatch('vote_resolved')
    this.dispatch('state_changed')

    return ejected
  }

  revealRole(targetId: string) {
    const p = this.getPlayer(targetId)
    const detective = this.players.find(
      (pl) => pl.role === 'DETECTIVE' && (pl.isHuman || true),
    )
    if (!p || !detective || detective.revealUsed) return null
    detective.revealUsed = true
    if (this.discussion) {
      this.discussion.revealedRole = { name: p.name, role: p.role }
    }
    this.dispatch('state_changed')
    return { name: p.name, role: p.role }
  }

  backToPlaying() {
    this.phase = 'PLAYING'
    this.discussion = null
    this.dispatch('phase_changed')
    this.dispatch('state_changed')
    this.checkVictory()
  }

  // ── Missions ──────────────────────────────────────────────────────────────

  completeMission(missionId: string) {
    const m = this.missions.find((ms) => ms.id === missionId)
    if (!m || m.completed) return
    m.completed = true
    const done = this.missions.filter((ms) => ms.completed).length
    this.missionProgress = Math.round((done / this.missions.length) * 100)
    this.dispatch('mission_complete')
    this.dispatch('state_changed')
    this.checkVictory()
  }

  // ── Eliminations ──────────────────────────────────────────────────────────

  eliminatePlayer(id: string) {
    const p = this.getPlayer(id)
    if (!p || !p.alive) return
    p.alive = false
    this.dispatch('player_eliminated')
    this.dispatch('state_changed')
    this.checkVictory()
  }

  addBody(body: BodyData) {
    this.bodies.push(body)
    this.dispatch('state_changed')
  }

  reportBody(bodyId: string) {
    const b = this.bodies.find((bd) => bd.id === bodyId)
    if (!b || b.reported) return
    b.reported = true
    this.dispatch('state_changed')
  }

  // ── Sabotage ──────────────────────────────────────────────────────────────

  activateSabotage(type: SabotageType) {
    const s = this.sabotages.find((sb) => sb.type === type)
    if (!s || s.active || Date.now() < s.cooldownEndsAt) return false
    s.active = true

    if (type === 'BLACKOUT') {
      this.activeBlackout = true
      s.endsAt = Date.now() + 10_000
    } else if (type === 'LOCK_DOORS') {
      this.lockedRoomId = 'main'
      s.endsAt = Date.now() + 15_000
    } else if (type === 'REACTOR_MELTDOWN') {
      this.reactorMeltdown = { active: true, endsAt: Date.now() + 30_000 }
      s.endsAt = Date.now() + 30_000
    }

    this.dispatch('sabotage_activated')
    this.dispatch('state_changed')
    return true
  }

  tickSabotages() {
    const now = Date.now()
    let changed = false

    for (const s of this.sabotages) {
      if (!s.active) continue
      if (now >= s.endsAt) {
        s.active = false
        s.cooldownEndsAt = now + 30_000

        if (s.type === 'BLACKOUT') this.activeBlackout = false
        if (s.type === 'LOCK_DOORS') this.lockedRoomId = null
        if (s.type === 'REACTOR_MELTDOWN') {
          if (this.reactorMeltdown?.active) {
            // Timer expired → Traitors win
            this.reactorMeltdown = null
            this.winner = 'TRAITOR'
            this.phase = 'GAME_OVER'
            this.dispatch('game_over')
          }
        }
        changed = true
      }
    }

    if (changed) this.dispatch('state_changed')
  }

  stopReactorMeltdown() {
    const s = this.sabotages.find((sb) => sb.type === 'REACTOR_MELTDOWN')
    if (!s || !s.active) return
    s.active = false
    s.cooldownEndsAt = Date.now() + 30_000
    this.reactorMeltdown = null
    this.dispatch('state_changed')
  }

  // ── Victory ───────────────────────────────────────────────────────────────

  checkVictory() {
    if (this.phase === 'GAME_OVER') return

    // Traitors win: equal or outnumber innocents
    if (this.aliveTraitorCount() >= this.aliveInnocentCount()) {
      this.winner = 'TRAITOR'
      this.phase = 'GAME_OVER'
      this.dispatch('game_over')
      this.dispatch('state_changed')
      return
    }

    // Traitors eliminated
    if (this.aliveTraitorCount() === 0) {
      this.winner = 'INNOCENT'
      this.phase = 'GAME_OVER'
      this.dispatch('game_over')
      this.dispatch('state_changed')
      return
    }

    // All missions done
    if (this.missionProgress >= 100) {
      this.winner = 'INNOCENT'
      this.phase = 'GAME_OVER'
      this.dispatch('game_over')
      this.dispatch('state_changed')
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private dispatch(name: string) {
    this.dispatchEvent(new CustomEvent(name))
  }
}
