import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Events } from '@wailsio/runtime'
import { useThemePackAssets } from '@/components/scene/useThemePackAssets'
import {
  Button,
  Chip,
  IconButton,
  Image,
  JadeIcon,
  JadeIconDefs,
  SegmentedControl,
  Skeleton,
} from '@/design-system'
import { useAppearanceStore } from '@/stores/appearance'
import { useThemeStore } from '@/stores/theme'
import {
  DAY_CHANGED_DOM_EVENT,
  DESKTOP_EVENTS,
  desktopManager,
  extractWailsEventPayload,
  type MenuBarScope,
  type MenuBarSnapshot,
  type MenuBarTrendPoint,
} from '@/utils/desktopManager'
import { formatAmount, maskAmount } from '@/utils/format'
import '@/styles/menubar-popover.css'

const SCOPES: ReadonlyArray<{ value: MenuBarScope; label: string; headline: string }> = [
  { value: 'month', label: '本月', headline: '本月实收' },
  { value: 'year', label: '本年', headline: '本年实收' },
  { value: 'all', label: '全部', headline: '累计实收' },
]

// Two-tone jade bangle geometry in a 100x100 box (outer r=46, inner r=35, centerline r=40.5, width=11).
const RING_RADIUS = 40.5
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function CollectionRing({ percent }: { percent: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const offset = RING_CIRCUMFERENCE * (1 - clamped / 100)

  const paidGradId = `mb-ring-paid-${uid}`
  const pendingGradId = `mb-ring-pending-${uid}`
  const glazeGradId = `mb-ring-glaze-${uid}`
  const ringClipId = `mb-ring-clip-${uid}`

  // Two exact 180° semicircular arcs starting at 12 o'clock (never single-arc 0.01px trick).
  const centerPath = `M 50 ${50 - RING_RADIUS} A ${RING_RADIUS} ${RING_RADIUS} 0 1 1 50 ${
    50 + RING_RADIUS
  } A ${RING_RADIUS} ${RING_RADIUS} 0 1 1 50 ${50 - RING_RADIUS}`

  // Even-odd annulus clip for translucent convex jade glaze over both paid and pending arcs.
  const annulusClipPath =
    'M 50 4 A 46 46 0 1 1 50 96 A 46 46 0 1 1 50 4 Z M 50 15 A 35 35 0 1 1 50 85 A 35 35 0 1 1 50 15 Z'

  return (
    <div aria-label={`合同回款率 ${clamped}%`} className="menubar-ring">
      <svg aria-hidden="true" className="menubar-ring__svg" viewBox="0 0 100 100">
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={paidGradId}
            x1="16"
            x2="84"
            y1="12"
            y2="88"
          >
            <stop className="menubar-ring__stop--paid-light" offset="0%" />
            <stop className="menubar-ring__stop--paid-base" offset="72%" />
            <stop className="menubar-ring__stop--paid-base" offset="100%" />
          </linearGradient>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={pendingGradId}
            x1="16"
            x2="84"
            y1="12"
            y2="88"
          >
            <stop className="menubar-ring__stop--pending" offset="0%" stopOpacity="0.88" />
            <stop className="menubar-ring__stop--pending" offset="100%" stopOpacity="0.62" />
          </linearGradient>
          <radialGradient cx="30" cy="24" gradientUnits="userSpaceOnUse" id={glazeGradId} r="64">
            <stop className="menubar-ring__stop--crest" offset="0%" stopOpacity="0.52" />
            <stop className="menubar-ring__stop--crest" offset="48%" stopOpacity="0.1" />
            <stop className="menubar-ring__stop--shadow" offset="86%" stopOpacity="0.06" />
            <stop className="menubar-ring__stop--shadow" offset="100%" stopOpacity="0.22" />
          </radialGradient>
          <clipPath clipPathUnits="userSpaceOnUse" id={ringClipId}>
            <path clipRule="evenodd" d={annulusClipPath} />
          </clipPath>
        </defs>

        <path className="menubar-ring__track" d={centerPath} stroke={`url(#${pendingGradId})`} />
        {clamped > 0 ? (
          <path
            className="menubar-ring__progress"
            d={centerPath}
            stroke={`url(#${paidGradId})`}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        ) : null}
        <g className="menubar-ring__glaze" clipPath={`url(#${ringClipId})`}>
          <rect fill={`url(#${glazeGradId})`} height="100" width="100" x="0" y="0" />
        </g>
      </svg>
      <div className="menubar-ring__center">
        <span className="menubar-ring__pct">{clamped}%</span>
        <span className="menubar-ring__sub">回款率</span>
      </div>
    </div>
  )
}

interface ChartPoint {
  x: number
  y: number
  label: string
  amount: number
}

function buildSmoothPath(points: readonly ChartPoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`
  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i]!
    const p1 = points[i + 1]!
    const midX = (p0.x + p1.x) / 2
    d += ` C ${midX.toFixed(1)} ${p0.y.toFixed(1)}, ${midX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`
  }
  return d
}

function formatAxisLabel(raw: string): string {
  if (/^\d{4}-\d{2}$/.test(raw)) return `${Number(raw.slice(5))}月`
  if (/^\d{2}-\d{2}$/.test(raw)) return raw
  return raw
}

function TrendSparkline({
  points,
  privacyMode,
  loading = false,
}: {
  points: readonly MenuBarTrendPoint[]
  privacyMode: boolean
  loading?: boolean
}) {
  const gradId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const hasActivity = points.some((item) => item.amount > 0)
  const width = 306
  const height = 76
  const padX = 8
  const padTop = 8
  const padBottom = 6
  const usableW = width - padX * 2
  const usableH = height - padTop - padBottom

  const geometry = useMemo(() => {
    if (points.length === 0) return { coords: [] as ChartPoint[], max: 0 }
    const max = Math.max(...points.map((item) => item.amount), 1)
    const step = points.length > 1 ? usableW / (points.length - 1) : 0
    const coords: ChartPoint[] = points.map((item, idx) => ({
      x: points.length === 1 ? width / 2 : padX + idx * step,
      y: padTop + usableH * (1 - Math.max(0, item.amount) / max),
      label: item.label,
      amount: item.amount,
    }))
    return { coords, max }
  }, [points, usableH, usableW])

  const defaultIndex = useMemo(() => {
    for (let i = points.length - 1; i >= 0; i -= 1) {
      if (points[i]!.amount > 0) return i
    }
    return points.length > 0 ? points.length - 1 : null
  }, [points])

  const activeIndex = hoveredIndex ?? defaultIndex
  const activePoint =
    activeIndex !== null && activeIndex < geometry.coords.length
      ? geometry.coords[activeIndex]!
      : null

  const linePath = buildSmoothPath(geometry.coords)
  const baselineY = height - padBottom
  const areaPath =
    geometry.coords.length > 1
      ? `${linePath} L ${geometry.coords[geometry.coords.length - 1]!.x.toFixed(1)} ${baselineY} L ${geometry.coords[0]!.x.toFixed(1)} ${baselineY} Z`
      : ''

  const colWidth = points.length > 0 ? Math.max(12, usableW / points.length) : usableW
  const barWidth = Math.min(12, Math.max(4, colWidth * 0.42))

  return (
    <section aria-busy={loading} aria-label="实际收款趋势" className="menubar-card menubar-chart">
      <div className="menubar-chart__header">
        <span className="menubar-chart__title">实际收款趋势</span>
        <span className="menubar-chart__readout">
          {activePoint
            ? `${formatAxisLabel(activePoint.label)} · ${maskAmount(formatAmount(activePoint.amount), privacyMode)}`
            : '—'}
        </span>
      </div>

      {loading ? (
        <Skeleton aria-label="正在读取收款趋势" height="4.75rem" />
      ) : !hasActivity ? (
        <div className="menubar-chart__empty">当前周期暂无到账记录</div>
      ) : (
        <>
          <svg
            className="menubar-chart__svg"
            onMouseLeave={() => setHoveredIndex(null)}
            viewBox={`0 0 ${width} ${height}`}
          >
            <defs>
              <linearGradient id={`mb-area-${gradId}`} x1="0" x2="0" y1="0" y2="1">
                <stop className="menubar-chart__area-stop" offset="0%" stopOpacity="0.28" />
                <stop className="menubar-chart__area-stop" offset="100%" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            <line
              className="menubar-chart__grid"
              x1={padX}
              x2={width - padX}
              y1={padTop}
              y2={padTop}
            />
            <line
              className="menubar-chart__grid"
              x1={padX}
              x2={width - padX}
              y1={padTop + usableH / 2}
              y2={padTop + usableH / 2}
            />
            <line
              className="menubar-chart__grid"
              x1={padX}
              x2={width - padX}
              y1={baselineY}
              y2={baselineY}
            />

            {geometry.coords.map((pt, index) => {
              const barH = Math.max(0, baselineY - pt.y)
              return (
                <rect
                  className="menubar-chart__bar"
                  data-active={index === activeIndex ? 'true' : undefined}
                  height={barH}
                  key={pt.label}
                  rx={2}
                  width={barWidth}
                  x={pt.x - barWidth / 2}
                  y={pt.y}
                />
              )
            })}

            {areaPath ? <path d={areaPath} fill={`url(#mb-area-${gradId})`} /> : null}
            {linePath ? <path className="menubar-chart__line" d={linePath} /> : null}

            {activePoint ? (
              <g>
                <line
                  className="menubar-chart__crosshair"
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={padTop}
                  y2={baselineY}
                />
                <circle
                  className="menubar-chart__dot-halo"
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r={6.5}
                />
                <circle
                  className="menubar-chart__dot"
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r={3.2}
                />
              </g>
            ) : null}

            {geometry.coords.map((pt, index) => (
              <rect
                fill="transparent"
                height={height}
                key={`hit-${pt.label}`}
                onMouseEnter={() => setHoveredIndex(index)}
                width={colWidth}
                x={Math.max(0, pt.x - colWidth / 2)}
                y={0}
              />
            ))}
          </svg>

          <div className="menubar-chart__axis">
            <span>{formatAxisLabel(points[0]?.label ?? '')}</span>
            {points.length > 2 ? (
              <span>{formatAxisLabel(points[Math.floor(points.length / 2)]?.label ?? '')}</span>
            ) : null}
            {points.length > 1 ? (
              <span>{formatAxisLabel(points[points.length - 1]?.label ?? '')}</span>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}

export default function MenuBarPopoverView() {
  const initializeTheme = useThemeStore((state) => state.initializeTheme)
  const effectiveThemePack = useThemeStore((state) => state.effectiveThemePack)
  const initializeAppearance = useAppearanceStore((state) => state.initializeAppearance)
  const { assets: packAssets, ready: packReady } = useThemePackAssets(effectiveThemePack)
  const [scope, setScope] = useState<MenuBarScope>('month')
  const [snapshot, setSnapshot] = useState<MenuBarSnapshot | null>(null)
  const mountedRef = useRef(false)
  const scopeRef = useRef(scope)
  const requestRef = useRef(0)

  useLayoutEffect(() => {
    scopeRef.current = scope
    requestRef.current += 1
  }, [scope])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current += 1
    }
  }, [])

  useEffect(() => initializeTheme(), [initializeTheme])
  useEffect(() => initializeAppearance(), [initializeAppearance])

  const loadSnapshot = useCallback(async (targetScope: MenuBarScope) => {
    if (!mountedRef.current || scopeRef.current !== targetScope || !desktopManager.isAvailable())
      return
    const request = ++requestRef.current
    try {
      const next = await desktopManager.getMenuBarSnapshot(targetScope)
      if (
        !mountedRef.current ||
        requestRef.current !== request ||
        scopeRef.current !== targetScope ||
        next.scope !== targetScope
      )
        return
      setSnapshot(next)
    } catch {
      // Preserve last snapshot on transient fetch error.
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSnapshot(scope)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadSnapshot, scope])

  useEffect(() => {
    if (!desktopManager.isAvailable()) return () => {}
    const offUpdated = Events.On(DESKTOP_EVENTS.menuBarUpdated, () => {
      void loadSnapshot(scope)
    })
    const offState = Events.On(DESKTOP_EVENTS.stateChanged, () => {
      void loadSnapshot(scope)
    })
    const offDayChanged = Events.On(DESKTOP_EVENTS.dayChanged, (event) => {
      if (typeof window !== 'undefined') {
        const payload = extractWailsEventPayload<{ date?: string }>(event)
        window.dispatchEvent(new CustomEvent(DAY_CHANGED_DOM_EVENT, { detail: payload }))
      }
      void loadSnapshot(scope)
    })
    return () => {
      offUpdated?.()
      offState?.()
      offDayChanged?.()
    }
  }, [loadSnapshot, scope])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void desktopManager.hideMenuBarPopover().catch(() => {})
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const openRoute = (route: string) => {
    void desktopManager.openRouteFromMenuBar(route).catch(() => {})
  }

  const togglePrivacy = () => {
    const next = !(snapshot?.privacyMode ?? false)
    void desktopManager
      .updatePreferences({ privacyMode: next })
      .then(() => loadSnapshot(scope))
      .catch(() => {})
  }

  const privacyMode = snapshot?.privacyMode ?? false
  const snapshotIsCurrent = snapshot?.scope === scope
  const currentScopeMeta = SCOPES.find((item) => item.value === scope) ?? SCOPES[0]!
  const completionPct =
    snapshot && snapshot.contractTotal > 0
      ? (snapshot.contractReceived / snapshot.contractTotal) * 100
      : 0
  const visibleItems = (snapshot?.items ?? []).slice(0, 2)

  return (
    <main className="menubar-popover">
      <JadeIconDefs />
      {packReady && packAssets?.frostUrl ? (
        <div
          aria-hidden="true"
          className="menubar-popover__backdrop"
          style={{ backgroundImage: `url("${packAssets.frostUrl}")` }}
        />
      ) : null}
      <div aria-hidden="true" className="menubar-popover__veil" />

      <header className="menubar-popover__header">
        <div className="menubar-popover__brandmark">
          <Image
            alt="珠算"
            background="transparent"
            className="menubar-popover__wordmark"
            disableAnimation
            fit="contain"
            radius="none"
            src="/zhusuan-wordmark.png"
          />
        </div>

        {snapshot?.loggedIn ? (
          <SegmentedControl
            aria-label="统计周期"
            onValueChange={(value) => setScope(value)}
            options={SCOPES}
            size="sm"
            value={scope}
          />
        ) : null}

        <div className="menubar-popover__header-actions">
          {snapshot?.loggedIn ? (
            <IconButton
              label={privacyMode ? '显示金额' : '隐藏金额'}
              onClick={togglePrivacy}
              size="sm"
              title={privacyMode ? '显示金额' : '隐私模式'}
              variant="ghost"
            >
              <JadeIcon name={privacyMode ? 'eye-off' : 'eye'} size={15} />
            </IconButton>
          ) : null}
          <IconButton
            label="打开主窗口"
            onClick={() => openRoute('/dashboard')}
            size="sm"
            title="打开珠算"
            variant="ghost"
          >
            <JadeIcon name="arrow-up-right" size={15} />
          </IconButton>
        </div>
      </header>

      {!snapshot?.loggedIn ? (
        <section className="menubar-card menubar-guest">
          <div className="menubar-guest__brandmark">
            <Image
              alt="珠算"
              background="transparent"
              className="menubar-guest__wordmark"
              disableAnimation
              fit="contain"
              radius="none"
              src="/zhusuan-wordmark.png"
            />
          </div>
          <p className="menubar-guest__title">登录珠算查看实时收款与趋势</p>
          <Button onClick={() => openRoute('/login')} size="sm" variant="primary">
            打开珠算登录
          </Button>
        </section>
      ) : (
        <>
          <section aria-label="核心收款概览" className="menubar-card menubar-hero">
            <div className="menubar-hero__copy">
              <span className="menubar-hero__label">
                <span aria-hidden="true" className="menubar-bead menubar-bead--paid" />
                <span>{currentScopeMeta.headline}</span>
              </span>
              <strong className="menubar-hero__amount">
                {snapshotIsCurrent
                  ? maskAmount(formatAmount(snapshot.periodReceived), privacyMode)
                  : '—'}
              </strong>
              <div className="menubar-hero__meta">
                <span className="menubar-hero__pending">
                  <span aria-hidden="true" className="menubar-bead menubar-bead--pending" />
                  <span>待收 {maskAmount(formatAmount(snapshot.totalPending), privacyMode)}</span>
                </span>
                {snapshot.overdueCount > 0 ? (
                  <Chip size="sm" tone="danger">
                    逾期 {snapshot.overdueCount} 笔
                  </Chip>
                ) : snapshot.upcomingCount > 0 ? (
                  <Chip size="sm" tone="accent">
                    近期 {snapshot.upcomingCount} 笔
                  </Chip>
                ) : null}
              </div>
            </div>
            <CollectionRing percent={completionPct} />
          </section>

          <TrendSparkline
            loading={!snapshotIsCurrent}
            points={snapshotIsCurrent ? snapshot.trend : []}
            privacyMode={privacyMode}
          />

          <section aria-label="近期关注款项" className="menubar-card menubar-feed">
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => (
                <Button
                  className="menubar-feed__row"
                  fullWidth
                  key={item.paymentId}
                  onClick={() => openRoute(`/projects/${item.projectId}`)}
                  size="sm"
                  variant="ghost"
                >
                  <span className="menubar-feed__inner">
                    <span className="menubar-feed__left">
                      <span
                        aria-hidden="true"
                        className="menubar-feed__dot"
                        data-overdue={item.overdue ? 'true' : undefined}
                      />
                      <span className="menubar-feed__name">{item.projectName}</span>
                    </span>
                    <span className="menubar-feed__right">
                      <span
                        className="menubar-feed__date"
                        data-overdue={item.overdue ? 'true' : undefined}
                      >
                        {item.overdue ? '已逾期' : item.planDate.slice(5)}
                      </span>
                      <span className="menubar-feed__amount">
                        {maskAmount(formatAmount(item.amount), privacyMode)}
                      </span>
                    </span>
                  </span>
                </Button>
              ))
            ) : (
              <div className="menubar-feed__calm">
                <JadeIcon name="check-circle" size={14} tone="jade" />
                <span>近期无待催收款项</span>
              </div>
            )}
          </section>

          <div className="menubar-actions">
            <Button
              fullWidth
              onClick={() => openRoute('/payment/create')}
              size="sm"
              variant="primary"
            >
              <JadeIcon name="add" size={14} />
              记一笔收款
            </Button>
            <Button
              fullWidth
              onClick={() => openRoute('/projects/create')}
              size="sm"
              variant="secondary"
            >
              <JadeIcon name="folder-open" size={14} />
              新建项目
            </Button>
          </div>
        </>
      )}

      <footer className="menubar-footer">
        <div className="menubar-footer__links">
          {snapshot?.loggedIn ? (
            <>
              <Button onClick={() => openRoute('/calendar')} size="sm" variant="ghost">
                收款日历
              </Button>
              <Button onClick={() => openRoute('/analytics')} size="sm" variant="ghost">
                数据分析
              </Button>
            </>
          ) : null}
        </div>
        <div className="menubar-popover__header-actions">
          <IconButton
            label="桌面设置"
            onClick={() => openRoute('/settings?tab=desktop')}
            size="sm"
            title="偏好设置"
            variant="ghost"
          >
            <JadeIcon name="dock-settings" size={15} />
          </IconButton>
          <IconButton
            label="退出珠算"
            onClick={() => void desktopManager.requestQuit().catch(() => {})}
            size="sm"
            title="退出珠算"
            variant="ghost"
          >
            <JadeIcon name="logout" size={15} />
          </IconButton>
        </div>
      </footer>
    </main>
  )
}
