export type Role = 'INNOCENT' | 'TRAITOR' | 'DETECTIVE'

export function assignRoles(count: number): Role[] {
  const roles: Role[] = []

  // 1 detective always
  roles.push('DETECTIVE')

  // 30% traitors of remaining slots, minimum 2
  const traitorCount = Math.max(2, Math.floor((count - 1) * 0.3))

  for (let i = 0; i < traitorCount; i++) roles.push('TRAITOR')
  while (roles.length < count) roles.push('INNOCENT')

  // Shuffle
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[roles[i], roles[j]] = [roles[j], roles[i]]
  }

  return roles
}
