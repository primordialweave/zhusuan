import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Events, Window } from '@wailsio/runtime'
import { useToastStore } from '@/composables/useToast'
import { Image, WindowControlButton } from '@/design-system'
import { handleWindowDragRegionDoubleClick } from './windowDrag'
import './window-titlebar.css'

function isWindowsDesktop() {
  return (
    (window as typeof window & { _wails?: { environment?: { OS?: string } } })._wails?.environment
      ?.OS === 'windows'
  )
}

function WindowControlIcon({
  kind,
}: {
  kind: 'minimise' | 'maximise' | 'restore' | 'close' | 'fullscreen' | 'exit-fullscreen'
}) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeWidth="1.3"
      viewBox="0 0 16 16"
    >
      {kind === 'minimise' ? <path d="M3 8.5h10" /> : null}
      {kind === 'maximise' ? <rect height="9" width="9" x="3.5" y="3.5" /> : null}
      {kind === 'restore' ? <path d="M5.5 3.5v-1h8v8h-1m-10-5h8v8h-8z" /> : null}
      {kind === 'close' ? <path d="m3.5 3.5 9 9m0-9-9 9" /> : null}
      {kind === 'fullscreen' ? (
        <path d="M6 2.5H2.5V6M10 2.5h3.5V6M2.5 10v3.5H6M10 13.5h3.5V10" />
      ) : null}
      {kind === 'exit-fullscreen' ? (
        <path d="M2.5 6H6V2.5M10 2.5V6h3.5M6 13.5V10H2.5M13.5 10H10v3.5" />
      ) : null}
    </svg>
  )
}

function WindowsTitleBar() {
  const [state, setState] = useState({ maximised: false, fullscreen: false })
  const fullscreenRef = useRef(false)
  const mounted = useRef(false)
  const querySequence = useRef(0)
  const actionPending = useRef(false)

  const refresh = useCallback(async () => {
    const sequence = ++querySequence.current
    const [maximised, fullscreen] = await Promise.all([Window.IsMaximised(), Window.IsFullscreen()])
    if (!mounted.current || sequence !== querySequence.current) return
    fullscreenRef.current = fullscreen
    setState({ maximised, fullscreen })
  }, [])

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (actionPending.current) return
      actionPending.current = true
      try {
        await action()
        await refresh()
      } catch {
        if (mounted.current) useToastStore.getState().error('窗口操作未完成，请重试')
      } finally {
        actionPending.current = false
      }
    },
    [refresh],
  )

  useLayoutEffect(() => {
    document.documentElement.dataset.desktopPlatform = 'windows'
    return () => {
      delete document.documentElement.dataset.desktopPlatform
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const update = () => {
      void refresh().catch(() => {})
    }
    const names = [
      Events.Types.Common.WindowMaximise,
      Events.Types.Common.WindowUnMaximise,
      Events.Types.Common.WindowRestore,
      Events.Types.Common.WindowFullscreen,
      Events.Types.Common.WindowUnFullscreen,
    ]
    const unsubscribe = names.map((name) => Events.On(name, update))
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      if (event.key === 'F11') {
        event.preventDefault()
        void run(Window.ToggleFullscreen)
      } else if (event.key === 'Escape' && fullscreenRef.current) {
        event.preventDefault()
        void run(Window.UnFullscreen)
      }
    }
    document.addEventListener('keydown', handleKey)
    update()
    return () => {
      mounted.current = false
      unsubscribe.forEach((off) => off())
      document.removeEventListener('keydown', handleKey)
    }
  }, [refresh, run])

  return (
    <header className="window-titlebar" data-fullscreen={state.fullscreen || undefined}>
      <div className="window-titlebar__drag" onDoubleClick={handleWindowDragRegionDoubleClick}>
        <span className="window-titlebar__icon">
          <Image
            alt=""
            background="transparent"
            disableAnimation
            draggable={false}
            fit="contain"
            radius="none"
            showSkeleton={false}
            src="/zhusuan.png"
          />
        </span>
        <span className="window-titlebar__name">珠算</span>
      </div>
      <div aria-label="窗口控制" className="window-titlebar__controls" role="group">
        <WindowControlButton
          data-window-control="fullscreen"
          label={state.fullscreen ? '退出全屏' : '全屏'}
          onClick={() => void run(Window.ToggleFullscreen)}
          title={state.fullscreen ? '退出全屏 (F11 / Esc)' : '全屏 (F11)'}
        >
          <WindowControlIcon kind={state.fullscreen ? 'exit-fullscreen' : 'fullscreen'} />
        </WindowControlButton>
        <WindowControlButton
          data-window-control="minimise"
          label="最小化"
          onClick={() => void run(Window.Minimise)}
          title="最小化"
        >
          <WindowControlIcon kind="minimise" />
        </WindowControlButton>
        <WindowControlButton
          data-window-control="maximise"
          disabled={state.fullscreen}
          label={state.maximised ? '还原' : '最大化'}
          onClick={() => void run(Window.ToggleMaximise)}
          title={state.maximised ? '还原' : '最大化'}
        >
          <WindowControlIcon kind={state.maximised ? 'restore' : 'maximise'} />
        </WindowControlButton>
        <WindowControlButton
          data-window-control="close"
          tone="danger"
          label="关闭窗口"
          onClick={() => void run(Window.Close)}
          title="关闭窗口"
        >
          <WindowControlIcon kind="close" />
        </WindowControlButton>
      </div>
    </header>
  )
}

/** Window controls also remain available on the login and not-found pages. */
export default function WindowTitleBar() {
  return isWindowsDesktop() ? <WindowsTitleBar /> : null
}
