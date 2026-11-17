# 01 — 工作台 (workbench): prototype specification and baseline differences

Status: **first version, written from numeric measurements; items marked `TODO` are still being measured.**

- Prototype (target): `docs/prototypes/01-workbench.png`, 1487 × 1058.
- Baseline (current implementation): `/tmp/orange-resume/shots/base-01-dashboard.png`, 1487 × 1058, DPR 1.
- Scripts and raw outputs: `/tmp/orange-resume/agent-a/` (`s01…s35_*.py`, `out/`).

Conventions: all positions are prototype pixels, origin top-left. Box edges are sub-pixel positions of the **outer** boundary (pixel column `i` spans `[i, i+1)`), obtained by fitting a rounded rectangle to several hundred edge points, so `x=542.3` means the edge lies 0.3 px into column 542. Ink boxes of text and icons are whole pixels (`x0..x1` = first column with ink .. first column after the ink). Colours are sRGB hex sampled from the PNG.

## 0. Read this first: the baseline was captured in the dark theme

The baseline is not the same theme as the prototype. Evidence, all numeric:

- Baseline scene = `0.331·P + 12.6` (R), `0.345·P + 15.3` (G), `0.334·P + 16.7` (B) of the prototype scene with a residual of only 0.7–0.9 levels in static areas. That is the prototype painting under a 66–67 % dark veil, i.e. `--ods-color-scene-veil: rgba(13, 25, 22, 0.66)` from `jiangnan-night.css`.
- Baseline glass fill is `#283931` (dark), text is `#e7f2ea` (light on dark), pie is `#91bb8f` / `#dec67f` — the 夜雨 tokens (`bg-surface-glass: rgba(30,53,44,.86)`, `fg-default: #e5f2e9`, jade-400, gold-400).
- The prototype is the 烟雨 light theme: fill `#c9d7cc`, text `#112f17`, pie `#68986a` / `#e9d594`.

`shoot.json` has no `theme`, so the store's `auto` followed the capture browser's `prefers-color-scheme: dark`. Consequences: every colour row in section 7 compares a dark-theme baseline with a light prototype; **geometry rows are theme-independent and valid**. For colours I therefore also list what the light-theme tokens in `jiangnan-mist.css` say (read from source, not measured from a screenshot).

## 1. Payment summary pill (prototype)

### 1.1 Box

| Quantity | Value |
|---|---|
| Outer box | x = 542.3, y = 770.5, w = 402.2, h = 109.4 (right 944.5, bottom 879.9) |
| Centre | (743.4, 825.2) |
| Corner radius | **48.9 px** (fit rms 0.24 px). A full capsule (r = h/2 = 54.7) fits 3× worse (rms 0.69). The ends are therefore not semicircles: r ≈ 49 with ≈ 11.6 px of straight vertical side |
| In viewport units (1487 wide) | w 27.05vw, h 7.355vw, radius 3.29vw (= 44.7 % of the height) |

Width is content-driven: 40.6 (left padding) + 75.3 (pie) + 29.2 + 14.2 (dot) + 11.4 + 95 (label) + 27 + 69 (amount) + 40.5 (right padding) = 402.2.

### 1.2 Fill (frosted glass)

No scene detail is visible inside (colour σ ≈ 1–2 levels between content), so the backdrop blur is strong (≥ 20 px).

| Where (inside, away from content) | Colour | Lum |
|---|---|---|
| Median of whole interior | `#c8d6cb` | 210 |
| Top zone, left / middle / right | `#d2dcd3` / `#d0dcd2` / `#cedad0` | 217 / 216 / 215 |
| Left of pie (x 552–574, y 800–860) | `#c8d6cb` | 210 |
| Pie–dot gap (x 662–682) | `#cbd8ce` … `#d0dcd2` (top) | 213–217 |
| Label–amount gap (x 814–830) | `#cad8cd` (top `#cedacf`, bottom `#c3d3c6`) | 212 (215 → 207) |
| Right of amounts (x 908–934) | `#c7d6ca` (bottom `#bfd1c3`) | 210 (203) |
| Bottom-right corner zone | `#bfd1c3` | 204 |

So: essentially flat `#c9d7cc`, about 6 levels lighter along the top and about 6 darker towards the bottom-right (light from the top-left).

Scene just outside the pill at the same height: left `#c0cdc4` (lum 202), right `#b5c5b9` (lum 193); above the top edge `#cbd5cc`–`#cfd9d1` (210–215); below `#aabcaf`–`#b0c2b5` (183–189, inside the drop shadow).

Derived tint/opacity. The scene under the pill is not observable, so it was taken from the UI-free still the app actually uses (`scene.webp`), blurred with σ = 22 px inside the pill box (mean `#b7c7bb`), and a CSS-like model `tint·α + saturate(brightness(backdrop))·(1 − α)` was fitted to 15 content-free sample points:

