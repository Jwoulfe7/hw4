import { useEffect, useRef } from 'react'

// A length of rope across the top of the page that pays out as you scroll.
export default function RopeProgress() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const pct = max > 0 ? Math.min(1, window.scrollY / max) : 0
      if (ref.current) ref.current.style.transform = `scaleX(${pct})`
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return (
    <div className="rope-progress" aria-hidden="true">
      <div className="rope-progress-fill" ref={ref} />
    </div>
  )
}
