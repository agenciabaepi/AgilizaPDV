import { useEffect, useState } from 'react'

function getScrollY() {
  const root = document.getElementById('root')
  return Math.max(
    window.scrollY,
    document.documentElement.scrollTop,
    document.body.scrollTop,
    root?.scrollTop ?? 0
  )
}

export function useLandingNav() {
  const [navSolid, setNavSolid] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('landing-route')

    const updateNav = () => {
      setNavSolid(getScrollY() > 12)
    }

    updateNav()
    window.addEventListener('scroll', updateNav, { passive: true })
    const root = document.getElementById('root')
    root?.addEventListener('scroll', updateNav, { passive: true })

    return () => {
      document.documentElement.classList.remove('landing-route')
      window.removeEventListener('scroll', updateNav)
      root?.removeEventListener('scroll', updateNav)
    }
  }, [])

  return { navSolid }
}