| Recipe | Fit error (rms, levels) |
|---|---|
| **white, α = 0.25**, brightness 1.0, saturate 1.0–1.2 | 2.8–3.1 |
| token tint `rgb(232,244,233)`, **α = 0.36**, brightness 1.0, saturate 1.0 | 2.8 |
| current light token: `rgba(232,244,233,.68)` + saturate 1.4 | 15.0 (result `#d7e6d9` against target `#c8d7cb`: too light and too opaque) |

### 1.3 Rim (border) and inner highlight

The border is a bright specular rim, **≈ 2 px wide** (FWHM 2.1–2.3 px), whose peak sits 1.0–1.5 px inside the outer edge. It is not uniform:

| Segment | Peak colour | Peak lum | White-equivalent alpha over the fill |
|---|---|---|---|
| Top-left corner | `#f6f8f4` | 247 | ≈ 0.85 |
| Top, left third | `#f8fbf7` | 250 | ≈ 0.87 |
| Top, middle | `#f0f5ef` | 244 | ≈ 0.71 |
| Top, right third | `#e6f0e5` | 237 | ≈ 0.55 |
| Top-right corner | `#cbe1cd` (pale green, almost no white) | 219 | ≈ 0.1 |
| Right side | `#c8dccd` → `#bbd8bf` (pale green) | 215 | ≈ 0.1 |
| Bottom-right corner | `#f6fbf4` | 250 | ≈ 0.9 |
| Bottom, right third | `#dceddb` | 232 | ≈ 0.5 |
| Bottom, middle | `#d8e8d8` | 228 | ≈ 0.4 |
| Bottom, left third | `#cfe2d0` | 221 | ≈ 0.2 |
| Bottom-left corner | `#d9ecda` | 231 | ≈ 0.45 |
| Left side | `#c7dcca` (pale green) | 215 | ≈ 0.1 |

Brighter at the top (strongest top-left) and at the bottom-right corner; faint and slightly green on the two sides.

Inner highlight: along the bottom a soft glow about 8 px deep above the rim (lum 228 at the rim → 219 at 3 px → 212 at 6 px → 208 at 10 px); along the top only a very weak one (+5 lum fading within 6 px, middle of the top edge only). No other inner band.

### 1.4 Drop shadow

- Above and beside the pill: none measurable (≤ 3 lum).
- Below: soft shadow, darkest directly under the edge, fading over ≈ 24 px. Left half (x 570–700): lum 188 at 2 px below → 198–203 at 25–28 px below (−13, ≈ 6.5 %). Right half: −5 (≈ 3 %).
- Equivalent CSS: about `0 8px 24px rgba(24, 57, 44, 0.10–0.14)`; no separate tight contact shadow.

### 1.5 Pie chart

| Quantity | Value |
|---|---|
| Centre | (620.6, 826.1) — 0.9 px below the pill's centre line |
| Diameter | **75.3** (circle fit rms 0.21 px); bbox x 582.9–658.2, y 788.5–863.8 |
| Slice 1, 已收款 (paid) | `#68986a`, flat (σ ≈ 1.1) |
| Slice 2, 待收款 (pending) | `#e9d594`, flat (σ ≈ 1.8) |
| Boundary A | 0.1° — exactly the vertical line from the centre to 12 o'clock |
| Boundary B | 222.1° clockwise from 12 o'clock |
| Direction | green runs clockwise from 12 o'clock to 222.1°; gold fills 222.1° → 360° (upper-left) |
| Shares | green 61.7 %, gold 38.3 % (the sample amounts 3,600 / 2,400 would be 60 / 40 = 216°; the drawing is 6° off) |
| Gap / stroke between slices | none (1–1.5 px antialiased blend only) |
| Outline, ring, shadow | none; the fill around the pie is plain glass |

### 1.6 Legend

| | Row 1 | Row 2 |
|---|---|---|
| Row centre y | 806.2 | 845.0 |
| Dot centre / diameter / colour | (694.5, 806.4) / 14.2 / `#649565` | (694.6, 845.1) / 14.3 / `#e1cd8a` |
| Label text | `已收款金额` | `待收款金额` |
| Label ink box | x 713–808, y 797–815 | x 712–807, y 835–854 |
| Amount text | `¥3,600` | `¥2,400` |
| Amount ink box | x 835–904, y 798–814 (comma to 817) | x 835–904, y 837–853 (comma to 856) |

