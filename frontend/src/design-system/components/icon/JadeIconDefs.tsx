/**
 * Shared static SVG gradient definitions for JadeIcon and EmptyScene.
 *
 * Mounted once near the application root so list and table views with dozens of
 * icons reuse the same theme-reactive paint definitions instead of duplicating
 * per-instance `<defs>` nodes.
 *
 * Important SVG rule: gradients used on strokes that may be strictly horizontal
 * or strictly vertical MUST use `gradientUnits="userSpaceOnUse"`; otherwise
 * SVG's default `objectBoundingBox` resolves to a zero-area bbox and renders
 * the stroke invisible in Chromium and WebKit.
 */
export function JadeIconDefs() {
  return (
    <svg
      aria-hidden="true"
      className="ods-jade-icon-defs"
      data-slot="jade-icon-defs"
      focusable="false"
      height="0"
      width="0"
    >
      <defs>
        {/* 24x24 JadeIcon gradients (userSpaceOnUse so axis-aligned strokes always paint). */}
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-icon-grad-jade"
          x1="3"
          x2="21"
          y1="2"
          y2="22"
        >
          <stop className="ods-jade-stop--jade-edge" offset="0%" />
          <stop className="ods-jade-stop--jade-base" offset="32%" />
          <stop className="ods-jade-stop--jade-base" offset="76%" />
          <stop className="ods-jade-stop--jade-depth" offset="100%" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-icon-grad-on-accent"
          x1="3"
          x2="21"
          y1="2"
          y2="22"
        >
          <stop className="ods-jade-stop--on-accent-edge" offset="0%" />
          <stop className="ods-jade-stop--on-accent-base" offset="35%" />
          <stop className="ods-jade-stop--on-accent-base" offset="78%" />
          <stop className="ods-jade-stop--on-accent-depth" offset="100%" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-icon-grad-success"
          x1="3"
          x2="21"
          y1="2"
          y2="22"
        >
          <stop className="ods-jade-stop--success" offset="0%" stopOpacity="0.88" />
          <stop className="ods-jade-stop--success" offset="68%" stopOpacity="1" />
          <stop className="ods-jade-stop--jade-depth" offset="100%" stopOpacity="0.96" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-icon-grad-warning"
          x1="3"
          x2="21"
          y1="2"
          y2="22"
        >
          <stop className="ods-jade-stop--warning" offset="0%" stopOpacity="0.86" />
          <stop className="ods-jade-stop--warning" offset="76%" stopOpacity="1" />
          <stop className="ods-jade-stop--warning" offset="100%" stopOpacity="1" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-icon-grad-danger"
          x1="3"
          x2="21"
          y1="2"
          y2="22"
        >
          <stop className="ods-jade-stop--danger" offset="0%" stopOpacity="0.88" />
          <stop className="ods-jade-stop--danger" offset="78%" stopOpacity="1" />
          <stop className="ods-jade-stop--danger" offset="100%" stopOpacity="1" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-icon-grad-info"
          x1="3"
          x2="21"
          y1="2"
          y2="22"
        >
          <stop className="ods-jade-stop--info" offset="0%" stopOpacity="0.86" />
          <stop className="ods-jade-stop--info" offset="76%" stopOpacity="1" />
          <stop className="ods-jade-stop--info" offset="100%" stopOpacity="1" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-icon-grad-specular"
          x1="2"
          x2="18"
          y1="1"
          y2="17"
        >
          <stop className="ods-jade-stop--specular" offset="0%" stopOpacity="1" />
          <stop className="ods-jade-stop--specular" offset="40%" stopOpacity="0.34" />
          <stop className="ods-jade-stop--specular" offset="68%" stopOpacity="0" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-icon-grad-tint"
          x1="3"
          x2="21"
          y1="2"
          y2="22"
        >
          <stop className="ods-jade-stop--specular" offset="0%" stopOpacity="0.42" />
          <stop className="ods-jade-stop--tint" offset="45%" stopOpacity="1" />
          <stop className="ods-jade-stop--tint" offset="100%" stopOpacity="0.6" />
        </linearGradient>

        {/* 160x112 EmptyScene gradients (userSpaceOnUse for crisp beams, rods, and frames). */}
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-scene-grad-jade"
          x1="20"
          x2="140"
          y1="12"
          y2="100"
        >
          <stop className="ods-jade-stop--jade-edge" offset="0%" />
          <stop className="ods-jade-stop--jade-base" offset="34%" />
          <stop className="ods-jade-stop--jade-base" offset="74%" />
          <stop className="ods-jade-stop--jade-depth" offset="100%" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-scene-grad-beam"
          x1="24"
          x2="136"
          y1="40"
          y2="48"
        >
          <stop className="ods-jade-stop--jade-edge" offset="0%" />
          <stop className="ods-jade-stop--jade-base" offset="42%" />
          <stop className="ods-jade-stop--jade-depth" offset="100%" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-scene-grad-specular"
          x1="18"
          x2="122"
          y1="10"
          y2="82"
        >
          <stop className="ods-jade-stop--specular" offset="0%" stopOpacity="0.95" />
          <stop className="ods-jade-stop--specular" offset="42%" stopOpacity="0.32" />
          <stop className="ods-jade-stop--specular" offset="74%" stopOpacity="0" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-scene-grad-tint"
          x1="22"
          x2="138"
          y1="14"
          y2="96"
        >
          <stop className="ods-jade-stop--specular" offset="0%" stopOpacity="0.46" />
          <stop className="ods-jade-stop--tint" offset="44%" stopOpacity="0.95" />
          <stop className="ods-jade-stop--tint" offset="100%" stopOpacity="0.52" />
        </linearGradient>

        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="ods-jade-scene-grad-wood"
          x1="24"
          x2="136"
          y1="16"
          y2="96"
        >
          <stop className="ods-jade-stop--wood" offset="0%" stopOpacity="0.72" />
          <stop className="ods-jade-stop--wood" offset="100%" stopOpacity="0.96" />
        </linearGradient>

        {/* Bead radial gradient uses objectBoundingBox so every bead lights from its own upper-left. */}
        <radialGradient cx="34%" cy="28%" id="ods-jade-icon-grad-bead" r="68%">
          <stop className="ods-jade-stop--specular" offset="0%" stopOpacity="0.92" />
          <stop className="ods-jade-stop--jade-edge" offset="34%" stopOpacity="0.95" />
          <stop className="ods-jade-stop--jade-base" offset="76%" stopOpacity="1" />
          <stop className="ods-jade-stop--jade-depth" offset="100%" stopOpacity="1" />
        </radialGradient>
      </defs>
    </svg>
  )
}
