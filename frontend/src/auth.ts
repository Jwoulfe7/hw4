// Who's logged in, shared across the app. The session lives in an HttpOnly cookie
// set by the backend, so this code never sees or stores a token or password.

import { createContext, useContext } from 'react'

export type User = {
  id: number
  first_name: string
  last_name: string
  email: string
}

export type SignupInput = {
  first_name: string
  last_name: string
  email: string
  password: string
  confirm_password: string
}

export type AuthState = {
  user: User | null
  /** False until we've asked the backend whether a session already exists. */
  ready: boolean
  login: (email: string, password: string) => Promise<User>
  signup: (input: SignupInput) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const detail = typeof data?.detail === 'string' ? data.detail : 'Something went wrong. Please try again.'
    throw new Error(detail)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