- Row pitch 38.7 px; the two rows are centred on y = 825.7.
- Label: CJK glyph ink height 18–19 px, five glyphs span 95 px → **font-size 19.5 px** (1.31vw). Weight: ink area equals MiSans VF at wght ≈ 380–400 and lies between PingFang SC Regular and Medium → **regular (400)**; stroke ≈ 2.45 px. Colour `#112f17` (core samples `#113018`, `#112d17`). The letterforms correlate best with PingFang SC (0.93), slightly less with MiSans (0.90).
- Amount: digit height 16 px, digit pitch ≈ 12.3 px, string width 69 px → **font-size 20 px** (range 20–20.5). Weight equivalent to SF Pro 500 / PingFang Medium, or MiSans wght ≈ 380–400 (MiSans digits are heavy) → **400 in MiSans**; stroke ≈ 2.3 px. Colour `#0f3116` (same dark green as the label). Both amounts have identical width, so left/right alignment cannot be told apart; right edge is 904 for both.
- Horizontal gaps: pie right edge 658.2 → dot left edge 687.4 = **29.2**; dot right edge 701.6 → label ink 713 = **11.4** (10.4 for 待); label ink right 808 → amount ink left 835 = **27**; amount ink right 904 → pill edge 944.5 = **40.5**.
- Inner paddings: left 40.6 (edge → pie), right 40.5 (amount ink → edge), top 18.0 and bottom 16.1 (edge → pie).

## 2. Dock (prototype)

### 2.1 Box

| Quantity | Value |
|---|---|
| Outer box | x = 398.7, y = 912.2, w = 689.4, h = 102.5 (right 1088.1, bottom 1014.7) |
| Centre | (743.4, 963.5) |
| Corner radius | 51.3 = h/2, a true capsule (fit rms 0.12 px; free-radius fit returns 51.25) |
| In viewport units | w 46.36vw, h 6.90vw |

### 2.2 Fill

Strongly blurred glass, lighter on the left, darker on the right (follows the scene plus top-left lighting):

| x | y = 922 (top zone) | y = 968 (middle) | y = 1006 (bottom zone) |
|---|---|---|---|
| 560–600 | `#d0dbd2` | `#cfdbd1` | `#ccd9cf` |
| 700 | `#cfdad1` | `#cddad0` | `#cad8ce` |
| 760 | `#cbd8ce` | `#c8d6cb` | `#c5d4c9` |
| 820 | `#c8d5cb` | `#c5d4c8` | `#c0d1c4` |
| 880 | `#c3d3c6` | `#bed0c1` | `#bccec0` |
| 940 | `#c1d1c3` | `#bccebf` | `#bbcdbd` |
| 1036–1060 | `#bfd1c2` | `#b8ccbb` | `#b6cbb9` |

Scene just outside: left of the Dock `#b3c5b9` (lum 192), right `#8fab96`–`#95af9b` (165), above `#b1c5b7` (192), below `#92a89a`–`#9db5a5` (162 → 175).

Derived tint/opacity (same method as for the pill; blurred still under the Dock averages `#a2b9a8`, target average `#c5d4c7`, 15 sample points):

| Recipe | Fit error (rms, levels) |
|---|---|
| **white, α = 0.38**, brightness 1.0, saturate 1.0 | 3.6 |
| white, α = 0.28, brightness 1.06, saturate 1.0 | 3.1 (best) |
| token tint `rgb(232,244,233)`, α = 0.48, brightness 1.0, saturate 1.0 | 4.1 |
| current light token: `rgba(232,244,233,.68)` + saturate 1.4 | 13.1 (simulated `#d4e4d7` at x = 560, `#d0e2d3` at x = 810, `#cce0cf` at x = 1057 against the prototype's `#cedad1`, `#c6d4c8`, `#b9ccbc`: +9, +13, +20 lum, because 68 % opacity hides the scene's left-to-right falloff) |

The Dock is therefore more opaque than the pill (white 38 % against 25 %), and both are far more transparent than the current 68 % token. Saturation above 100 % makes the fit worse for both: the prototype glass is slightly less saturated than the water behind it.

### 2.3 Rim, highlight, shadow

Rim ≈ 2 px wide, peak 1.25 px inside the edge on top (3 px inside along the bottom-left quarter):

| Segment | Peak colour | Lum | White-equivalent alpha |
|---|---|---|---|
| Top, left third | `#e9f0ea` | 238 | ≈ 0.55 |
| Top, middle | `#e2ebe3` | 232 | ≈ 0.45 |
| Top, right third | `#f0f7f0` | 245 | ≈ 0.8 |
| Top-left corner | `#e1eae2` | 231 | ≈ 0.4 |
| Top-right corner | `#bdd3c0` (no white rim) | 205 | ≈ 0 |
| Right end | `#cbe9cb` (pale green) | 224 | ≈ 0.45 |
| Bottom-right corner | `#daf3db` (pale green-white) | 236 | ≈ 0.65 |
| Bottom, right third | `#bcd8be` | 208 | ≈ 0.13 |
| Bottom, middle and left | `#c0d7c2` (same lum as fill, only greener) | 209–211 | ≈ 0 |
| Bottom-left corner, left end | `#cee1d1` | 216–220 | ≈ 0.08 |

Inner highlight: none along top and bottom (crisp rim); a 5 px pale-green glow inside the right end and the bottom-right corner.

