import type { ReactNode } from 'react'

export interface JadeGlyphDefinition {
  /** Enclosed translucent jade tint layer (optional; rendered behind primary geometry). */
  tint?: ReactNode
  /** Static primary geometry (stroke or fill depending on `mode`). */
  staticPart?: ReactNode
  /** Optional isolated interactive part for CSS/WAAPI micro-motion (`003`). */
  motionPart?: {
    id: string
    content: ReactNode
  }
  /** Default stroke weight on the 24x24 viewBox (ignored in `fill` mode). */
  strokeWidth?: number
  /** `stroke` for rounded jade-carved paths; `fill` for compound filled paths. */
  mode: 'stroke' | 'fill'
}

export const JADE_ICON_REGISTRY = {
  // --- Core action icons ---
  edit: {
    mode: 'stroke',
    strokeWidth: 1.9,
    staticPart: <path d="M4.25 19.75H19.75" />,
    motionPart: {
      id: 'edit-pen',
      content: (
        <>
          <path
            className="ods-jade-icon__inner-tint"
            d="M5.25 16.45L6.15 12.85L15.1 3.9A1.9 1.9 0 0 1 17.8 3.9L19.1 5.2A1.9 1.9 0 0 1 19.1 7.9L10.15 16.85L5.25 16.45Z"
            stroke="none"
          />
          <path d="M5.25 16.45L6.15 12.85L15.1 3.9A1.9 1.9 0 0 1 17.8 3.9L19.1 5.2A1.9 1.9 0 0 1 19.1 7.9L10.15 16.85L5.25 16.45Z" />
          <path d="M13.5 5.5L17.5 9.5" opacity="0.7" />
        </>
      ),
    },
  },
  'edit-circle': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <circle cx="12" cy="12" r="8.5" />,
    staticPart: (
      <>
        <path d="M12.5 3.6A8.5 8.5 0 1 0 20.4 11.5" />
        <path d="M9.5 14.5L10.2 11.8L16.8 5.2A1.5 1.5 0 0 1 18.9 7.3L12.3 13.9L9.5 14.5Z" />
      </>
    ),
  },
  download: {
    mode: 'stroke',
    strokeWidth: 1.9,
    staticPart: (
      <path d="M4.25 14.75V17.75A2 2 0 0 0 6.25 19.75H17.75A2 2 0 0 0 19.75 17.75V14.75" />
    ),
    motionPart: {
      id: 'download-arrow',
      content: (
        <>
          <path d="M12 4.25V14.25" />
          <path d="M8.25 10.75L12 14.5L15.75 10.75" />
        </>
      ),
    },
  },
  add: {
    mode: 'stroke',
    strokeWidth: 2,
    motionPart: {
      id: 'add-plus',
      content: <path d="M12 5.25V18.75M5.25 12H18.75" />,
    },
  },
  minus: {
    mode: 'stroke',
    strokeWidth: 2,
    staticPart: <path d="M5.5 12H18.5" />,
  },
  close: {
    mode: 'stroke',
    strokeWidth: 2,
    motionPart: {
      id: 'close-x',
      content: <path d="M6.75 6.75L17.25 17.25M17.25 6.75L6.75 17.25" />,
    },
  },
  search: {
    mode: 'stroke',
    strokeWidth: 1.9,
    tint: <circle cx="10.85" cy="10.85" r="6.6" />,
    staticPart: (
      <>
        <circle cx="10.85" cy="10.85" r="6.6" />
        <path d="M15.85 15.85L19.75 19.75" />
      </>
    ),
  },
  trash: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <path d="M6.5 7.5H17.5L16.7 18.4A2 2 0 0 1 14.7 20.2H9.3A2 2 0 0 1 7.3 18.4L6.5 7.5Z" />,
    staticPart: (
      <>
        <path d="M6.5 7.5L7.3 18.4A2 2 0 0 0 9.3 20.2H14.7A2 2 0 0 0 16.7 18.4L17.5 7.5" />
        <path d="M10.2 11.2V16.2M13.8 11.2V16.2" opacity="0.72" />
      </>
    ),
    motionPart: {
      id: 'trash-lid',
      content: (
        <>
          <path d="M4.5 7H19.5" />
          <path d="M9.2 7V5.3A1.5 1.5 0 0 1 10.7 3.8H13.3A1.5 1.5 0 0 1 14.8 5.3V7" />
        </>
      ),
    },
  },
  archive: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="10.5" rx="2" width="15.5" x="4.25" y="9" />,
    staticPart: (
      <>
        <rect height="4.2" rx="1.6" width="18" x="3" y="4.5" />
        <path d="M4.75 8.7V17.5A2 2 0 0 0 6.75 19.5H17.25A2 2 0 0 0 19.25 17.5V8.7" />
        <path d="M9.75 13H14.25" />
      </>
    ),
  },
  refresh: {
    mode: 'stroke',
    strokeWidth: 1.9,
    motionPart: {
      id: 'refresh-ring',
      content: (
        <>
          <path d="M19.25 12A7.25 7.25 0 1 1 17.1 6.85" />
          <path d="M17.5 3.75V7.25H14" />
        </>
      ),
    },
  },
  save: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="16" rx="2.5" width="16" x="4" y="4" />,
    staticPart: (
      <>
        <path d="M5.75 4H16.2L20 7.8V18.25A1.75 1.75 0 0 1 18.25 20H5.75A1.75 1.75 0 0 1 4 18.25V5.75A1.75 1.75 0 0 1 5.75 4Z" />
        <path d="M8 4V9H15V4" />
        <rect height="5.5" rx="1.2" width="8" x="8" y="14.5" />
      </>
    ),
  },
  eye: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <path d="M2.8 12C4.6 8.3 8 6.2 12 6.2S19.4 8.3 21.2 12C19.4 15.7 16 17.8 12 17.8S4.6 15.7 2.8 12Z" />,
    staticPart: (
      <path d="M2.8 12C4.6 8.3 8 6.2 12 6.2S19.4 8.3 21.2 12C19.4 15.7 16 17.8 12 17.8S4.6 15.7 2.8 12Z" />
    ),
    motionPart: {
      id: 'eye-pupil',
      content: <circle cx="12" cy="12" r="2.6" />,
    },
  },
  'eye-off': {
    mode: 'stroke',
    strokeWidth: 1.85,
    staticPart: (
      <>
        <path d="M4 4L20 20" />
        <path d="M9.9 6.6A9.7 9.7 0 0 1 12 6.3C16 6.3 19.4 8.4 21.2 12C20.4 13.6 19.3 15 17.9 16" />
        <path d="M14.1 17.4A9.4 9.4 0 0 1 12 17.7C8 17.7 4.6 15.6 2.8 12C3.7 10.2 5 8.7 6.6 7.7" />
        <path d="M10.2 10.2A2.6 2.6 0 0 0 13.8 13.8" />
      </>
    ),
  },
  'upload-cloud': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: (
      <path d="M7.2 18.2H17.2A3.8 3.8 0 0 0 17.9 10.7A5.6 5.6 0 0 0 7.1 8.8A4.2 4.2 0 0 0 7.2 18.2Z" />
    ),
    staticPart: (
      <path d="M7.8 18.2H6.8A4.1 4.1 0 0 1 6.7 10.1A5.6 5.6 0 0 1 17.6 10.8A3.7 3.7 0 0 1 17.3 18.2H16.2" />
    ),
    motionPart: {
      id: 'upload-arrow',
      content: <path d="M12 19.5V12.2M9.2 14.8L12 12L14.8 14.8" />,
    },
  },
  forbid: {
    mode: 'stroke',
    strokeWidth: 1.9,
    tint: <circle cx="12" cy="12" r="8.5" />,
    staticPart: <circle cx="12" cy="12" r="8.5" />,
    motionPart: {
      id: 'forbid-slash',
      content: <path d="M6.2 6.2L17.8 17.8" />,
    },
  },
  more: {
    mode: 'fill',
    staticPart: (
      <>
        <circle cx="5.75" cy="12" r="1.85" />
        <circle cx="12" cy="12" r="1.85" />
        <circle cx="18.25" cy="12" r="1.85" />
      </>
    ),
  },

  // --- Arrows & Chevrons ---
  'arrow-left': {
    mode: 'stroke',
    strokeWidth: 1.95,
    motionPart: {
      id: 'arrow-left',
      content: (
        <>
          <path d="M19 12H5.5" />
          <path d="M10.75 6.75L5.5 12L10.75 17.25" />
        </>
      ),
    },
  },
  'arrow-right': {
    mode: 'stroke',
    strokeWidth: 1.95,
    motionPart: {
      id: 'arrow-right',
      content: (
        <>
          <path d="M5 12H18.5" />
          <path d="M13.25 6.75L18.5 12L13.25 17.25" />
        </>
      ),
    },
  },
  'arrow-up': {
    mode: 'stroke',
    strokeWidth: 1.95,
    staticPart: (
      <>
        <path d="M12 19V5.5" />
        <path d="M6.75 10.75L12 5.5L17.25 10.75" />
      </>
    ),
  },
  'arrow-down': {
    mode: 'stroke',
    strokeWidth: 1.95,
    staticPart: (
      <>
        <path d="M12 5V18.5" />
        <path d="M6.75 13.25L12 18.5L17.25 13.25" />
      </>
    ),
  },
  'arrow-up-right': {
    mode: 'stroke',
    strokeWidth: 1.95,
    staticPart: (
      <>
        <path d="M7 17L17 7" />
        <path d="M9.5 7H17V14.5" />
      </>
    ),
  },
  'chevron-left': {
    mode: 'stroke',
    strokeWidth: 2,
    staticPart: <path d="M14.5 6.5L9 12L14.5 17.5" />,
  },
  'chevron-right': {
    mode: 'stroke',
    strokeWidth: 2,
    staticPart: <path d="M9.5 6.5L15 12L9.5 17.5" />,
  },
  'chevron-down': {
    mode: 'stroke',
    strokeWidth: 2,
    staticPart: <path d="M6.5 9.5L12 15L17.5 9.5" />,
  },

  // --- 5 carved Dock icons (preserving 01-workbench.md proportions) ---
  'dock-dashboard': {
    mode: 'stroke',
    strokeWidth: 1.8,
    tint: (
      <path d="M9.71 20.47H5.33A1.56 1.56 0 0 1 3.77 18.91V10.16A0.4 0.4 0 0 1 3.92 9.85L11.11 3.9A1.39 1.39 0 0 1 12.89 3.9L20.08 9.85A0.4 0.4 0 0 1 20.23 10.16V18.91A1.56 1.56 0 0 1 18.67 20.47H14.29V16.06A0.94 0.94 0 0 0 13.36 15.12H10.64A0.94 0.94 0 0 0 9.71 16.06Z" />
    ),
    staticPart: (
      <path d="M9.71 20.47L5.33 20.47A1.56 1.56 0 0 1 3.77 18.91L3.77 10.16A0.4 0.4 0 0 1 3.92 9.85L11.11 3.9A1.39 1.39 0 0 1 12.89 3.9L20.08 9.85A0.4 0.4 0 0 1 20.23 10.16L20.23 18.91A1.56 1.56 0 0 1 18.67 20.47L14.29 20.47L14.29 16.06A0.94 0.94 0 0 0 13.36 15.12L10.64 15.12A0.94 0.94 0 0 0 9.71 16.06Z" />
    ),
  },
  'dock-projects': {
    mode: 'stroke',
    strokeWidth: 1.8,
    tint: (
      <path d="M2.85 6.05A1.74 1.74 0 0 1 4.59 4.31H8.89A0.8 0.8 0 0 1 9.5 4.59L11.02 6.37A0.8 0.8 0 0 0 11.63 6.65H19.41A1.74 1.74 0 0 1 21.15 8.39V18.55A1.74 1.74 0 0 1 19.41 20.29H4.59A1.74 1.74 0 0 1 2.85 18.55Z" />
    ),
    staticPart: (
      <path d="M2.85 10.4V6.05A1.74 1.74 0 0 1 4.59 4.31H8.89A0.8 0.8 0 0 1 9.5 4.59L11.02 6.37A0.8 0.8 0 0 0 11.63 6.65H19.41A1.74 1.74 0 0 1 21.15 8.39V10.4" />
    ),
    motionPart: {
      id: 'dock-folder-flap',
      content: (
        <path d="M2.85 10.2A1.2 1.2 0 0 1 4.05 9.1H19.95A1.2 1.2 0 0 1 21.15 10.2V18.55A1.74 1.74 0 0 1 19.41 20.29H4.59A1.74 1.74 0 0 1 2.85 18.55Z" />
      ),
    },
  },
  'dock-calendar': {
    mode: 'stroke',
    strokeWidth: 1.8,
    tint: <rect height="15.66" rx="1.74" width="16.94" x="3.53" y="4.98" />,
    staticPart: (
      <>
        <path d="M3.53 6.72A1.74 1.74 0 0 1 5.27 4.98H18.73A1.74 1.74 0 0 1 20.47 6.72V18.9A1.74 1.74 0 0 1 18.73 20.64H5.27A1.74 1.74 0 0 1 3.53 18.9Z" />
        <path d="M3.53 9.79H20.47M7.6 3.03V6.57M16.4 3.03V6.57" />
        <path
          d="M8.08 13.2H10.21M12.61 13.2H15.94M8.08 16.05H10.21"
          opacity="0.52"
          strokeWidth="1.35"
        />
      </>
    ),
    motionPart: {
      id: 'dock-calendar-bead',
      content: (
        <rect
          className="ods-jade-icon__bead-fill"
          height="2.5"
          rx="1.25"
          strokeWidth="1.25"
          width="3.6"
          x="12.6"
          y="14.75"
        />
      ),
    },
  },
  'dock-analytics': {
    mode: 'stroke',
    strokeWidth: 1.35,
    staticPart: (
      <g className="ods-jade-icon__bar-group">
        <rect height="6.05" rx="1.1" width="2.8" x="4.45" y="14.76" />
        <rect height="11.2" rx="1.1" width="2.8" x="10.6" y="9.61" />
      </g>
    ),
    motionPart: {
      id: 'dock-analytics-top',
      content: (
        <g className="ods-jade-icon__bar-group">
          <rect height="16.92" rx="1.1" width="2.8" x="16.75" y="3.89" />
        </g>
      ),
    },
  },
  'dock-settings': {
    mode: 'stroke',
    strokeWidth: 1.8,
    motionPart: {
      id: 'dock-settings-gear',
      content: (
        <>
          <path
            className="ods-jade-icon__inner-tint"
            d="M9.63 5.16A0.8 0.8 0 0 0 10.07 4.7L10.42 3.79A0.8 0.8 0 0 1 11.17 3.27H12.83A0.8 0.8 0 0 1 13.58 3.79L13.93 4.7A0.8 0.8 0 0 0 14.37 5.16L15.16 5.49A0.8 0.8 0 0 0 15.8 5.48L16.69 5.07A0.8 0.8 0 0 1 17.58 5.24L18.76 6.42A0.8 0.8 0 0 1 18.93 7.31L18.52 8.2A0.8 0.8 0 0 0 18.51 8.84L18.84 9.63A0.8 0.8 0 0 0 19.3 10.07L20.21 10.42A0.8 0.8 0 0 1 20.73 11.17V12.83A0.8 0.8 0 0 1 20.21 13.58L19.3 13.93A0.8 0.8 0 0 0 18.84 14.37L18.51 15.16A0.8 0.8 0 0 0 18.52 15.8L18.93 16.69A0.8 0.8 0 0 1 18.76 17.58L17.58 18.76A0.8 0.8 0 0 1 16.69 18.93L15.8 18.52A0.8 0.8 0 0 0 15.16 18.51L14.37 18.84A0.8 0.8 0 0 0 13.93 19.3L13.58 20.21A0.8 0.8 0 0 1 12.83 20.73H11.17A0.8 0.8 0 0 1 10.42 20.21L10.07 19.3A0.8 0.8 0 0 0 9.63 18.84L8.84 18.51A0.8 0.8 0 0 0 8.2 18.52L7.31 18.93A0.8 0.8 0 0 1 6.42 18.76L5.24 17.58A0.8 0.8 0 0 1 5.07 16.69L5.48 15.8A0.8 0.8 0 0 0 5.49 15.16L5.16 14.37A0.8 0.8 0 0 0 4.7 13.93L3.79 13.58A0.8 0.8 0 0 1 3.27 12.83V11.17A0.8 0.8 0 0 1 3.79 10.42L4.7 10.07A0.8 0.8 0 0 0 5.16 9.63L5.49 8.84A0.8 0.8 0 0 0 5.48 8.2L5.07 7.31A0.8 0.8 0 0 1 5.24 6.42L6.42 5.24A0.8 0.8 0 0 1 7.31 5.07L8.2 5.48A0.8 0.8 0 0 0 8.84 5.49Z"
            stroke="none"
          />
          <path d="M9.63 5.16A0.8 0.8 0 0 0 10.07 4.7L10.42 3.79A0.8 0.8 0 0 1 11.17 3.27H12.83A0.8 0.8 0 0 1 13.58 3.79L13.93 4.7A0.8 0.8 0 0 0 14.37 5.16L15.16 5.49A0.8 0.8 0 0 0 15.8 5.48L16.69 5.07A0.8 0.8 0 0 1 17.58 5.24L18.76 6.42A0.8 0.8 0 0 1 18.93 7.31L18.52 8.2A0.8 0.8 0 0 0 18.51 8.84L18.84 9.63A0.8 0.8 0 0 0 19.3 10.07L20.21 10.42A0.8 0.8 0 0 1 20.73 11.17V12.83A0.8 0.8 0 0 1 20.21 13.58L19.3 13.93A0.8 0.8 0 0 0 18.84 14.37L18.51 15.16A0.8 0.8 0 0 0 18.52 15.8L18.93 16.69A0.8 0.8 0 0 1 18.76 17.58L17.58 18.76A0.8 0.8 0 0 1 16.69 18.93L15.8 18.52A0.8 0.8 0 0 0 15.16 18.51L14.37 18.84A0.8 0.8 0 0 0 13.93 19.3L13.58 20.21A0.8 0.8 0 0 1 12.83 20.73H11.17A0.8 0.8 0 0 1 10.42 20.21L10.07 19.3A0.8 0.8 0 0 0 9.63 18.84L8.84 18.51A0.8 0.8 0 0 0 8.2 18.52L7.31 18.93A0.8 0.8 0 0 1 6.42 18.76L5.24 17.58A0.8 0.8 0 0 1 5.07 16.69L5.48 15.8A0.8 0.8 0 0 0 5.49 15.16L5.16 14.37A0.8 0.8 0 0 0 4.7 13.93L3.79 13.58A0.8 0.8 0 0 1 3.27 12.83V11.17A0.8 0.8 0 0 1 3.79 10.42L4.7 10.07A0.8 0.8 0 0 0 5.16 9.63L5.49 8.84A0.8 0.8 0 0 0 5.48 8.2L5.07 7.31A0.8 0.8 0 0 1 5.24 6.42L6.42 5.24A0.8 0.8 0 0 1 7.31 5.07L8.2 5.48A0.8 0.8 0 0 0 8.84 5.49Z" />
          <circle cx="12" cy="12" r="2.87" />
        </>
      ),
    },
  },

  // --- Notifications, checks & feedback ---
  bell: {
    mode: 'stroke',
    strokeWidth: 1.9,
    motionPart: {
      id: 'bell-body',
      content: (
        <>
          <path
            className="ods-jade-icon__inner-tint"
            d="M6.25 10.25A5.75 5.75 0 0 1 17.75 10.25V14.5L19.25 16.75H4.75L6.25 14.5V10.25Z"
            stroke="none"
          />
          <path d="M6.25 10.25A5.75 5.75 0 0 1 17.75 10.25V14.5L19.25 16.75H4.75L6.25 14.5V10.25Z" />
          <path d="M9.75 19.75A2.5 2.5 0 0 0 14.25 19.75" />
        </>
      ),
    },
  },
  check: {
    mode: 'stroke',
    strokeWidth: 2.1,
    staticPart: <path d="M5.25 12.5L9.75 17L18.75 7.5" />,
  },
  'check-double': {
    mode: 'stroke',
    strokeWidth: 1.9,
    staticPart: (
      <>
        <path d="M2.75 12.75L6.75 16.75L14.5 8.5" />
        <path d="M9.75 15.25L11.25 16.75L20.75 7.25" />
      </>
    ),
  },
  'check-circle': {
    mode: 'stroke',
    strokeWidth: 1.9,
    tint: <circle cx="12" cy="12" r="8.75" />,
    staticPart: (
      <>
        <circle cx="12" cy="12" r="8.75" />
        <path d="M8.5 12.2L10.9 14.6L15.7 9.6" />
      </>
    ),
  },
  'close-circle': {
    mode: 'stroke',
    strokeWidth: 1.9,
    tint: <circle cx="12" cy="12" r="8.75" />,
    staticPart: (
      <>
        <circle cx="12" cy="12" r="8.75" />
        <path d="M9.2 9.2L14.8 14.8M14.8 9.2L9.2 14.8" />
      </>
    ),
  },
  'alert-triangle': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <path d="M10.4 4.5L3.6 16.8A1.8 1.8 0 0 0 5.2 19.5H18.8A1.8 1.8 0 0 0 20.4 16.8L13.6 4.5A1.8 1.8 0 0 0 10.4 4.5Z" />,
    staticPart: (
      <>
        <path d="M10.4 4.5L3.6 16.8A1.8 1.8 0 0 0 5.2 19.5H18.8A1.8 1.8 0 0 0 20.4 16.8L13.6 4.5A1.8 1.8 0 0 0 10.4 4.5Z" />
        <path d="M12 9.4V13.4" />
        <circle cx="12" cy="16.2" fill="currentColor" r="0.85" stroke="none" />
      </>
    ),
  },
  warning: {
    mode: 'stroke',
    strokeWidth: 1.9,
    tint: <circle cx="12" cy="12" r="8.75" />,
    staticPart: (
      <>
        <circle cx="12" cy="12" r="8.75" />
        <path d="M12 8V12.5" />
        <circle cx="12" cy="15.8" fill="currentColor" r="0.85" stroke="none" />
      </>
    ),
  },
  info: {
    mode: 'stroke',
    strokeWidth: 1.9,
    tint: <circle cx="12" cy="12" r="8.75" />,
    staticPart: (
      <>
        <circle cx="12" cy="12" r="8.75" />
        <path d="M12 11.2V16" />
        <circle cx="12" cy="8.2" fill="currentColor" r="0.85" stroke="none" />
      </>
    ),
  },
  'wifi-off': {
    mode: 'stroke',
    strokeWidth: 1.9,
    staticPart: (
      <>
        <path d="M4.5 4.5L19.5 19.5" />
        <path d="M12 18.25H12.01" strokeWidth="2.4" />
        <path d="M8.6 14.9A5 5 0 0 1 13.7 13.7" />
        <path d="M5.5 11.75A9.4 9.4 0 0 1 9.4 9.5M14.7 9.6A9.4 9.4 0 0 1 18.5 11.75" />
        <path d="M2.8 8.6A13.6 13.6 0 0 1 6.7 6.1M11.7 5.2A13.6 13.6 0 0 1 21.2 8.6" />
      </>
    ),
  },
  copy: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="11.5" rx="2.2" width="10.5" x="4.5" y="8" />,
    staticPart: (
      <>
        <rect height="11.5" rx="2.2" width="10.5" x="4.5" y="8" />
        <path d="M9 8V6.2A2 2 0 0 1 11 4.2H17.5A2 2 0 0 1 19.5 6.2V14.2A2 2 0 0 1 17.5 16.2H15" />
      </>
    ),
  },

  // --- Domain, finance & settings icons ---
  calendar: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="14.5" rx="2.2" width="16.5" x="3.75" y="5.5" />,
    staticPart: (
      <>
        <rect height="14.5" rx="2.2" width="16.5" x="3.75" y="5.5" />
        <path d="M3.75 10H20.25M8 3.5V6.5M16 3.5V6.5" />
      </>
    ),
  },
  'calendar-check': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="14.5" rx="2.2" width="16.5" x="3.75" y="5.5" />,
    staticPart: (
      <>
        <rect height="14.5" rx="2.2" width="16.5" x="3.75" y="5.5" />
        <path d="M3.75 10H20.25M8 3.5V6.5M16 3.5V6.5" />
        <path d="M9.2 14.8L11.1 16.6L15 12.8" />
      </>
    ),
  },
  payment: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="13.5" rx="2.5" width="17.5" x="3.25" y="5.25" />,
    staticPart: (
      <>
        <rect height="13.5" rx="2.5" width="17.5" x="3.25" y="5.25" />
        <path d="M3.25 9.8H20.75M7.25 14.5H11" />
      </>
    ),
  },
  currency: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="16" rx="3" width="16" x="4" y="4" />,
    staticPart: (
      <>
        <rect height="16" rx="3" width="16" x="4" y="4" />
        <path d="M12 7.5V16.5M14.4 9.5A2.2 2.2 0 0 0 12 8.2C10.5 8.2 9.6 9 9.6 10.1C9.6 12.1 14.4 11.7 14.4 13.9C14.4 15.1 13.4 15.8 12 15.8A2.4 2.4 0 0 1 9.5 14.5" />
      </>
    ),
  },
  'layout-grid': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: (
      <>
        <rect height="6.5" rx="1.8" width="6.5" x="4" y="4" />
        <rect height="6.5" rx="1.8" width="6.5" x="13.5" y="4" />
        <rect height="6.5" rx="1.8" width="6.5" x="4" y="13.5" />
        <rect height="6.5" rx="1.8" width="6.5" x="13.5" y="13.5" />
      </>
    ),
    staticPart: (
      <>
        <rect height="6.5" rx="1.8" width="6.5" x="4" y="4" />
        <rect height="6.5" rx="1.8" width="6.5" x="13.5" y="4" />
        <rect height="6.5" rx="1.8" width="6.5" x="4" y="13.5" />
        <rect height="6.5" rx="1.8" width="6.5" x="13.5" y="13.5" />
      </>
    ),
  },
  'folder-open': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: (
      <path d="M3.5 7A2 2 0 0 1 5.5 5H9.4L11.2 7.2H18.5A2 2 0 0 1 20.5 9.2V17A2 2 0 0 1 18.5 19H5.5A2 2 0 0 1 3.5 17Z" />
    ),
    staticPart: (
      <>
        <path d="M3.5 17V7A2 2 0 0 1 5.5 5H9.4L11.2 7.2H17.5A2 2 0 0 1 19.5 9.2V10.5" />
        <path d="M3.6 17.4L5.6 11.4A1.6 1.6 0 0 1 7.1 10.3H19.4A1.4 1.4 0 0 1 20.7 12.1L18.9 17.7A1.8 1.8 0 0 1 17.2 19H5.2A1.6 1.6 0 0 1 3.6 17.4Z" />
      </>
    ),
  },
  scales: {
    mode: 'stroke',
    strokeWidth: 1.85,
    staticPart: (
      <>
        <path d="M12 4V19.5M7.5 19.5H16.5M5 7.5H19" />
        <path d="M6.5 7.5L4.2 13.2A2.6 2.6 0 0 0 8.8 13.2L6.5 7.5Z" />
        <path d="M17.5 7.5L15.2 13.2A2.6 2.6 0 0 0 19.8 13.2L17.5 7.5Z" />
      </>
    ),
  },
  shield: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: (
      <path d="M12 3.4L19 6.2V11.6C19 16.05 16 19.45 12 20.8C8 19.45 5 16.05 5 11.6V6.2L12 3.4Z" />
    ),
    staticPart: (
      <>
        <path d="M12 3.4L19 6.2V11.6C19 16.05 16 19.45 12 20.8C8 19.45 5 16.05 5 11.6V6.2L12 3.4Z" />
        <circle cx="12" cy="11.1" r="1.6" />
        <path d="M12 12.7V15.3" />
      </>
    ),
  },
  'shield-check': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: (
      <path d="M12 3.4L19 6.2V11.6C19 16.05 16 19.45 12 20.8C8 19.45 5 16.05 5 11.6V6.2L12 3.4Z" />
    ),
    staticPart: (
      <>
        <path d="M12 3.4L19 6.2V11.6C19 16.05 16 19.45 12 20.8C8 19.45 5 16.05 5 11.6V6.2L12 3.4Z" />
        <path d="M9.1 12.2L11.1 14.2L15.1 10.1" />
      </>
    ),
  },
  'shield-star': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: (
      <path d="M12 3.4L19 6.2V11.6C19 16.05 16 19.45 12 20.8C8 19.45 5 16.05 5 11.6V6.2L12 3.4Z" />
    ),
    staticPart: (
      <>
        <path d="M12 3.4L19 6.2V11.6C19 16.05 16 19.45 12 20.8C8 19.45 5 16.05 5 11.6V6.2L12 3.4Z" />
        <path d="M12 8.7L13 10.8L15.2 11.1L13.6 12.6L14 14.8L12 13.7L10 14.8L10.4 12.6L8.8 11.1L11 10.8Z" />
      </>
    ),
  },
  key: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <circle cx="8.5" cy="14.5" r="4.25" />,
    staticPart: (
      <>
        <circle cx="8.5" cy="14.5" r="4.25" />
        <path d="M11.6 11.4L18.5 4.5M15.8 7.2L18 9.4M17.8 5.2L19.8 7.2" />
      </>
    ),
  },
  lock: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="9.5" rx="2.4" width="13.5" x="5.25" y="10.25" />,
    staticPart: (
      <>
        <rect height="9.5" rx="2.4" width="13.5" x="5.25" y="10.25" />
        <path d="M8.5 10.25V7.75A3.5 3.5 0 0 1 15.5 7.75V10.25" />
      </>
    ),
  },
  'lock-password': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="9.5" rx="2.4" width="13.5" x="5.25" y="10.25" />,
    staticPart: (
      <>
        <rect height="9.5" rx="2.4" width="13.5" x="5.25" y="10.25" />
        <path d="M9.5 15H9.51M12 15H12.01M14.5 15H14.51" strokeWidth="2.2" />
      </>
    ),
    motionPart: {
      id: 'lock-shackle',
      content: <path d="M8.5 10.25V7.75A3.5 3.5 0 0 1 15.5 7.75V10.25" />,
    },
  },
  user: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <circle cx="12" cy="8.25" r="3.75" />,
    staticPart: (
      <>
        <circle cx="12" cy="8.25" r="3.75" />
        <path d="M5 19.5A7 7 0 0 1 19 19.5" />
      </>
    ),
  },
  users: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <circle cx="9.25" cy="8.5" r="3.25" />,
    staticPart: (
      <>
        <circle cx="9.25" cy="8.5" r="3.25" />
        <path d="M3.5 19.2A5.8 5.8 0 0 1 15 19.2" />
        <path d="M15.4 6.2A2.8 2.8 0 0 1 16.5 11.4M17.2 14.5A4.6 4.6 0 0 1 20.5 19.2" />
      </>
    ),
  },
  palette: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: (
      <path d="M12 3.5A8.5 8.5 0 1 0 12 20.5C13.6 20.5 14.3 19.5 14.3 18.4C14.3 17.6 14 17 14 16.4A1.6 1.6 0 0 1 15.6 14.8H17.4A3.1 3.1 0 0 0 20.5 11.7A8.3 8.3 0 0 0 12 3.5Z" />
    ),
    staticPart: (
      <>
        <path d="M12 3.5A8.5 8.5 0 1 0 12 20.5C13.6 20.5 14.3 19.5 14.3 18.4C14.3 17.6 14 17 14 16.4A1.6 1.6 0 0 1 15.6 14.8H17.4A3.1 3.1 0 0 0 20.5 11.7A8.3 8.3 0 0 0 12 3.5Z" />
        <circle cx="8.2" cy="10.4" fill="currentColor" r="0.95" stroke="none" />
        <circle cx="11.5" cy="7.9" fill="currentColor" r="0.95" stroke="none" />
        <circle cx="15.3" cy="9.6" fill="currentColor" r="0.95" stroke="none" />
      </>
    ),
  },
  book: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="16.5" rx="2.4" width="14" x="5" y="3.75" />,
    staticPart: (
      <>
        <path d="M6.8 3.75H17.2A1.8 1.8 0 0 1 19 5.55V18.45A1.8 1.8 0 0 1 17.2 20.25H6.8A1.8 1.8 0 0 1 5 18.45V5.55A1.8 1.8 0 0 1 6.8 3.75Z" />
        <path d="M8.5 3.75V20.25M11.75 8.5H15.75M11.75 12H14.75" />
      </>
    ),
  },
  'file-list': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="16.5" rx="2.4" width="14.5" x="4.75" y="3.75" />,
    staticPart: (
      <>
        <rect height="16.5" rx="2.4" width="14.5" x="4.75" y="3.75" />
        <path d="M8.5 8.75H15.5M8.5 12.25H15.5M8.5 15.75H12.75" />
      </>
    ),
  },
  cloud: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: (
      <path d="M7 18.2H17.2A3.8 3.8 0 0 0 17.8 10.7A5.6 5.6 0 0 0 7 8.9A4.2 4.2 0 0 0 7 18.2Z" />
    ),
    staticPart: (
      <path d="M7 18.2H17.2A3.8 3.8 0 0 0 17.8 10.7A5.6 5.6 0 0 0 7 8.9A4.2 4.2 0 0 0 7 18.2Z" />
    ),
  },
  code: {
    mode: 'stroke',
    strokeWidth: 1.9,
    staticPart: (
      <>
        <path d="M8 8.25L4.25 12L8 15.75" />
        <path d="M16 8.25L19.75 12L16 15.75" />
        <path d="M13.5 6.5L10.5 17.5" />
      </>
    ),
  },
  logout: {
    mode: 'stroke',
    strokeWidth: 1.9,
    staticPart: <path d="M10.5 4.5H6.5A2 2 0 0 0 4.5 6.5V17.5A2 2 0 0 0 6.5 19.5H10.5" />,
    motionPart: {
      id: 'logout-arrow',
      content: <path d="M15.5 8.25L19.5 12L15.5 15.75M19 12H10" />,
    },
  },
  database: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <ellipse cx="12" cy="7.25" rx="7" ry="3" />,
    staticPart: (
      <>
        <ellipse cx="12" cy="7.25" rx="7" ry="3" />
        <path d="M5 7.25V16.75C5 18.4 8.1 19.75 12 19.75S19 18.4 19 16.75V7.25" />
        <path d="M5 12C5 13.65 8.1 15 12 15S19 13.65 19 12" />
      </>
    ),
  },
  'database-solid': {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <path d="M5 7.25C5 5.6 8.1 4.25 12 4.25S19 5.6 19 7.25V16.75C19 18.4 15.9 19.75 12 19.75S5 18.4 5 16.75Z" />,
    staticPart: (
      <>
        <ellipse cx="12" cy="7.25" rx="7" ry="3" />
        <path d="M5 7.25V16.75C5 18.4 8.1 19.75 12 19.75S19 18.4 19 16.75V7.25" />
        <path d="M5 12C5 13.65 8.1 15 12 15S19 13.65 19 12" />
      </>
    ),
  },
  inbox: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: <rect height="14.5" rx="2.5" width="16.5" x="3.75" y="4.75" />,
    staticPart: (
      <>
        <rect height="14.5" rx="2.5" width="16.5" x="3.75" y="4.75" />
        <path d="M3.75 13.2H8.4L9.8 15.4H14.2L15.6 13.2H20.25" />
      </>
    ),
  },
  'chart-line': {
    mode: 'stroke',
    strokeWidth: 1.9,
    staticPart: (
      <>
        <path d="M4.5 19.25H19.5" />
        <path d="M5.5 15.2L9.6 11.1L13.2 13.6L18.5 7.5" />
        <circle cx="18.5" cy="7.5" fill="currentColor" r="1.2" stroke="none" />
      </>
    ),
  },
  'chart-donut': {
    mode: 'stroke',
    strokeWidth: 1.9,
    tint: <circle cx="12" cy="12" r="8.25" />,
    staticPart: (
      <>
        <circle cx="12" cy="12" r="8.25" />
        <circle cx="12" cy="12" r="3.4" />
        <path d="M12 3.75V8.6M15.4 12H20.25" />
      </>
    ),
  },
  drizzle: {
    mode: 'stroke',
    strokeWidth: 1.85,
    tint: (
      <path d="M6.8 14.8H17.2A3.6 3.6 0 0 0 17.8 7.7A5.4 5.4 0 0 0 7.2 6.2A4 4 0 0 0 6.8 14.8Z" />
    ),
    staticPart: (
      <>
        <path d="M6.8 14.8H17.2A3.6 3.6 0 0 0 17.8 7.7A5.4 5.4 0 0 0 7.2 6.2A4 4 0 0 0 6.8 14.8Z" />
        <path d="M9 17.6L8.2 19.8M13 17.6L12.2 19.8M16.5 17.6L15.7 19.8" />
      </>
    ),
  },
} as const satisfies Record<string, JadeGlyphDefinition>

export type JadeIconName = keyof typeof JADE_ICON_REGISTRY
