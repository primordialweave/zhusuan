import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/** Own scroll restoration for the desktop shell's persistent scroll container. */
export function useRouteScroll(scrollRef: RefObject<HTMLElement | null>) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const previous = useRef<{ key: string; page: string } | null>(null)
  const keyboardNavigation = useRef(false)
  // Calendar's full list is a separate screen; its date/filter changes are not.
  const page = `${location.pathname}:${new URLSearchParams(location.search).get('view') ?? ''}`

  useLayoutEffect(() => {
    const useKeyboard = () => {
      keyboardNavigation.current = true
    }
    const usePointer = () => {
      keyboardNavigation.current = false
    }
    document.addEventListener('keydown', useKeyboard, true)
    document.addEventListener('pointerdown', usePointer, true)
    return () => {
      document.removeEventListener('keydown', useKeyboard, true)
      document.removeEventListener('pointerdown', usePointer, true)
    }
  }, [])

  useLayoutEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return

    const last = previous.current
    const changingPage = last !== null && last.page !== page
    const target =
      navigationType === 'POP'
        ? (positions.current.get(location.key) ?? 0)
        : changingPage
          ? 0
          : scroll.scrollTop
    previous.current = { key: location.key, page }

    let restoring = navigationType === 'POP' && target > 0
    let observer: ResizeObserver | undefined
    const restore = () => {
      scroll.scrollTop = target
      if (scroll.scrollHeight - scroll.clientHeight >= target) {
        restoring = false
        observer?.disconnect()
      }
    }
    const stopRestoring = () => {
      restoring = false
      observer?.disconnect()
    }
    const remember = () => {
      if (!restoring) positions.current.set(location.key, scroll.scrollTop)
    }

    restore()
    // A returning page may fetch its content after the first layout pass.
    if (restoring && typeof ResizeObserver !== 'undefined' && scroll.firstElementChild) {
      observer = new ResizeObserver(restore)
      observer.observe(scroll.firstElementChild)
    }
    if (changingPage && navigationType !== 'POP' && keyboardNavigation.current) {
      const heading = scroll.querySelector<HTMLElement>('h1') ?? scroll
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
      if (heading.tagName === 'H1') heading.setAttribute('data-route-focus', '')
      heading.focus({ preventScroll: true })
    }

    scroll.addEventListener('scroll', remember, { passive: true })
    scroll.addEventListener('wheel', stopRestoring, { passive: true })
    scroll.addEventListener('touchstart', stopRestoring, { passive: true })
    scroll.addEventListener('keydown', stopRestoring)
    if (!restoring) remember()
    if (positions.current.size > 100) {
      const oldest = positions.current.keys().next().value
      if (oldest !== undefined) positions.current.delete(oldest)
    }

    return () => {
      observer?.disconnect()
      scroll.removeEventListener('scroll', remember)
      scroll.removeEventListener('wheel', stopRestoring)
      scroll.removeEventListener('touchstart', stopRestoring)
      scroll.removeEventListener('keydown', stopRestoring)
    }
  }, [location.key, navigationType, page, scrollRef])
}