Drop shadow: below the bottom edge lum 161 at 1 px → 164 at 8 px → 168 at 12 → 171 at 20 → 175 at ≥ 26 px (−14, ≈ 8 %). Sides: −7…−8 at the edge, gone within 10–20 px. Top: −2…−4 in the first 2 px only. Fits **`0 10px 28px rgba(24, 57, 44, 0.14)`**; there is no separate contact shadow.

### 2.4 Items

Five equal columns, pitch **133.25 px**, cell width 127.5 px (= selected highlight), column gap ≈ 5.75 px. Dock padding ≈ 13–14 px on every side (measured at the highlight: left 13.2, top 14.1, bottom 12.4). No separators. The group of five is centred on the Dock (centre item at x = 743.0).

| # | Label | Item centre x | Icon ink box | Icon ink w × h | Label ink box |
|---|---|---|---|---|---|
| 1 | `工作台` (selected) | 476.0 | x 462–490, y 936–965 | 28 × 29 | x 454–498, y 977–991 |
| 2 | `项目管理` | 609.3 | x 593–625, y 937–965 | 32 × 28 | x 580–639, y 977–991 |
| 3 | `收款日历` | 743.0 | x 728–758, y 936–966 | 30 × 30 | x 714–772, y 977–991 |
| 4 | `数据分析` | 875.8 | x 863–889, y 937–965 | 26 × 28 | x 846–905, y 977–991 |
| 5 | `系统设置` | 1009.0 | x 994–1024, y 936–966 | 30 × 30 | x 980–1038, y 976–991 |

- Icon centre y ≈ 950.8; label centre y = 984.0; icon ink bottom → label ink top = **12 px**. Icon + label together span y 936–991, centred on the Dock centre (963.5).
- Icon size: equivalent to a 24-unit icon font drawn at **≈ 36 px** (home 28 × 29 ink ⇔ Remix at 37 px, folder ⇔ 36 px, calendar ⇔ 35 px). Stroke ≈ 2.7 px (2.63–2.78), i.e. ≈ 1.8/24 of the icon box; round joins and round outer corners (≈ 3–4 px radius). Style: outline (line), not filled — except the chart, see below.
- Icon colour: `#13411c` (home), `#194424` (folder), `#12391b` (calendar), `#133d1d` (settings) → one dark green ≈ **`#153e1e`**. The chart icon is lighter: outlines `#325a38`, bar interiors ≈ `#6f9475` (mean of the glyph `#5a7f60`).
- Label: glyph ink height 14 px, four glyphs span 58–59 px → **font-size 15 px** (1.01vw). Weight: ink area equals PingFang SC Medium (ratio 0.99–1.03), i.e. MiSans VF wght ≈ 450 → **medium (≈ 450–500)**. Colour ≈ **`#1f4027`** (core samples `#1b4022`–`#25412b`).
- Selected vs unselected: **no colour difference** in icon or label; only the highlight behind.

Glyph descriptions (measured from coverage maps and confirmed by eye on a 5× contact sheet; final Remix picks in section 2.6):

1. 工作台 — house outline drawn as one closed rounded shape: pointed roof with a rounded apex at (476.3, 936), roof edges falling 11 px over 14 px to the walls at y ≈ 947, vertical walls 3 px thick at x 462–465 and 487–490, rounded bottom corners, floor at y 962–965. No eaves overhang, no chimney. In the bottom centre an outlined doorway shaped like an inverted U: outer 10.5 × 10 px (x 471–481.5, top y 954), posts ≈ 2.2 px thick, opening ≈ 3.5 px wide; the floor line stops at the posts, so the doorway is open at the bottom.
2. 项目管理 — classic folder outline: tab on the upper left (x 594–608, top y 937) stepping down to the body top (y 941) with a rounded transition, body with rounded corners (radius ≈ 3–4 px), nothing inside.
3. 收款日历 — calendar outline with rounded corners, two binder pegs crossing the top edge (x ≈ 736 and 749, y 936–943), a full-width header line (y 946–948), and below it two rows of two short faint dashes (y ≈ 951–953 and 956–957; coverage ≤ 0.5, they read as light date marks).
4. 数据分析 — three separate upright bars rising left → right (heights 12, 19, 28 px; each ≈ 7 px wide, ≈ 2 px apart, bottoms aligned at y 965), each drawn as a rounded rectangle with a dark-green outline and a mid-green interior. It is the only two-tone icon and looks lighter than the other four.
5. 系统设置 — gear outline with eight rounded teeth (top, bottom, left, right and four diagonals) and a centre ring (outer diameter ≈ 12 px, hole ≈ 6 px).

### 2.5 Selected item (工作台)

