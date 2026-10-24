import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Start each new page at the top, as a normal website does. Filter changes
// on /products only touch the query string, so they don't jump.
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
