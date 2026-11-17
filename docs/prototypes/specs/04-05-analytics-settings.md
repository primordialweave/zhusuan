# 04 数据分析 / 05 系统设置 — prototype specification and baseline differences

Status: **in progress** (sections are appended as measurements finish; open items are marked `TODO`).

## 0. Method and conventions

- Sources (all 1487 × 1058 px, 1 image px = 1 CSS px — the macOS traffic lights measure 12 px):
  - P4 `docs/prototypes/04-analytics.png`, P5 `docs/prototypes/05-settings.png`
  - B4 `/tmp/orange-resume/shots/base-04-analytics.png`, B5 `/tmp/orange-resume/shots/base-05-settings.png`
- Coordinates are prototype pixels, origin top-left. `x=a..b` is an inclusive pixel range; a box is `(x, y, w, h)`.
- Numbers come from PIL/numpy scans (scripts in `/tmp/orange-resume/agent-c/`); texts were read with macOS Vision OCR and checked against the image.
- Font sizes and weights are **fitted against the app's own fonts**: each prototype text was compared with the same string rendered in `MiSansVF.ttf` (or Songti SC) and measured by the same code — size from the ink width of the whole string, weight from ink area and stroke width. The method reproduces the baseline's known CSS exactly (24 px / 600, 14 px / 400, 20 px / 600), so sizes are good to about ±0.5 px and weights to about ±40 on the `wght` axis. Section D.2 lists all of them. No text in either prototype has letter-spacing.
- Colours of thin text are the darkest core of the ink (anti-aliased pixels excluded). Surface colours are what is on screen after the scene shows through, i.e. composites, not token values.
- **The two baselines were shot in the dark theme** (panel `#212d28`, light text; 外观设置 shows 跟随系统 selected). Both prototypes are the light theme (烟雨). Colour comparisons in section E therefore give the prototype's light target only; re-shoot the baseline with 浅色 before judging colour.

## A. Shared shell (identical in P4 and P5)

### A.1 Work panel

