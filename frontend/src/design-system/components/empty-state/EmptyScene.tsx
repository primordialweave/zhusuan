import type { SVGAttributes } from 'react'

export type EmptySceneName =
  | 'projects-empty'
  | 'plans-empty'
  | 'search-empty'
  | 'calendar-empty'
  | 'trend-empty'
  | 'structure-empty'
  | 'ledger-empty'
  | 'notifications-empty'
  | 'users-empty'
  | 'tokens-empty'

export type EmptySceneSize = 'hero' | 'standard' | 'compact'

export interface EmptySceneProps extends Omit<SVGAttributes<SVGSVGElement>, 'children' | 'name'> {
  animate?: boolean
  name: EmptySceneName
  size?: EmptySceneSize
}

const SCENE_HEIGHT: Record<EmptySceneSize, number> = {
  hero: 96,
  standard: 72,
  compact: 40,
}

function JadeBead({
  cx,
  cy,
  movableIndex,
  opacity = 1,
  rx = 8.2,
  ry = 5.5,
}: {
  cx: number
  cy: number
  movableIndex?: 0 | 1 | 2
  opacity?: number
  rx?: number
  ry?: number
}) {
  return (
    <g
      className={movableIndex !== undefined ? 'ods-empty-scene__bead--movable' : undefined}
      data-bead-index={movableIndex}
      opacity={opacity}
    >
      <ellipse
        cx={cx}
        cy={cy + 1.35}
        fill="var(--ods-material-jade-icon-shadow)"
        opacity="0.45"
        rx={rx - 0.5}
        ry={ry - 0.35}
      />
      <ellipse cx={cx} cy={cy} fill="url(#ods-jade-icon-grad-bead)" rx={rx} ry={ry} />
      <ellipse
        cx={cx - rx * 0.28}
        cy={cy - ry * 0.3}
        fill="var(--ods-material-jade-icon-specular)"
        opacity="0.74"
        rx={rx * 0.34}
        ry={ry * 0.24}
      />
    </g>
  )
}

function GhostJadeBead({
  cx,
  cy,
  rx = 8.4,
  ry = 6.2,
}: {
  cx: number
  cy: number
  rx?: number
  ry?: number
}) {
  return (
    <g>
      <ellipse
        cx={cx}
        cy={cy}
        fill="url(#ods-jade-scene-grad-tint)"
        opacity="0.72"
        rx={rx}
        ry={ry}
        stroke="url(#ods-jade-scene-grad-jade)"
        strokeDasharray="3.2 2.8"
        strokeLinecap="round"
        strokeOpacity="0.48"
        strokeWidth="1.6"
      />
      <ellipse
        cx={cx - 2.3}
        cy={cy - 1.8}
        fill="var(--ods-material-jade-icon-specular)"
        opacity="0.45"
        rx="2.6"
        ry="1.2"
      />
    </g>
  )
}

