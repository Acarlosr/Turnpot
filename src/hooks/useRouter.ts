/**
 * Minimal client-side router.
 * Reads window.location.pathname and drives navigation via History API.
 * Listens to popstate so the back button works.
 */
import { useState, useEffect, useCallback } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'my-pots' }
  | { name: 'how-to' }
  | { name: 'create' }
  | { name: 'pot'; potId: bigint }
  | { name: 'deploy' }

function parsePath(pathname: string): Route {
  if (pathname === '/create')  return { name: 'create' }
  if (pathname === '/deploy')  return { name: 'deploy' }
  if (pathname === '/my-pots') return { name: 'my-pots' }
  if (pathname === '/how-to')  return { name: 'how-to' }
  const potMatch = pathname.match(/^\/pot\/(\d+)$/)
  if (potMatch) return { name: 'pot', potId: BigInt(potMatch[1]) }
  return { name: 'home' }
}

function routeToPath(route: Route): string {
  switch (route.name) {
    case 'home':    return '/'
    case 'my-pots': return '/my-pots'
    case 'how-to':  return '/how-to'
    case 'create':  return '/create'
    case 'deploy':  return '/deploy'
    case 'pot':     return `/pot/${route.potId}`
  }
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() =>
    parsePath(window.location.pathname),
  )

  useEffect(() => {
    function onPop() {
      setRoute(parsePath(window.location.pathname))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((target: Route | string) => {
    const path = typeof target === 'string' ? target : routeToPath(target)
    const next = typeof target === 'string' ? parsePath(target) : target
    window.history.pushState(null, '', path)
    setRoute(next)
  }, [])

  const goHome = useCallback(() => navigate({ name: 'home' }), [navigate])

  return { route, navigate, goHome }
}
