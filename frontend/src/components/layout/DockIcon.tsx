import type { ReactNode } from 'react'
import type { PrimaryNavigationKey } from './primaryNavigation'

/*
 * The Dock draws its own glyphs: the approved workbench prototype uses a 1.8-unit round stroke on
 * a 24-unit grid, which no glyph in the icon font matches. The geometry was fitted to the
 * prototype's pixels; docs/prototypes/specs/dock-icons.json holds the source values.
 */
const glyphs: Record<PrimaryNavigationKey, ReactNode> = {
  dashboard: (
    <path d="M9.71 20.47L5.33 20.47A1.56 1.56 0 0 1 3.77 18.91L3.77 10.16A0.4 0.4 0 0 1 3.92 9.85L11.11 3.9A1.39 1.39 0 0 1 12.89 3.9L20.08 9.85A0.4 0.4 0 0 1 20.23 10.16L20.23 18.91A1.56 1.56 0 0 1 18.67 20.47L14.29 20.47L14.29 16.06A0.94 0.94 0 0 0 13.36 15.12L10.64 15.12A0.94 0.94 0 0 0 9.71 16.06Z" />
  ),
  projects: (
    <path d="M2.85 6.05A1.74 1.74 0 0 1 4.59 4.31L8.89 4.31A0.8 0.8 0 0 1 9.5 4.59L11.02 6.37A0.8 0.8 0 0 0 11.63 6.65L19.41 6.65A1.74 1.74 0 0 1 21.15 8.39L21.15 18.55A1.74 1.74 0 0 1 19.41 20.29L4.59 20.29A1.74 1.74 0 0 1 2.85 18.55Z" />
  ),
  calendar: (
    <>
      <path d="M3.53 6.72A1.74 1.74 0 0 1 5.27 4.98L18.73 4.98A1.74 1.74 0 0 1 20.47 6.72L20.47 18.9A1.74 1.74 0 0 1 18.73 20.64L5.27 20.64A1.74 1.74 0 0 1 3.53 18.9Z" />
      <path d="M3.53 9.79H20.47M7.6 3.03V6.57M16.4 3.03V6.57" />
      <path
        d="M8.08 13.2H10.21M12.61 13.2H15.94M8.08 15.87H10.21M12.61 15.87H15.94"
        opacity="0.5"
        strokeWidth="1.2"
      />
    </>
  ),
  analytics: (
    <g fill="currentColor" fillOpacity="0.5" strokeOpacity="0.8" strokeWidth="1.18">
      <rect height="6.05" rx="0.67" width="2.66" x="4.54" y="14.76" />
      <rect height="11.2" rx="0.67" width="2.66" x="10.67" y="9.61" />
      <rect height="16.92" rx="0.67" width="2.66" x="16.8" y="3.89" />
    </g>
  ),
  settings: (
    <>
      <path d="M9.63 5.29A0.8 0.8 0 0 0 10.07 4.83L10.42 3.92A0.8 0.8 0 0 1 11.17 3.4L12.83 3.4A0.8 0.8 0 0 1 13.58 3.92L13.93 4.83A0.8 0.8 0 0 0 14.37 5.29L15.16 5.62A0.8 0.8 0 0 0 15.8 5.61L16.69 5.2A0.8 0.8 0 0 1 17.58 5.37L18.76 6.55A0.8 0.8 0 0 1 18.93 7.44L18.52 8.33A0.8 0.8 0 0 0 18.51 8.97L18.84 9.76A0.8 0.8 0 0 0 19.3 10.2L20.21 10.55A0.8 0.8 0 0 1 20.73 11.3L20.73 12.96A0.8 0.8 0 0 1 20.21 13.71L19.3 14.06A0.8 0.8 0 0 0 18.84 14.5L18.51 15.29A0.8 0.8 0 0 0 18.52 15.93L18.93 16.82A0.8 0.8 0 0 1 18.76 17.71L17.58 18.89A0.8 0.8 0 0 1 16.69 19.06L15.8 18.65A0.8 0.8 0 0 0 15.16 18.64L14.37 18.97A0.8 0.8 0 0 0 13.93 19.43L13.58 20.34A0.8 0.8 0 0 1 12.83 20.86L11.17 20.86A0.8 0.8 0 0 1 10.42 20.34L10.07 19.43A0.8 0.8 0 0 0 9.63 18.97L8.84 18.64A0.8 0.8 0 0 0 8.2 18.65L7.31 19.06A0.8 0.8 0 0 1 6.42 18.89L5.24 17.71A0.8 0.8 0 0 1 5.07 16.82L5.48 15.93A0.8 0.8 0 0 0 5.49 15.29L5.16 14.5A0.8 0.8 0 0 0 4.7 14.06L3.79 13.71A0.8 0.8 0 0 1 3.27 12.96L3.27 11.3A0.8 0.8 0 0 1 3.79 10.55L4.7 10.2A0.8 0.8 0 0 0 5.16 9.76L5.49 8.97A0.8 0.8 0 0 0 5.48 8.33L5.07 7.44A0.8 0.8 0 0 1 5.24 6.55L6.42 5.37A0.8 0.8 0 0 1 7.31 5.2L8.2 5.61A0.8 0.8 0 0 0 8.84 5.62Z" />
      <circle cx="12" cy="12.13" r="2.87" />
    </>
  ),
}

export default function DockIcon({ name }: { name: PrimaryNavigationKey }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="1em"
    >
      {glyphs[name]}
    </svg>
  )
}