| Quantity | Value |
|---|---|
| Highlight box | x = 412.0, y = 926.3, w = 127.5, h = 76.0 (right 539.4, bottom 1002.3) |
| Centre | (475.7, 964.3) — 0.85 px below the Dock centre line |
| Corner radius | 37.8 = h/2 (capsule), fit rms 0.22 px |
| Fill | soft radial gradient, not a vertical one: hot spot `#d7edce` around (456–466, 943–948), i.e. 38 % from the left and 25 % from the top; `#d0e9c7` at top centre; `#cce5c4` mid; `#c1deba` at x ≈ 516; edges and bottom `#bbdbb6`–`#bedeb8` |
| Border | none as such; a faint 1 px lighter line on the top edge (`#d5e8d0`, +4 lum) |
| Shadow | only below: `#b4c5b9` (lum 193) directly under the bottom edge against Dock fill 209 (−16), back to normal 8 px lower; nothing at the sides or top. Roughly `0 3px 8px rgba(24, 57, 44, 0.16)` |
| Glow | none outside the shape |

### 2.6 Remix Icon picks

Method: each prototype glyph was correlated against Remix Icon 4.8 glyphs rendered from `remixicon.ttf` at 30–38 px. The method was validated on the baseline, where it identifies the five known icons at the known 26 px with correlation 0.95–0.98. The prototype icons are not Remix glyphs (their stroke is 1.8/24 of the box, Remix line icons use 2/24, and they have round outer corners), so the best scores are lower; shapes were then compared as rendered glyph maps.

| Item | Pick | Score | How close | Size at which the ink box matches |
|---|---|---|---|---|
| 工作台 | **`ri-home-5-line`** | 0.77 (`ri-home-line` 0.79, `ri-home-6-line` 0.80) | Same silhouette (no eaves, walls continue the roof line, flat floor). Remix shows the door as one solid vertical bar; the prototype has an outlined doorway 10 px wide. `ri-home-line` is the same house with no door; `ri-home-6-line` has a horizontal bar instead. The current `ri-home-4-line` has eaves and is clearly a different silhouette | 36 px → ink 28 × 28 (prototype 28 × 29) |
| 项目管理 | **`ri-folder-line`** (unchanged) | 0.92 | Same shape | 36–37 px → ink 30 × 28 (prototype 32 × 28) |
| 收款日历 | **`ri-calendar-2-line`** (unchanged) | 0.71 (`ri-calendar-line` 0.75) | Same frame, pegs and header line. Remix has one row of three dots, the prototype two rows of faint marks; `ri-calendar-line` has none. Remix outer corners are square, the prototype's are rounded | 35 px → ink 30 × 30 (prototype 30 × 30) |
| 数据分析 | **`ri-signal-cellular-3-line`** | 0.58 line, 0.75 fill | The only Remix glyph with three separate bars ascending left to right. It is wider than tall (29 × 25 at 33 px; prototype 26 × 28). `ri-bar-chart-fill` has separate bars but in the order short–tall–medium; the current `ri-bar-chart-2-line` has touching bars with the tallest in the middle | 31–32 px → ink 27–28 × 24 |
| 系统设置 | **`ri-settings-2-line`** | 0.91 | Same eight-lobed gear with centre ring | 32 px → ink 30 × 30 (prototype 30 × 30) |