| Property | Prototype | Baseline |
|---|---|---|
| Box | `(80, 82, 1328, 803)` — x=80..1407, y=82..884 (P5 bottom is y=883) | `(74, 82, 1339, 816)` — x=74..1412, y=82..897 |
| Width share | 89.3 % of the window, centred (80 px left, 79 px right) | 90.0 %, 74 px side margins |
| Corner radius | ≈ 40 px (circle fits 39.3 and 40.8 on the top-left corner) | ≈ 31 px (fit 30.4 on the fill edge + 1 px border) |
| Fill | Composite `#e9f2ec` (median). Range `#e0ede4` (top-right, where the willow is behind) to `#ecf5ef`. | Opaque `#212d28` |
| Scene show-through | Almost none. Inside empty areas the luminance noise is σ ≈ 0.6 levels, so no leaf, roof or bridge shape is visible; only a slow tonal drift of ≤ 4 % remains. Equivalent to a fill of about `rgb(236 244 238 / 0.78–0.85)` over a heavily blurred backdrop (the design doc's `rgb(241 248 242 / .94)` gives the same visual result if the backdrop is pre-blurred). | None |
| Border | No dark outline. A bright rim instead: 1 px on left/right (`#eef8f2`, `#f1f9f3`), 2–3 px on top (`#eef6f0`, `#f3fbf5`, `#f2faf4`), 2 px on bottom (`#f1f8f2`, `#f0f8f2`). | 1 px `#35413b`/`#36413c` (darker-than-scene outline), top edge `#2c3732` |
| Shadow | No drop shadow worth building. Edge profiles (mean luminance per pixel row/column): below the bottom edge the scene is flat within ±1 level after a single 1 px line that is ≈ 2–3 % darker (`#bacec1`); right edge the same. Left and top show at most a 2–5 % darkening over the last ≈ 15–20 px before the edge, which may just be the painting. | none visible (1 px outline only) |
| Inner padding | Rules and dividers start 44–47 px from the panel edge (x=124..127) and end 45 px before the right edge (x=1361..1362). Headings and body text start a further ≈ 16 px in (x=140..147). Title ink top is 51 px below the panel top. | Content starts at x=123 (49 px), first element at y=123..131 |

### A.2 Scene around the panel (prototype)

Light, low-contrast and unblurred outside the panel:

- Top band (y=0..80): pale mist `#e1e9e3`; willow leaves enter from x ≈ 1200 (`#d1dece` → `#a3bb95` at the top-right corner).
- Left band (x=0..72): mist `#dce5e0` at the top, tree greens `#bcceb7` → `#a7c0a7`, a stone embankment around y=600..700 (`#9eb09d`), water below (`#aac4ae` → `#aec9b9`).
- Right band (x=1415..1487): willow `#b6c9aa` at the top, white-wall houses and mist `#d6e2d4`/`#cfddd6` in the middle, water `#bfd4c5` → `#91b59c` at the bottom.
- Bottom band (y=1020..1058): water `#9bbba7` → `#8db297` with faint ripple rings.
- Band between panel and Dock (y=888..908): `#b8cdbf` → `#a0bea7`.

Baseline: the same scene dimmed to dark grey-green (`#565e5a` top-left, `#3c4a41` bottom).

### A.3 Dock

| Property | Prototype | Baseline |
|---|---|---|
| Box | `(398, 912, 691, 101)` — x=398..1088, y=912..1012, centred on x=743 | `(414, 923, 659, 95)` — x=414..1072, y=923..1017 |
| Shape | Full pill, radius ≈ 50 (row widths match a 50 px circle) | Full pill, radius ≈ 47 |
| Fill | Translucent glass. Composite `#d6e6da` at the left drifting to `#c7dcca` at the right (scene shows through softly); vertical gradient `#d9e7dd` (top) → `#d1e3d6` (bottom). | `#26372f` |
| Edge | 2 px bright top rim (rows y=912..913 average `#f0f6f0`-ish, luminance 240–246 against 225 inside; pure white at the upper-left curve) and a bright rim along the lower-right curve (`#eefcee`). No dark outline. | 1 px lighter outline (`#3b4b43`/`#44514b`) |
| Shadow | Soft contact shadow under the Dock: darkest directly below the edge (≈ 7–10 % darker than the water) and gone after ≈ 14–16 px. Roughly `0 6px 14px rgb(20 60 40 / .12)`. Nothing above or beside it. | not measured (dark on dark) |
| Padding | Selected pill is inset 14 px from the Dock's top, 12 px from its bottom and 14 px from its right end, so: padding ≈ 13–14 px, five items ≈ 129 px wide with ≈ 4 px gaps. | pill inset ≈ 10–11 px |
| Gap panel bottom → Dock top | **28 px** (884 → 912; 29 in P5) | 26 px (897 → 923) |
| Dock bottom → window bottom | 46 px | 40 px |
| Items | 5, centres at x ≈ 475.5, 609, 743, 876, 1009.5 (pitch 133.5) | centres ≈ 486.5, 614.5, 743, 871.5, 1000 (pitch 128.3) |
| Icon | ≈ 28 px box (bboxes 25–32 wide × 27–29 high), y=936..963, line icons ≈ 2.5 px stroke, `#0c3414` | ≈ 22 px, y=947..968, `#e7f2ea` |
| Label | 工作台 / 项目管理 / 收款日历 / 数据分析 / 系统设置; ink y=976..989 (14 px high → ≈ 15 px font), `#122a19`, medium weight | ink 13 px high (≈ 14 px font), y=980..992, `#e7f2ea` |
| Icon → label gap | 12 px (963 → 976) | 11 px (968 → 980) |
| Highlighted item | P4: 数据分析; P5: 系统设置 | same items |
| Highlight pill | P4 `(810, 926, 128, 75)`, P5 `(945, 926, 130, 75)`; full pill (r ≈ 37); vertical gradient `#cdedca` (top) → `#b6e1b5` (bottom); a soft shadow just below it (`#b5cbbb` at y ≈ 996). Label and icon stay dark (`#0c2b15`, icon `#0c4414`). | `(810, 934, 124, 73)`; solid mid green `#94bd94` (`#9ec59d` → `#89b48a`); label/icon switch to near-black `#101917` |

### A.4 Window controls

Prototype: red `#e35950`, yellow `#f1ba2e`, green `#43bc53`, each 12 px, at x=10..21, 29..40, 48..59, y=9..21. These are the native macOS buttons baked into the image — do not draw them. The baseline browser shot has none.

## 04 数据分析 (P4)

### B. Page header

| Element | Box / position | Style |
|---|---|---|
| Title `数据分析` | ink x=141..337, y=133..178 (197 × 46); four glyphs 46 px wide, advance 50.3 | **Serif (Songti-type), bold–heavy.** Thin horizontals ≈ 3 px, thick verticals ≈ 5 px (about 20 % heavier than Songti SC Bold scaled to this size). Font-size ≈ 50 px, letter-spacing 0. Colour `#0d3016`. |
| Subtitle `了解收款进度与资金结构` | ink x=142..405, y=195..216 (264 × 22); advance 24.3 | Sans, regular (2 px strokes). Font-size ≈ 24 px, letter-spacing 0. Colour `#3d4a3f`. 17 px below the title ink. |
| Eyebrow / breadcrumb | none | — |

Right-side controls, vertically centred on y ≈ 170 (the middle of the title + subtitle block):

**1. Period segmented control** (周 / 月 / 季 / 年, `月` selected)

- Track: `(871, 148, 290, 46)`; full pill (fitted radius 20–21); border ≈ 1.5 px `#c6d3cb` with a white inner highlight; fill indistinguishable from the panel (`#e9f2ed`), i.e. transparent or ≤ 10 % white.
- Four equal segments ≈ 70.8 px wide; option centres x ≈ 909, 980, 1050.5, 1121.5.
- Selected segment: `(944, 151, 74, 40)`, pill (r ≈ 20), 3 px inset from the track top and bottom; vertical gradient `#cfebce` → `#bfe3bd`; no visible border.
- Text: 20 px sans, weight ≈ 330. Selected `#071f0b`; unselected `#364035`–`#3e4c42`. The selected option reads slightly heavier in the enlarged crop, mostly because it is darker.
- The selected pill has a faint soft shadow under it and a lighter top (a gentle raised look), no outline.

**2. Export button** `导出报表`

- Box `(1197, 147, 161, 47)`; radius ≈ 15–16 (a rounded rectangle, **not** a pill); border ≈ 1.5–2 px `#c1d0c4` with a white inner highlight; fill transparent (interior `#e8f2ec` = panel colour).
- Icon: download (arrow into tray), x=1222..1241, y=159..180 (20 × 22), ≈ 2.5–3 px stroke, `#0c2c16`. 25 px left padding.
- Text: ink x=1256..1335, y=160..178 → 20.5 px sans, weight ≈ 320, `#1c2f24`. 15 px after the icon, 22 px right padding.
- Border detail (same on the period track and the theme track): a 2 px grey-green line with a 1 px white highlight on both its inner and outer side, which gives the controls a slightly embossed glass edge.
- Gap between segmented control and button: 37 px (1160 → 1197). Button right edge x=1357.

### C. Main content

#### C.1 Metrics row

- Region: x=124..1362 (content width 1239), labels start at y=260, values end at y=332; closed below by a horizontal rule at y=371..372 (≈ 1.5 px, `#d3dfd7`, x=124..1362).
- **Four metrics, no cards.** Separated by three thin vertical lines at x=445..446, 759..760 and 1063 (≈ 1.5 px, `#cbd9d0`), each only 59 px tall (y=272..330). Columns are equal quarters (≈ 310 px).
- Text is left-aligned inside each column, about 92 px in from the column's left edge: text left edges x=217, 536, 850, 1160.
- No icon, no sub-label, no trend indicator, no badge.

| # | Label (verbatim) | Value (verbatim) | Label ink | Value ink |
|---|---|---|---|---|
| 1 | 平均收款周期 | 28 天 | x=217..339, y=260..278 | x=218..306, y=301..332 |
| 2 | 预期收款 | ¥6,000 | x=537..617 | x=535..660 (comma descends to y=336) |
| 3 | 收款率 | 60% | x=852..910 | x=849..925 |
| 4 | 逾期比例 | 0% | x=1160..1240 | x=1162..1215 |

- Label style: ink 19 px high, glyph advance 21 → 21 px sans, weight ≈ 320 (regular), `#3a463c`.
- Value style: digits 30 px high (y=301..330), 19–20 px wide, advance 23–24 → **38 px sans, weight ≈ 370** (regular-to-medium, clearly lighter than the baseline's semibold), `#082610`. The unit `天` is set at the same size as the number (32 × 31 px ink, the same digit-to-glyph ratio as the baseline's `0 天`) and follows it after one space (14 px).
- Label → value gap: 23 px (278 → 301). Value bottom → rule: 39 px.

#### C.2 Trend chart `收款趋势` (left)

- Title: ink x=140..262, y=409..436 (28 px high, advance 31.3) → **31 px, serif bold** — the enlarged crop shows the same thick-vertical / thin-horizontal Songti strokes as the page title — `#06200d`. No icon, no description line.
- Legend: on the title row, right-aligned to the plot's right edge, centred on y ≈ 423.
  - `实际收款`: marker = solid green bar x=658..694 (37 × 4.5 px, round caps, `#649c66`); text x=709..775, 17 px, `#202e23`; 14 px between marker and text.
  - `计划收款`: marker = gold dashed bar x=804..843 (three dashes ≈ 9 px, gaps ≈ 5 px, 3 px thick, `#e7ce81`); text x=857..924. 29 px between the two legend items.
- Plot area: x=200..928 (728 wide), y=476..762 (286 high). Chart block overall: x=138..930, y=407..798.
- Type: **line chart with two series** (not bars).
  - `实际收款`: solid, `#6aa069`, ≈ 3.5–4 px, smooth curve, no point markers; runs from (201, 762) to (929, 634), i.e. 0 → ≈ 3,600. **Area fill** underneath: the same green as a vertical gradient from α ≈ 0.33 at the curve's highest point (composite `#bfdabf`) to α ≈ 0.07 at the baseline (`#e1efe3`).
  - `计划收款`: dashed, gold `#e5cc86` (core `#e5c56d`), ≈ 3 px, dash 9 / gap 5, smooth, no markers, no fill; runs from (201, 761) to (929, 547), i.e. 0 → ≈ 6,000.
- Y axis: line at x=200 (1 px, `#b2bfb6`); tick labels `8,000`, `7,000`, `6,000`, `5,000`, `4,000`, `3,000`, `2,000`, `1,000`, `0`, right-aligned at x=182 (18 px left of the axis); 16 px; `#2d3e30`. No currency sign on the axis.
- X axis: line at y=761..762 (≈ 2 px, `#becdc3`); tick marks 9 px long below the axis (≈ 1.5 px, `#a6b3aa`) at x=224, 389, 560, 728, 891; labels `11月1日`, `11月8日`, `11月15日`, `11月22日`, `11月29日` centred under the ticks, ink y=783..797 (≈ 16.5 px), `#2c3c2d`. The first label is centred on its tick like the others, so it starts left of the plot (x=194).
- Grid: horizontal lines only, one per 1,000 (pitch 35.75 px: y ≈ 475.5, 511.5, 547.5, 582.5, 618.5, 654.5, 690.5, 726.5), solid, ≈ 1.5 px, `#cedad0`, spanning x=200..928. No vertical grid lines.
- Tooltip: none shown.

#### C.3 Structure chart `收款结构` (right)

- Title: ink x=999..1120, y=409..436, same style as `收款趋势`.
- Type: **donut**, two segments. Centre (1179, 571.5); outer diameter ≈ 224 (r = 112); hole diameter ≈ 122 (r = 61); ring thickness ≈ 51 (cutout ≈ 54 %). Bbox x=1068..1290, y=459..684.
- Segments, clockwise from 12 o'clock: green `#6ca06b` 0° → 215° (59.4 % ≈ 60 %), gold `#f1d695` 215° → 360° (40.4 % ≈ 40 %). Flat colours, butt ends, no gap or separator between segments, no shadow.
- Centre text: none (the hole shows the panel).
- Legend: below the donut (32 px gap), two rows, row centres y ≈ 725.5 and 768 (pitch 43).

| Row | Marker | Label | Amount | Percentage |
|---|---|---|---|---|
| 1 | filled circle ⌀ 20, x=1031..1050, `#6a9e69` | 已收款 (x=1069..1127) | ¥3,600 (right edge x=1332) | none |
| 2 | filled circle ⌀ 20, `#edd392` | 待收款 (x=1067..1127) | ¥2,400 (right edge x=1335) | none |

  Label: 21 px sans, weight ≈ 300, `#1e2b20`. Amount: 20.5 px, weight ≈ 345, `#0c1e11`, right-aligned. Legend block x=1031..1335 (≈ 305 wide), centred under the donut.

#### C.4 Split and what is below

- A visible vertical divider at x=965..966 (≈ 1.5 px, `#d0ded4`), y=402..813 (412 px tall). It sits at 68 % of the content width: left chart ≈ 68 %, right chart ≈ 32 %. Neither chart is inside a card.
- Below the charts: nothing. The last ink is the x-axis labels (y=797) and the divider end (y=813); the panel bottom is at y=884.

## 05 系统设置 (P5, 外观设置 tab)

### B. Page header

| Element | Box / position | Style |
|---|---|---|
| Title `系统设置` | ink x=145..339, y=133..177 (195 × 45); advance ≈ 50 | Same as P4: serif bold, 50 px, `#062911` |
| Subtitle `管理账户和界面偏好` | ink x=142..358, y=196..217 (217 × 22); advance 24.4 | Sans, 24 px, weight ≈ 300, `#384d3f` |
| Right-side controls | **none** | No button, no search, no account chip |

### C. Main content

#### C.1 Tab strip

- Style: **text tabs with an underline indicator** on a full-width hairline. No pills, no segmented track, no icons, no vertical side navigation.
- Tabs in order (verbatim): `个人信息`, `安全设置`, `外观设置` (selected), `关于`. Only these four are shown.

| Tab | Label ink | Implied tab box (label ± 18 px) |
|---|---|---|
| 个人信息 | x=163..252, y=265..285 | x=145..270 |
| 安全设置 | x=327..417 | x=309..435 |
| 外观设置 (selected) | x=492..586, y=264..285 | x=474..604 |
| 关于 | x=661..703 | x=643..721 |

- Label style: unselected 23 px sans, weight ≈ 300, `#364a3e`; selected fits 24.3 px at weight ≈ 360, `#001305` — one step heavier and much darker, not semibold. Keeping one size (23–24 px) and changing only weight and colour avoids the row shifting when the selection moves.
- Selected indicator: bar x=475..606 (132 × 4 px), y=303..306, colour `#1a4e2a` (rows `#245a34`, `#154c25`, `#1f4f2d`, `#30563b`), top corners rounded ≈ 2 px. It is 18–20 px wider than the label on each side, so it marks the tab's padding box.
- Hairline under the strip: y=307..308 (≈ 1.5 px, `#ccd8d0`), x=126..1361 — the full content width. The indicator sits directly on it.
- Spacing: tab padding-inline ≈ 18 px, gap between tab boxes ≈ 39–40 px (label-to-label 74–75 px). The first tab box starts at x=145, aligned with the text column. Subtitle bottom → label top 48 px; label bottom → indicator top 17 px. Strip height from label top to hairline ≈ 43 px.

#### C.2 Settings list (left column, x=127..916, 790 px wide)

Rows are separated by full-width hairlines (≈ 1.5 px, `#d0dbd4`, x=127..916) at y=436..437, 544..545, 652..653 and 761..762. There is a hairline after the last row. No cards, no row backgrounds, no icons.

| # | Title (verbatim) | Description (verbatim) | Control (right side) | Row span |
|---|---|---|---|---|
| 1 | 界面主题 | — (none) | Segmented control: `浅色` (selected) / `深色` / `跟随系统` | y=338..437 (≈ 99 px; starts ≈ 30 px below the tab hairline) |
| 2 | 江南动态场景 | 在工作台播放雨丝、水波和柳枝动画 | Switch, **on** | y=437..544 (107 px) |
| 3 | 减少动态效果 | 保留静态雨景，减少背景动效 | Switch, **off** | y=545..652 (107 px) |
| 4 | 液态玻璃效果 | 在底部导航显示透明与折射 | Switch, **on** | y=653..761 (108 px) |

- Title: ink x=145..296, 23 px high, advance 25.3 → 25 px sans, weight ≈ 355 (one step above the description, not semibold), `#021706`. Title ink tops at y=375, 462, 569, 677.
- Description: ink 18 px high, advance 19.5 → 19.5 px sans, weight ≈ 295, `#4c5e52`. Ink tops at y=498, 606, 714; 13 px below the title ink.
- Row padding: ≈ 24–25 px above the title ink and ≈ 29 px below the description ink (two-line rows); 25 px above and below the control in row 1.
- **Theme segmented control**: track `(566, 364, 348, 49)` (x=566..913, y=364..412); rounded rectangle, radius ≈ 14–18 (not a full pill); border ≈ 1.5–2 px `#bccac0` (tinted `#b9d1ba` around the selected end) with a white inner highlight; track fill = panel colour (transparent). Selected segment `(569, 367, 110, 43)`, 3 px inset, radius ≈ 12, vertical gradient `#d3efcb` → `#c1e6b9`, no border. Segment widths 110 / 108 / 125 (padding-inline ≈ 24 with a min-width ≈ 108); option centres x ≈ 624, 732, 849; no dividers between options. Option text 20 px, weight ≈ 325; all three options are dark (`#021f06` selected, `#091f12` / `#0b1f12` unselected) — unlike the period control in P4, the unselected options here are not muted.
- **Switch**: 70 × 38 px pill (x=833..903); thumb ⌀ ≈ 29 px, white `#fafdfa`, 4 px inset; vertically centred in the row (centres y ≈ 491.5, 599, 706.5); right edge x=903 (13 px inside the list's right edge; the segmented control ends at x=913).
  - On: track `#72a070` (row 2) / `#80b271` (row 4 — the mock-up drifts slightly yellower; use one accent, ≈ `#72a070`), thumb at the right (x=870..898).
  - The thumb carries a small soft shadow (visible in the enlarged crop as a grey halo on its lower edge); the track has no border and no shadow.
  - Off: track `#cedbd0`, thumb at the left (x=838..865), no visible border on the track.

#### C.3 Preview (right column)

- Box `(961, 368, 401, 370)` including its rim (x=961..1361, y=368..737); aspect ≈ 1.08 : 1; corner radius ≈ 21.
- Rim: ≈ 2 px bright white-green (`#f6fcfa`, `#f9fffd`) with a 1 px soft grey-green line (`#b1c2b4`) just inside it. No measurable drop shadow.
- Content: the scene still — stone arch bridge left of centre, willow hanging from the top right, white-wall houses in mist behind, green water with the bridge's reflection. No Dock, no window buttons, no text in it; no figure is visible on the bridge. It is the same picture as the background, cropped.
- Caption: none. No label above or below.
- Position: top is level with the theme control (y=368 vs 364); bottom (y=737) is 24 px above the list's last hairline.

#### C.4 Split and everything else

- List x=127..916 (790 px, 64 % of the 1235 px content width), gap 44 px, preview x=961..1361 (401 px, 32.5 %). No divider line between them.
- No other section, button, save bar or footer text. Below y=762 the panel is empty down to its bottom edge (y=883).

## D. Measured palette (prototype, light theme)

All values are on-screen composites sampled from the PNGs.

| Role | Hex | Where measured |
|---|---|---|
| Work panel fill (composite) | `#e9f2ec` | median of the panel interior; range `#e0ede4`..`#ecf5ef` |
| Panel rim highlight | `#f1f9f3` / `#f3fbf5` | 1–3 px inner edge |
| Scene mist (outside panel) | `#e1e9e3` | top band |
| Dock glass | `#d6e6da` → `#c7dcca` (left → right), `#d9e7dd` → `#d1e3d6` (top → bottom) | Dock interior |
| Dock selected pill | `#cdedca` → `#b6e1b5` (top → bottom) | P4 and P5 |
| Title ink | `#0d3016` (P4), `#062911` (P5) | page titles |
| Text primary | `#082610` (metric values), `#06200d` (chart titles), `#021706` (settings row titles), `#001305` (selected tab) | |
| Text secondary | `#3d4a3f` / `#384d3f` (subtitles), `#3a463c` (metric labels), `#364a3e` (unselected tabs), `#364035`–`#3e4c42` (unselected period options) | |
| Text tertiary (descriptions) | `#4c5e52` | settings row descriptions |
| Chart tick text | `#2d3e30` (y), `#2c3c2d` (x) | |
| Legend / donut legend text | `#202e23`, `#1e2b20`; amounts `#0c1e11` | |
| Hairline / divider | `#d3dfd7` (metrics rule), `#cbd9d0` (metric dividers), `#d0ded4` (chart divider), `#ccd8d0` (tab hairline), `#d0dbd4` (settings row separators) | all ≈ 1.5 px |
| Chart grid | `#cedad0` | horizontal lines |
| Chart axis | `#b2bfb6` (y line), `#becdc3` (x line), `#a6b3aa` (tick marks) | |
| Control border | `#c6d3cb` (period track), `#c1d0c4` (export button), `#bccac0` (theme track) | ≈ 1.5–2 px, each with a white inner highlight |
| Selected segment fill | `#cfebce` → `#bfe3bd` (period), `#d3efcb` → `#c1e6b9` (theme) | vertical gradients |
| Accent green (data, switch on) | `#6aa069` (line), `#6ca06b` (donut), `#6a9e69` (legend dot), `#72a070` (switch on; `#80b271` on the third row) | |
| Area fill under the line | accent green at α ≈ 0.33 → 0.07 | composites `#bfdabf` → `#e1efe3` |
| Gold | `#f1d695` (donut), `#edd392` (legend dot), `#e5cc86` (dashed line, core `#e5c56d`), `#e7ce81` (legend dashes) | |
| Tab indicator (deep green) | `#1a4e2a` | 4 px bar |
| Switch off track | `#cedbd0` | |
| Switch thumb | `#fafdfa` | both states |
| Danger | not present — neither prototype contains a red/danger element (`TODO` confirm with a hue scan) | |
| Native window buttons | `#e35950`, `#f1ba2e`, `#43bc53` | baked in, not to be drawn |

For reference, the baseline (dark theme) uses: panel `#212d28`, card fill `#1f2c27`, card border `#42554c`, text `#e7f2ea` / `#b1c1b7` / `#98aa9f`, accent `#94bd93`, Dock `#26372f`, negative badge text `#f4b9aa`.

### D.2 Typography (fitted against MiSans VF / Songti SC)

`wght` is the MiSans VF axis value, which is what CSS `font-weight` selects on this font (its named instances are Normal 305, Regular 330, Medium 380, Demibold 450, Semibold 520, Bold 630). The prototype is set lighter than the app's defaults throughout: nothing in sans is heavier than about 420.

| Text | Family | Size | Weight | Colour | Baseline now |
|---|---|---|---|---|---|
| Page title (`数据分析`, `系统设置`) | serif (Songti SC) | 50 px | Bold; ink sits a quarter to two-fifths of the way from Bold to Black | `#0d3016` / `#062911` | P4: 40 px Songti bold. P5: no page title |
| Page subtitle | sans | 24 px | ≈ 300 | `#3d4a3f` | 16 px / 400 |
| Section title (`收款趋势`, `收款结构`) | **serif**, same face as the page title | 31 px | Bold (same heaviness as the page title) | `#06200d` | 20 px sans / 600 |
| Metric label | sans | 21 px | ≈ 320 | `#3a463c` | 14 px / 400 |
| Metric value (number and unit `天` at the same size) | sans | 38 px | ≈ 370 | `#082610` | 24 px / 600 |
| Period option (周 月 季 年) | sans | 20 px | ≈ 330 | `#364035`; selected `#071f0b` | 14 px |
| Export button text | sans | 20.5 px | ≈ 320 | `#1c2f24` | 14 px / 500–600 |
| Chart legend text | sans | 17 px | ≈ 355 | `#202e23` | Chart.js default (12 px) |
| Y tick | sans | 16 px | ≈ 390 | `#2d3e30` | Chart.js default |
| X tick | sans | ≈ 16.5 px | ≈ 330 | `#2c3c2d` | Chart.js default |
| Donut legend label | sans | 21 px | ≈ 300 | `#1e2b20` | — |
| Donut legend amount | sans | 20.5 px | ≈ 345 | `#0c1e11` | — |
| Tab label (P5) | sans | 23 px; the selected one fits 24.3 px | ≈ 300; selected ≈ 360 | `#364a3e`; selected `#001305` | 14 px rail items |
| Settings row title | sans | 25 px | ≈ 355 | `#021706` | — |
| Settings row description | sans | 19.5 px | ≈ 295 | `#4c5e52` | 16 px (section description) |
| Theme option (浅色 深色 跟随系统) | sans | 20 px | ≈ 325 | `#091f12`; selected `#021f06` | 14 px |
| Dock label | sans | 15 px | ≈ 415 | `#122a19` | 14 px |

Two things to decide from this table:

1. **Scale.** These sizes are 1.25–1.5 × the type scale in `docs/ORANGE_DESIGN_SYSTEM.md` §4.2 (page title 36–42, section title 20–24, body 14–16, secondary 13–14, Dock label 12–14), while the panel and Dock are 1 : 1 with the doc. Matching the prototype's look means using the sizes above; following §4.2 keeps the structure but gives a visibly smaller, airier page.
2. **Section titles are serif** in the prototype, but §4.2 reserves the serif stack for page titles and asks for sans, medium weight.

## E. Differences from the baseline

The baselines are dark-theme shots; items below are about structure, size and typography unless they say "colour".

### E.1 Shell (both pages)

1. **Theme**: baseline dark, prototype light. Re-shoot with 浅色 before comparing colours.
2. **Panel box**: baseline `(74, 82, 1339, 816)`; target `(80, 82, 1328, 803)` — 6 px narrower on each side and 13 px shorter (bottom edge 897 → 884).
3. **Panel radius**: ≈ 31 → ≈ 40.
4. **Panel edge**: baseline draws a darker 1 px outline; target is a bright 1–3 px rim with no dark outline.
5. **Dock box**: baseline `(414, 923, 659, 95)`; target `(398, 912, 691, 101)` — 32 px wider, 6 px taller, 11 px higher. Bottom margin 40 → 46. Gap to the panel 26 → 28.
6. **Dock items**: pitch 128.3 → 133.5; icons ≈ 22 → ≈ 28 px; labels ≈ 14 → ≈ 15 px.
7. **Dock selected pill**: baseline `124 × 73`, solid `#94bd94`, label and icon turn near-black; target `128–130 × 75`, pale gradient `#cdedca` → `#b6e1b5`, label and icon keep the normal dark green.

### E.2 04 数据分析 — prioritised

1. **Metrics are cards; target is a flat row.** Baseline: four bordered cards `298 × 99` (radius ≈ 13, 16 px gaps) each with a leading icon and, on the first two, a trend badge (`– 0.00%`, `↓ 100.00%`). Target: no cards, no icons, no badges; four equal columns split by three 59 px hairlines; one rule under the row at y=371.
2. **Charts are cards; target is two bare regions with one divider.** Baseline: left card `x=123..934`, right card `x=958..1363`, each with an icon tile, title and subtitle. Target: no cards, no icon tiles, no subtitles; divider at x=965, y=402..813; split 68 / 32.
3. **Trend chart type.** Baseline (`AnalyticsView.tsx`): Chart.js bar chart, legend at the bottom, `¥` on the y ticks, and a totals strip above the plot (`计划收款`, `实际收款`, `计划与到账差额`). Target: two lines (solid green with gradient area, dashed gold), legend on the title row at the right, plain numbers on the y axis, no totals strip.
4. **Structure block.** Baseline: card `资金状态对比` holding a three-row table (已收款 / 待收未逾期 / 逾期). Target: `收款结构` donut (⌀ 224, ring 51) with a two-row legend (已收款 / 待收款 + amounts).
5. **Header.** Baseline has an eyebrow `INSIGHTS / 回款表现` — remove. Title ink 38 px high (≈ 40 px font) → 46 px (≈ 48 px). Description: baseline is a live summary (`近30天回款概览 · 已收 ¥0 / 应收 ¥0 · 2026-10-18 — 2026-11-16`, ≈ 16 px); target is a fixed sentence `了解收款进度与资金结构` at ≈ 22 px.
6. **Period control.** Baseline track `173 × 43`, selected segment `38 × 31` solid `#94bd93` with dark text, text ≈ 14 px. Target track `290 × 46`, segments 70.8 wide, selected `74 × 40` pale gradient, text ≈ 19–20 px.
7. **Export button.** Baseline: filled primary pill `120 × 41`, text ≈ 14 px. Target: outlined, transparent, `161 × 47`, radius ≈ 15, text ≈ 20 px, icon 20 × 22.
8. **Metric typography.** Label ≈ 14 → ≈ 20 px. Value ≈ 28 px bold → ≈ 42 px medium. Values are shown without forced decimals in the target (`60%`, `0%`, `¥6,000`, `28 天`); baseline prints `0.00%`.
9. **Section titles.** Baseline ≈ 20 px sans bold (`近30天收入对比`, `资金状态对比`); target ≈ 30 px bold (`收款趋势`, `收款结构`).
10. **Vertical extent.** Baseline's left chart card runs past the panel's bottom edge (card border still open at y=895), so the page scrolls; the target's content ends at y=813 with ≈ 70 px of free panel below.

Baseline has, prototype does not: eyebrow; date range in the description and in the chart subtitle; trend badges (较前 N 天); metric icons; totals strip; the 逾期 row in the breakdown; chart subtitles; empty states (the prototype only shows the populated state).

Prototype has, baseline lacks: line + area trend chart; donut with legend; hairline dividers instead of cards.

Looks like product change rather than restyle (decide before building):

- `平均收款周期` with value `28 天`: the baseline label is `平均到账偏差`, which is what the API actually returns (actual date − plan date). Renaming changes the meaning.
- The trend lines rise monotonically to the totals (3,600 and 6,000), i.e. they are drawn as **cumulative** series. The API returns per-bucket amounts.
- `收款结构` shows two parts only (已收款 / 待收款). The baseline separates 逾期 from 待收.
- X labels are formatted as `11月1日` at weekly steps.
- The header loses the date range and the 已收/应收 summary, and the metrics lose the period-over-period trend.

### E.3 05 系统设置 — prioritised

1. **Navigation model.** Baseline: a left card `(123, 123, 248, 608)` with header `设置分类` / `9 个可用分区`, nine vertical items with icons (个人信息, 用户管理, 字典管理, 安全设置, 数据同步, 外观设置, 通知设置, 开发设置, 关于) and footer `管理权限已启用`. Target: a horizontal underline tab strip under the page header; four tabs visible; no icons, no header, no footer.
2. **Page header missing.** Baseline has no page title. Target: `系统设置` (serif ≈ 48 px) + `管理账户和界面偏好` (≈ 23 px).
3. **Content is a card; target is flat.** Baseline: card `(395, 123, 969, 384)` with an icon tile, `外观设置` and `自定义界面主题，打造专属的使用体验`. Target: no card, no section header — the selected tab is the heading.
4. **Theme chooser.** Baseline: three radio cards `≈ 298 × 122` with large icons and a check badge, ordered 跟随系统 / 亮色 / 深色. Target: one row `界面主题` with a `348 × 49` segmented control ordered `浅色` / `深色` / `跟随系统` (note `亮色` → `浅色`).
5. **Three switch rows are absent** in the baseline: `江南动态场景`, `减少动态效果`, `液态玻璃效果`, each with a description and a `70 × 38` switch.
6. **Preview is absent** in the baseline: `401 × 370`, radius ≈ 21, scene still, right column.
7. **Layout.** Target: list 790 px + 44 px gap + preview 401 px, rows ≈ 107 px high with hairlines.

Baseline has, prototype does not: five tabs (用户管理, 字典管理, 数据同步, 通知设置, 开发设置); nav header and footer; per-section icon tile and description; theme icons and check badge.

Looks like product change rather than restyle:

- The three appearance switches and their persistence (`TODO` check whether `stores/appearance.ts` and an ODS `Switch` already exist).
- The scene preview image.
- Showing only four tabs — the design doc (§6.5) says the other five must stay reachable, so the strip needs overflow handling ("更多" or horizontal scroll) that the prototype does not draw.

## F. Open items

- `TODO` panel / Dock / preview shadow profiles.
- `TODO` confirm serif vs sans for section titles and metric values (contact sheet).
- `TODO` hue scan for danger colours.
- `TODO` check which ODS pieces already exist (SegmentedControl, Switch, WorkSurface, appearance store).

<!-- APPEND-HERE -->
