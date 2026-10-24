import { useState } from 'react'

export const THREADS = [
  { key: 'gold', label: 'Gold thread' },
  { key: 'white', label: 'White thread' },
  { key: 'red', label: 'Nantucket red' },
] as const
export type Thread = (typeof THREADS)[number]['key']

export function useMonogram() {
  const [letters, setLetters] = useState('')
  const [thread, setThread] = useState<Thread>('gold')
  return { letters, setLetters, thread, setThread }
}

export type MonogramState = ReturnType<typeof useMonogram>