A single icon size cannot match all five ink boxes: at 36 px the home, folder and calendar fit and the gear and bars are 3–4 px too large; at 32 px the reverse. Use 36 px for the first three and 32 px for `settings-2` and `signal-cellular-3`, or 35 px for all as a compromise (errors ≤ 3 px except the bars' width, +5 px). At 36 px a Remix line stroke is 3.0 px against the prototype's 2.7 px (10 % heavier); that cannot be changed with an icon font.

If an exact glyph match matters more than staying inside Remix: the prototype's home (outlined doorway whose posts end on the floor line), calendar (rounded frame, two rows of marks) and bars are closer to a 24-grid, 2 px round-stroke outline set drawn at ≈ 32–34 px; they would have to be inline SVGs.

Chart icon colouring in the prototype (the only two-tone icon): bar outlines `#2b5531`–`#3f6644`, bar interiors `#5c8261` (left bar) → `#688d6f` (middle) → `#6d9371` (right).

### 2.7 Beside the Dock

Nothing. No notification bell, no badge, no separator on either side (high-contrast scan of 170 px left and right of the Dock finds only ripple highlights in the water).

## 3. Vertical rhythm (prototype)

| Quantity | Value |
|---|---|
| Pill bottom → Dock top | **32.3 px** (2.17vw) |
| Dock bottom → window bottom | **43.3 px** (2.91vw) |
| Pill centre x | 743.4 |
| Dock centre x | 743.4 |
| Window centre x | 743.5 |

Both are horizontally centred in the window (within 0.1 px).

## 4. Traffic lights (prototype)

Bounding box of the three buttons: **x 11–59, y 9–21** (48 × 12). Circles ≈ 12 px in diameter, pitch ≈ 18.7 px: red centre (16.3, 15.2) `#ed5954`, yellow (35.2, 15.2) `#f6bb2f`, green (53.7, 15.3) `#46c24e`.

## 5. Anything else drawn over the scene

Nothing else: no logo, no title, no text, no other buttons. Confirmed numerically for the title-bar strip (y 0–69): between x = 100 and x = 900 the maximum local contrast is 2–7 levels and the maximum saturation 8–10 (mist and faint rain only); contrast appears only at x < 100 (traffic lights) and x ≥ 900 (willow). The same scan finds nothing beside the pill or the Dock.

## 6. Scene landmarks (prototype)

Partly measured, rest `TODO`:

- Bridge arch opening: top at (435, 524); spans x ≈ 318–547 at the water; symmetric about x ≈ 432.
- Waterline (bank or wall foot meets the water): x = 100 → y ≈ 668 ± 3; x = 700 → y ≈ 630 ± 4; x = 1400 → y ≈ 619 ± 3 (very soft in the mist).
- Girl: visible part x 401–453, y 353–452 (≈ 52 × 99 px), standing behind the bridge railing at the crown of the bridge (railing top rail at y ≈ 452–470 hides her from the hips down). Head x 409–453, y 353–389 including two hair buns at the top corners (buns at x 409–421 and 441–453, y 353–365); face ≈ x 421–445, y 363–389; shoulders and crossed collar y 391–410; sleeves reach x 401 and 453 at y 430–445. `TODO` clothing colours and facing.
- Bridge deck ends, willow, houses, hills, mist bands: `TODO`.

### 6.1 Rain in the prototype

Rain streaks **are** painted into the prototype: thin, light, straight lines, visible mainly against the sky and hills.

| Property | Value |
|---|---|
| Angle | **13.5° from vertical, leaning like `/`**: the top of each streak is to the right of its bottom (rain falls towards the lower-left). Spread ± 2° (10th–90th percentile 12.5°–16°) |
| Count | ≈ 7 clearly detectable streaks per 200 × 200 px in the open sky (29 in an 800 × 200 px strip, threshold +1.2 lum over ≥ 14 px); up to ≈ 15 in front of the hills. Fainter ones exist below the threshold |
| Length | median 34 px, 90th percentile 70 px, longest ≈ 110 px |
| Width | ≈ 1.5 px (cross-section 1.4 / 4.1 / 1.5 levels over three pixels) |
| Brightness | +2.5 lum (median) to +5 lum (strongest) above a sky of lum ≈ 228, i.e. white at ≈ 10–20 % on the centre pixel |
| On the water | not separable from the wave texture; the water shows ripple rings instead (`TODO`) |

## 7. Baseline vs prototype

Geometry rows are reliable. Colour rows: the baseline column is the dark theme as captured; the note gives the light-theme token from the CSS source.

### 7.1 Geometry

| Item | Prototype | Baseline | Delta (prototype − baseline) |
|---|---|---|---|
| Pill box x, y, w, h | 542.3, 770.5, 402.2, 109.4 | 526.5, 782.1, 433.9, 111.8 | y −11.6, h −2.4; w −31.7 (baseline amounts are longer: ink 92 px vs 69 px, which accounts for 23 px) |
| Pill radius | 48.9 (not a capsule) | 55.4 (capsule, h/2) | −6.5 |
| Pill centre x | 743.4 | 743.5 | 0 |
| Dock box x, y, w, h | 398.7, 912.2, 689.4, 102.5 | 413.2, 922.8, 660.4, 95.2 (CSS box 660 × 96) | w **+29**, h **+6.5**, y −10.6 |
| Dock radius | 51.3 (capsule) | 47.5 (capsule) | +3.8 (follows the height) |
| Gap pill ↔ Dock | 32.3 | 28.8 | +3.5 |
| Gap Dock ↔ window bottom | 43.3 | 40.0 | +3.3 |
| Pie diameter | 75.3 | 76.5 | −1.2 |
| Pie start / direction | 12 o'clock, paid slice clockwise | 12 o'clock, paid slice clockwise | same |
| Pie left padding (edge → pie) | 40.6 | 39.6 | +1.0 |
| Pie → dot gap | 29.2 | 29.3 | 0 |
| Legend dot diameter | 14.2 | 14.0 | 0 |
| Dot → label ink gap | 11.4 | 14.3 | **−2.9** |
| Label → amount ink gap | 27 | 31 (to the longest amount) | **−4** |
| Amount → right edge | 40.5 | 40.4 | 0 |
| Legend row pitch | 38.7 | 36.5 | +2.2 |
| Legend label font-size | 19.5 px | 20 px (MiSans, identified at 0.994) | −0.5 |
| Legend label weight | ≈ 400 (stroke 2.45 px) | 500 (stroke 2.8 px) | lighter by one step |
| Amount font-size / weight | 20 px / ≈ 400 MiSans-equivalent | 20 px / 500 | weight lighter |
| Amount alignment | both rows same width | right-aligned to x = 920 | cannot be distinguished |
| Dock item pitch | 133.25 | 128.5 | +4.75 |
| Dock padding / column gap | ≈ 13.5 / 5.75 | 11 (10 + 1 border) / 4 | +2.5 / +1.75 |
| Dock icon size (font-size equivalent) | ≈ 36 px (ink 28–32 × 28–30) | 26 px (ink 21–23 × 20–22) | **+10 px (×1.38)** |
| Dock icon stroke | ≈ 2.7 px | ≈ 2.4 px (2.3–2.9) | +0.3 |
| Icon ink bottom → label ink top | 12 | 12 | 0 |
| Dock label font-size | 15 px | 14 px (MiSans 500, identified at 0.994) | +1 |
| Dock label weight | PingFang Medium ≈ MiSans 450 | MiSans 500 | slightly lighter |
| Selected highlight box | 412.0, 926.3, 127.5 × 76.0, r 38 | 424.2, 933.0, 124.4 × 74.0, r 37 (capsule; measured x 424–548.6, y 933–1007) | w +3.1, h +2.0 |
| Selected highlight inset in Dock | 13.2 left, 14.1 top, 12.4 bottom | 11 all round | +2…+3 |

### 7.2 Icon glyphs

| Item | Prototype | Baseline | Same? |
|---|---|---|---|
| 工作台 | house without eaves (walls continue the roof line), outlined door with rounded top, floor line open inside the door | `ri-home-4-line` at 26 px (identified at 0.974): house **with** eaves and a single vertical stroke as door | **different** |
| 项目管理 | folder outline | `ri-folder-line` | same shape, baseline 28 % smaller |
| 收款日历 | calendar, two pegs, header line, faint two-row date marks | `ri-calendar-2-line` (pegs, header line, one row of three dots) | close; dots differ |
| 数据分析 | three separate ascending bars, mid-green, rounded tops | `ri-bar-chart-2-line` (three touching outlined bars, tallest in the middle) | **different** |
| 系统设置 | eight-lobed gear with centre ring | `ri-settings-3-line` (hexagonal cog) | **different** |

### 7.3 Colours and materials

| Item | Prototype | Baseline as captured (dark theme) | Light-theme token (source) |
|---|---|---|---|
| Scene brightness | as painted | 0.33 × prototype + ≈ 15 (66 % dark veil) | veil alpha 0 → as painted |
| Pill fill | `#c9d7cc`, top `#d1dcd3`, bottom-right `#bfd1c3` | `#283931` | `rgba(232,244,233,.68)` + saturate 140 % + `inset 0 0 22px rgba(255,255,255,.28)`: simulated over the still ≈ `#d7e6d9`, i.e. 15 levels lighter and much more opaque than the prototype. Target recipe: white 25 % (or the token tint at 36 %), saturate 100 % |
| Dock fill | `#d0dcd2` (left) → `#c6d5ca` (centre) → `#b9ccbc` (right) | `#283931` | same token: simulated `#d4e4d7` at x = 560 (+9 lum against the prototype), `#d0e2d3` at x = 810 (+13), `#cce0cf` at x = 1057 (+20). Target recipe: white 38 % (or the token tint at 48 %), saturate 100 % |
| Rim | ≈ 2 px specular, white up to 87 % on top and at the bottom-right corner, ≈ 10 % on the sides | 1 px `#495650` line + 2 px fade (barely visible) | `1px solid rgba(255,255,255,.55)` + `inset 0 1px 0 rgba(255,255,255,.85)` + `inset 0 -1px 0 rgba(255,255,255,.25)`: uniform, thinner than the prototype's rim, no bottom-right hot spot |
| Shadow | ≈ `0 10px 28px rgba(24,57,44,.14)`, no contact shadow | `0 12px 32px rgba(0,0,0,.34)` | `0 14px 34px rgba(24,57,44,.16), 0 2px 6px rgba(24,57,44,.08)`: slightly larger, plus a contact shadow the prototype lacks |
| Pie paid / pending | `#68986a` / `#e9d594` | `#91bb8f` / `#dec67f` | `#629569` / `#e9ce86` (close; pending slightly more saturated than the prototype) |
| Legend dots | `#649565` / `#e1cd8a` | `#91bb8f` / `#dec67f` | same tokens as the pie |
| Legend text | `#112f17` | `#e7f2ea` | `#18392c` (slightly bluer and lighter than the prototype) |
| Dock icon / label | `#153e1e` / `#1f4027` | `#e7f2ea` | `#18392c`; selected `#143524` |
| Selected highlight | radial `#d7edce` → `#bbdbb6`, shadow below only | vertical gradient `#a1c79f` (top) → `#94bc93` (middle) → `#87b288` (bottom), 1 px light line on the top edge (`#d1e4d0`), green glow below fading over ≈ 10 px | `linear-gradient(180deg,#d9eed6,#c3e2c2)` + `inset 0 1px 0 rgba(255,255,255,.5)` + `0 6px 16px rgba(98,149,105,.24)`: vertical instead of radial, bottom ≈ 8 levels lighter than the prototype, glow larger and greener |
| Selected icon / label colour | same as unselected (`#13411c` / `#1b4022`) | `#101916` on the green highlight, i.e. inverted against the unselected `#e7f2ea` | `--ods-color-accent-fg: #143524` vs unselected `#18392c`: nearly identical, fine |

### 7.4 Scene

- **Registration: identical.** Eleven static landmarks (girl's head and body, arch top, both arch feet, both bridge ends, house roofs, left tree, hills, left bank wall) match at dx, dy = 0.00 ± 0.04 px with correlation 0.990–0.999. No shift, no scaling.
- Willow and water differ locally by up to 2 px with lower correlation (0.85–0.96): the sway and shimmer animation, as designed.
- Static-area residual after removing the veil: σ = 0.3–0.9 levels (out of 255 × 0.33), i.e. the still is a faithful copy.
- **Rain.** Two layers are visible in the baseline and they disagree:
  - The painted streaks survive in the still at 60–75 % of their prototype contrast (2× upscale, WebP q80 and the downscale soften 1.5 px lines), still at 13.5° leaning `/`.
  - The animated streaks lean the **other way**: measured +11.7° and +10.1° (`\`, falling to the lower-right), as coded (`SLANT = tan 11°`, top drawn at `x − length·SLANT`). They are also sparser and shorter: ≈ 2.4–3.5 per 200 × 200 px (96 streaks over the window) against ≥ 7 painted ones, length 14–32 px against a median of 34 px (up to 110 px). Under the dark veil they reach only +1…+2 levels, so in this capture the animated rain is practically invisible; in the light theme it will show as streaks crossing the painted ones.
- Erased-UI artefacts, blur comparison, ripple density: `TODO`.

## 8. Change these to match the prototype (most visible first)

1. **Theme.** Render and compare the workbench in the light 烟雨 theme. The baseline shows 夜雨: the scene is dimmed to a third, the glass is dark, text is light. Either capture with `prefers-color-scheme: light` / `theme=light`, or, if the workbench must always look like the prototype, keep the dark veil and dark glass off this page.
2. **Dock size.** 689.4 × 102.5 px, radius = height / 2, bottom gap 43.3 px (now 660 × 96, gap 40). The `clamp()` caps are what hold it back: width → 46.4vw with cap ≥ 690, height → 6.9vw with cap ≥ 103, offset → 2.91vw with cap ≥ 44.
3. **Dock icons.** 36 px instead of 26 px. Replace the chart icon (three separate ascending mid-green bars) and the settings icon (eight-lobed gear with centre ring, `ri-settings-2-line`); home icon: house without eaves and with a door (`TODO` final pick).
4. **Dock layout.** Padding 13.5 px (now 10 + 1), column gap 5.75 px (now 4) → selected highlight 127.5 × 76 px at x 412.0, y 926.3. Label 15 px (now 14), weight 450–500, icon → label ink gap stays 12 px.
5. **Glass material** (light theme): pill fill target `#c9d7cc` (white ≈ 27 % over the blurred scene), Dock `#d0dcd2` → `#b9ccbc` left to right (white ≈ 40 %); blur ≥ 20 px. Rim 2 px, white ≈ 85 % along the top (strongest top-left), ≈ 90 % at the bottom-right corner, ≈ 10 % on the sides. Shadow `0 10px 28px rgba(24,57,44,.14)` without the contact shadow.
6. **Selected item.** Radial highlight (`#d7edce` at 38 % / 25 % → `#cce5c4` → `#bbdbb6` at the edge), capsule, no bright inset line, shadow only below (`0 3px 8px rgba(24,57,44,.16)`); icon and label keep the same dark green as the other items.
7. **Pill shape.** Height 109.4 px (7.355vw; now 111.8), corner radius 49 px instead of a full capsule, top at y = 770.5; gap to the Dock 32.3 px (now 28.8; cap ≥ 33 at 2.17vw).
8. **Legend typography.** Label 19.5 px weight 400 (now 20 px / 500); amount 20 px weight 400 (now 500); colour `#112f17`; dot → label gap −3 px (to 11.4 px ink gap); label → amount gap −4 px (to 27 px); row pitch 38.7 px (now 36.5).
9. **Pie.** Diameter 75.3 px (now 76.5); colours `#68986a` / `#e9d594`; start angle and direction are already right.
10. **Dock and legend text colour.** Icons `#153e1e`, Dock labels `#1f4027`, legend `#112f17` (light token `#18392c` is slightly bluer).
11. Scene registration needs no change. Rain, ripples and erased-area artefacts: `TODO`.
