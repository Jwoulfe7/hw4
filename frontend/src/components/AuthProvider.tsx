import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, postJson, type SignupInput, type User } from '../auth'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? (res.json() as Promise<User>) : null))
      .then(setUser, () => setUser(null))
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const u = await postJson<User>('/api/auth/login', { email, password })
    setUser(u)
    return u
  }, [])

  const signup = useCallback(async (input: SignupInput) => {
    const u = await postJson<User>('/api/auth/signup', input)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    await postJson<void>('/api/auth/logout')
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, ready, login, signup, logout }), [user, ready, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
