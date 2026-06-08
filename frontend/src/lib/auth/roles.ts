export type UserRole = 'user' | 'admin' | 'super_admin'

const ROLE_LEVELS: Record<UserRole, number> = {
  user: 0,
  admin: 1,
  super_admin: 2,
}

type ProtectedRoute = {
  path: string
  minimumRole: UserRole
}

const PROTECTED_ROUTES: ProtectedRoute[] = [
  { path: '/advanced', minimumRole: 'super_admin' },
  { path: '/settings/api-keys', minimumRole: 'admin' },
  { path: '/settings', minimumRole: 'admin' },
  { path: '/transformations', minimumRole: 'admin' },
]

export function normalizeUserRole(role?: string | null): UserRole {
  const normalized = String(role || '').trim().toLowerCase()
  if (normalized === 'superadmin') return 'super_admin'
  if (normalized === 'super_admin' || normalized === 'admin' || normalized === 'user') {
    return normalized
  }
  return 'user'
}

export function hasRoleAccess(role: string | null | undefined, minimumRole: UserRole): boolean {
  const currentRole = normalizeUserRole(role)
  return ROLE_LEVELS[currentRole] >= ROLE_LEVELS[minimumRole]
}

export function canAccessPath(role: string | null | undefined, path: string): boolean {
  const currentRole = normalizeUserRole(role)
  const matchedRoute = [...PROTECTED_ROUTES]
    .sort((a, b) => b.path.length - a.path.length)
    .find((route) => path === route.path || path.startsWith(`${route.path}/`))

  if (!matchedRoute) return true
  return hasRoleAccess(currentRole, matchedRoute.minimumRole)
}

export function getDefaultRouteForRole(role: string | null | undefined): string {
  if (hasRoleAccess(role, 'admin')) return '/dashboard'
  return '/dashboard'
}

export function getRoleLabel(role: string | null | undefined): string {
  const normalized = normalizeUserRole(role)
  if (normalized === 'super_admin') return 'Super Admin'
  if (normalized === 'admin') return 'Admin'
  return 'User'
}