export function EmptyScene({
  animate = true,
  className,
  name,
  size = 'standard',
  ...props
}: EmptySceneProps) {
  const height = SCENE_HEIGHT[size]
  const width = Math.round((height * 160) / 112)

  return (
    <svg
      {...props}
      aria-hidden="true"
      className={['ods-empty-scene', className].filter(Boolean).join(' ')}
      data-animate={animate || undefined}
      data-scene={name}
      data-size={size}
      data-slot="empty-scene"
      focusable="false"
      height={height}
      viewBox="0 0 160 112"
      width={width}
    >
      {/* Quiet ground shadow ellipse anchoring the scene. */}
      <ellipse
        cx="80"
        cy="103"
        fill="var(--ods-color-fg-default)"
        opacity="0.1"
        rx={name === 'search-empty' || name === 'structure-empty' ? 42 : 56}
        ry="4"
      />

      {name === 'projects-empty' ? (
        <>
          <rect
            fill="url(#ods-jade-scene-grad-tint)"
            height="82"
            opacity="0.62"
            rx="13"
            width="116"
            x="22"
            y="14"
          />
          <g stroke="url(#ods-jade-scene-grad-wood)" strokeLinecap="round">
            <path d="M50 17V93M80 17V93M110 17V93" opacity="0.58" strokeWidth="2.4" />
          </g>
          {/* Iconic Chinese abacus middle beam (中梁) with underside depth & top sheen. */}
          <g>
            <rect
              fill="var(--ods-material-jade-icon-shadow)"
              height="4.8"
              opacity="0.34"
              rx="1.6"
              width="112"
              x="24"
              y="42.4"
            />
            <rect
              fill="url(#ods-jade-scene-grad-beam)"
              height="5.2"
              rx="1.8"
              width="112"
              x="24"
              y="40.5"
            />
            <path
              d="M27 41.6H133"
              opacity="0.48"
              stroke="var(--ods-material-jade-icon-specular)"
              strokeLinecap="round"
              strokeWidth="1.2"
            />
          </g>
          <rect
            fill="none"
            height="82"
            opacity="0.28"
            rx="13"
            stroke="var(--ods-material-jade-icon-shadow)"
            strokeWidth="5"
            transform="translate(0 1.4)"
            width="116"
            x="22"
            y="14"
          />
          <rect
            fill="none"
            height="82"
            rx="13"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeWidth="5"
            width="116"
            x="22"
            y="14"
          />
          <rect
            fill="none"
            height="82"
            opacity="0.34"
            rx="13"
            stroke="url(#ods-jade-scene-grad-specular)"
            strokeWidth="5"
            width="116"
            x="22"
            y="14"
          />
          <JadeBead cx={50} cy={27.5} />
          <JadeBead cx={80} cy={27.5} />
          <JadeBead cx={110} cy={27.5} />
          <JadeBead cx={50} cy={70.5} movableIndex={0} />
          <JadeBead cx={50} cy={83} />
          <JadeBead cx={80} cy={70.5} movableIndex={1} />
          <JadeBead cx={80} cy={83} />
          <JadeBead cx={110} cy={70.5} movableIndex={2} />
          <JadeBead cx={110} cy={83} />
        </>
      ) : null}

      {name === 'plans-empty' ? (
        <>
          <rect
            fill="url(#ods-jade-scene-grad-tint)"
            height="42"
            opacity="0.48"
            rx="21"
            width="124"
            x="18"
            y="34"
          />
          <rect
            fill="var(--ods-material-jade-icon-shadow)"
            height="4.4"
            opacity="0.28"
            rx="2.2"
            width="108"
            x="26"
            y="54.6"
          />
          <rect
            fill="url(#ods-jade-scene-grad-wood)"
            height="4.4"
            opacity="0.78"
            rx="2.2"
            width="108"
            x="26"
            y="53"
          />
          <g>
            <rect
              fill="url(#ods-jade-scene-grad-jade)"
              height="26"
              rx="4.2"
              width="8.4"
              x="20"
              y="42"
            />
            <rect
              fill="url(#ods-jade-scene-grad-specular)"
              height="26"
              opacity="0.32"
              rx="4.2"
              width="8.4"
              x="20"
              y="42"
            />
            <rect
              fill="url(#ods-jade-scene-grad-jade)"
              height="26"
              rx="4.2"
              width="8.4"
              x="131.6"
              y="42"
            />
            <rect
              fill="url(#ods-jade-scene-grad-specular)"
              height="26"
              opacity="0.24"
              rx="4.2"
              width="8.4"
              x="131.6"
              y="42"
            />
          </g>
          <JadeBead cx={50} cy={55.2} movableIndex={0} rx={9.2} ry={6.8} />
          <GhostJadeBead cx={80} cy={55.2} />
          <GhostJadeBead cx={110} cy={55.2} />
          <g fill="url(#ods-jade-scene-grad-jade)" opacity="0.32">
            <circle cx="50" cy="74" r="1.8" />
            <circle cx="80" cy="74" r="1.8" />
            <circle cx="110" cy="74" r="1.8" />
          </g>
        </>
      ) : null}

      {name === 'search-empty' ? (
        <>
          <JadeBead cx={36} cy={34} opacity={0.26} rx={7} ry={4.8} />
          <JadeBead cx={126} cy={40} opacity={0.22} rx={6.4} ry={4.4} />
          <g opacity="0.32" transform="translate(0 1.6)">
            <path
              d="M92 67L116 91"
              stroke="var(--ods-material-jade-icon-shadow)"
              strokeLinecap="round"
              strokeWidth="10.5"
            />
            <circle
              cx="74"
              cy="49"
              fill="none"
              r="26"
              stroke="var(--ods-material-jade-icon-shadow)"
              strokeWidth="5.4"
            />
          </g>
          <circle cx="74" cy="49" fill="url(#ods-jade-scene-grad-tint)" opacity="0.82" r="25" />
          <path
            d="M58 38A19 19 0 0 1 77 30"
            fill="none"
            opacity="0.64"
            stroke="var(--ods-material-jade-icon-specular)"
            strokeLinecap="round"
            strokeWidth="3.4"
          />
          <path
            d="M92 67L116 91"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeLinecap="round"
            strokeWidth="10.5"
          />
          <path
            d="M92 67L116 91"
            opacity="0.28"
            stroke="url(#ods-jade-scene-grad-specular)"
            strokeLinecap="round"
            strokeWidth="10.5"
          />
          <circle
            cx="74"
            cy="49"
            fill="none"
            r="26"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeWidth="5.4"
          />
          <circle
            cx="74"
            cy="49"
            fill="none"
            opacity="0.34"
            r="26"
            stroke="url(#ods-jade-scene-grad-specular)"
            strokeWidth="5.4"
          />
        </>
      ) : null}

      {name === 'calendar-empty' ? (
        <>
          <rect
            fill="url(#ods-jade-scene-grad-tint)"
            height="72"
            opacity="0.68"
            rx="12"
            width="86"
            x="37"
            y="22"
          />
          <rect
            fill="none"
            height="72"
            rx="12"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeWidth="4.6"
            width="86"
            x="37"
            y="22"
          />
          <rect
            fill="none"
            height="72"
            opacity="0.32"
            rx="12"
            stroke="url(#ods-jade-scene-grad-specular)"
            strokeWidth="4.6"
            width="86"
            x="37"
            y="22"
          />
          <rect fill="url(#ods-jade-scene-grad-beam)" height="4.4" rx="1.5" width="84" x="38" y="42" />
          <g stroke="url(#ods-jade-scene-grad-jade)" strokeLinecap="round" strokeWidth="5">
            <path d="M58 14V26M102 14V26" />
          </g>
          <JadeBead cx={80} cy={69} movableIndex={0} rx={9.5} ry={6.5} />
        </>
      ) : null}

      {name === 'trend-empty' ? (
        <>
          <rect
            fill="url(#ods-jade-scene-grad-tint)"
            height="68"
            opacity="0.45"
            rx="14"
            width="116"
            x="22"
            y="22"
          />
          <rect fill="url(#ods-jade-scene-grad-wood)" height="3.2" opacity="0.65" rx="1.6" width="96" x="32" y="74" />
          <path
            d="M36 62C54 62 60 44 80 48C98 52 108 38 124 38"
            fill="none"
            opacity="0.45"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeWidth="3.2"
          />
          <JadeBead cx={56} cy={55} movableIndex={0} rx={7.5} ry={5.2} />
          <JadeBead cx={104} cy={43} movableIndex={1} opacity={0.62} rx={7.5} ry={5.2} />
        </>
      ) : null}

      {name === 'structure-empty' ? (
        <>
          <circle
            cx="80"
            cy="54"
            fill="url(#ods-jade-scene-grad-tint)"
            opacity="0.48"
            r="34"
          />
          <circle
            cx="80"
            cy="54"
            fill="none"
            opacity="0.32"
            r="30"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeWidth="7.5"
          />
          <path
            d="M80 24A30 30 0 0 1 110 54"
            fill="none"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeLinecap="round"
            strokeWidth="7.5"
          />
          <path
            d="M80 24A30 30 0 0 1 110 54"
            fill="none"
            opacity="0.35"
            stroke="url(#ods-jade-scene-grad-specular)"
            strokeLinecap="round"
            strokeWidth="7.5"
          />
          <JadeBead cx={80} cy={54} movableIndex={0} rx={9} ry={6.4} />
        </>
      ) : null}

      {name === 'ledger-empty' ? (
        <>
          <rect
            fill="url(#ods-jade-scene-grad-tint)"
            height="76"
            opacity="0.65"
            rx="12"
            width="80"
            x="40"
            y="16"
          />
          <rect
            fill="none"
            height="76"
            rx="12"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeWidth="4.6"
            width="80"
            x="40"
            y="16"
          />
          <rect
            fill="none"
            height="76"
            opacity="0.32"
            rx="12"
            stroke="url(#ods-jade-scene-grad-specular)"
            strokeWidth="4.6"
            width="80"
            x="40"
            y="16"
          />
          <rect fill="url(#ods-jade-scene-grad-wood)" height="72" opacity="0.48" rx="1.5" width="3" x="56" y="18" />
          <g stroke="url(#ods-jade-scene-grad-jade)" strokeLinecap="round" strokeOpacity="0.45" strokeWidth="3">
            <path d="M68 38H106M68 52H100M68 66H92" />
          </g>
          <JadeBead cx={102} cy={72} movableIndex={0} rx={8} ry={5.4} />
        </>
      ) : null}

      {name === 'notifications-empty' ? (
        <>
          <path
            d="M54 50A26 26 0 0 1 106 50V68L114 78H46L54 68V50Z"
            fill="url(#ods-jade-scene-grad-tint)"
            opacity="0.72"
          />
          <path
            d="M54 50A26 26 0 0 1 106 50V68L114 78H46L54 68V50Z"
            fill="none"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeLinejoin="round"
            strokeWidth="4.8"
          />
          <path
            d="M54 50A26 26 0 0 1 106 50V68L114 78H46L54 68V50Z"
            fill="none"
            opacity="0.34"
            stroke="url(#ods-jade-scene-grad-specular)"
            strokeLinejoin="round"
            strokeWidth="4.8"
          />
          <JadeBead cx={80} cy={86} movableIndex={0} rx={8.4} ry={5.6} />
        </>
      ) : null}

      {name === 'users-empty' ? (
        <>
          <circle cx="80" cy="38" fill="url(#ods-jade-scene-grad-tint)" opacity="0.76" r="16" />
          <circle
            cx="80"
            cy="38"
            fill="none"
            r="16"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeWidth="4.8"
          />
          <circle
            cx="80"
            cy="38"
            fill="none"
            opacity="0.34"
            r="16"
            stroke="url(#ods-jade-scene-grad-specular)"
            strokeWidth="4.8"
          />
          <path
            d="M46 86A34 26 0 0 1 114 86"
            fill="url(#ods-jade-scene-grad-tint)"
            opacity="0.56"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeLinecap="round"
            strokeWidth="4.8"
          />
          <JadeBead cx={80} cy={76} movableIndex={0} rx={8} ry={5.4} />
        </>
      ) : null}

      {name === 'tokens-empty' ? (
        <>
          <circle cx="58" cy="58" fill="url(#ods-jade-scene-grad-tint)" opacity="0.78" r="20" />
          <circle
            cx="58"
            cy="58"
            fill="none"
            r="20"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeWidth="5"
          />
          <circle
            cx="58"
            cy="58"
            fill="none"
            opacity="0.34"
            r="20"
            stroke="url(#ods-jade-scene-grad-specular)"
            strokeWidth="5"
          />
          <path
            d="M76 58H124M108 58V70M120 58V67"
            fill="none"
            stroke="url(#ods-jade-scene-grad-jade)"
            strokeLinecap="round"
            strokeWidth="5.2"
          />
          <path
            d="M76 58H124"
            fill="none"
            opacity="0.32"
            stroke="url(#ods-jade-scene-grad-specular)"
            strokeLinecap="round"
            strokeWidth="5.2"
          />
          <JadeBead cx={58} cy={58} movableIndex={0} rx={7.5} ry={5.4} />
        </>
      ) : null}
    </svg>
  )
}
