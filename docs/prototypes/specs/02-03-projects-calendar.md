# Spec: 02 项目管理 and 03 收款日历 (烟雨江南)

Source images, all 1487 × 1058:

- Prototype `docs/prototypes/02-projects.png` (called **P2** below)
- Prototype `docs/prototypes/03-calendar.png` (**P3**)
- Baseline `/tmp/orange-resume/shots/base-02-projects.png` (**B2**), `/tmp/orange-resume/shots/base-03-calendar.png` (**B3**)

All positions are prototype pixels, origin top-left. `x a..b` means inclusive pixel columns; boxes are written `(x, y, w, h)`.

## 0. Read this first

1. **The baselines were captured in the dark theme.** B2/B3 have a dark panel (`#212e29`), light text (`#e7f2ea`) and a dimmed, heavily blurred scene. Both prototypes are the light look (panel `#e8f1ea`, text `#0c2f17`, sharp scene). Every colour target below is the prototype's light value; colour comparison against these baselines is not meaningful. Layout, structure and size comparisons are valid. Re-shoot the baselines in the light theme before judging colour.
2. **The prototypes are 1× bitmaps of a 1487 × 1058 window** (traffic lights are 12 px circles at 19 px pitch), so prototype px = CSS px. They are painted images, not renders: hairlines are soft (1.5–2 px wide), and the calendar's seven columns are uneven (88–127 px). Regularise such things; do not copy them.
3. **Type in the prototypes is about 1.4–1.6× the baseline's** (table text 20–22 px against 14 px). Section 6.1 lists the pairs, so one consistent scale can be chosen.
4. Accuracy: boxes ±1–2 px, radii ±2 px, font sizes ±1 px (from CJK glyph pitch, advance = 1 em), colours ±3 per channel.
5. Images read for this spec: 6 (two prototypes, two baselines, two contact sheets of enlarged prototype details). Everything else is pixel measurement.

---

## 1. Shared shell (section A)

Identical on P2 and P3 within 1 px.

### 1.1 Work panel

| | P2 | P3 | Baseline B2/B3 |
|---|---|---|---|
| Bounding box | (80, 82, 1327, 802), x 80..1406, y 82..883 | (80, 82, 1328, 803), x 80..1407, y 82..884 | (75, 83, 1337, 814), x 75..1411, y 83..896 |
| Margins left / right / top | 80 / 80 / 82 | 80 / 80 / 82 | 75 / 75 / 83 |
| Corner radius | ≈ 38 (fits 36.5–38.5) | ≈ 38 | ≈ 29 |
| Gap to Dock top | 28 | 27 | 26 |

- **Fill.** Milky pale green, nearly opaque. `#e9f2eb` at the top, `#e8f1ea` in the middle, `#e4efe7` at the bottom. The top-right corner is slightly darker (`#e3ede4`) where the willow hangs behind it.
- **How much scene shows through.** No shapes at all. Empty areas have a detrended tile deviation ≤ 0.7 luminance levels. Only the scene's very-low-frequency brightness leaks through: regressing the panel's inner edge strip on the scene strip just outside gives slopes of 0.03–0.10 (left and bottom edges) and up to 0.2 (right and top, with a ±60 px blur). Equivalent CSS: tint about `#ebf3ed` at alpha ≈ 0.90 over a backdrop blur of at least 40 px.
- **Border.** No dark outline. A 1 px white inner rim: `#f1faf5` on the outermost pixel, `#ecf5ee` on the next. It is 2 px at the top edge (`#f1f8f1`, `#f0f8f1`), 1 px at the bottom (`#f4fff8`).
- **Shadow.** Practically none. Outside the left edge the scene is about 3 % darker for roughly 15 px; nothing measurable below the panel. The panel separates from the scene by lightness and the white rim.
- The panel **stops above the Dock**; it does not extend behind it. A 28 px band of scene (water, `#b7cdbf`) lies between panel bottom (y 883) and Dock top (y 912).

### 1.2 Scene around the panel

Not blurred. Mean horizontal gradient: willow 9.9, left trees 5.2, water 0.8, sky 0.5 (baseline: 0.65, 0.46, 0.11, 0.09, i.e. blurred and dimmed).

Visible parts:

- Top band (y 0..81): pale mist with faint far hills, `#e2e9e3`.
- Top-right: willow branches hanging from the corner, x ≈ 1180..1487, y 0..≈330, leaves `#c6cea5`–`#cad0a3`; some overlap the band right of the panel.
- Left strip (x 0..79): foliage from y ≈ 250 (`#a8c2a1`), a white-walled, dark-roofed house at y ≈ 440–480, a stone embankment at y ≈ 600–670, water below (`#abc1ae`).
- Right strip (x 1408..1487): mist, houses at y ≈ 440–520, water (`#bad0c0`).
- Bottom band (y 884..1057): green water `#9cbba9`–`#b7cdbf`, with ripple rings near (280, 985) and (1200, 975).
- macOS traffic lights: 12 px circles at x 10..21, 29..40, 48..58, y 9..20 (`#e75a54`, `#f3bb2f`, `#48bd4f`).

### 1.3 Dock

| | Prototype | Baseline |
|---|---|---|
| Bounding box | (398, 912, 691, 102), x 398..1088, y 912..1013 | (414, 923, 658, 95) |
| Shape | full pill (r ≈ 51) | full pill |
| Bottom margin | 44 | 40 |
| Item centres x | 475.5, 608.5, 742.5, 875.5, 1008.5 (pitch 133) | 486, 614.5, 743, 871.5, 999.5 (pitch 128.5) |
| Icon | ≈ 28 px (23–30 wide, 26–28 tall), y 936..963, stroke ≈ 2.4 | ≈ 22 px, y 947..968 |
| Label | 15 px regular, y 976..989 (four characters = 58 px) | 14 px, y 980..992 |
| Active pill | P2 (547, 926, 127, 76); P3 (680, 926, 127, 75); full pill (r ≈ 36) | (554, 933, 122, 74), flat `#94bd94` |

- Glass fill `#d2e1d6` at the left end, `#c4d8c7` at the right end: more translucent than the panel, it follows the water behind. Top rim 1–2 px white (`#e9f2ea` to `#fefefe`). Soft shadow below, about 15–18 px, about 7 % darker than the water (`#94b19e`).
- Items in order: 工作台 (house), 项目管理 (folder), 收款日历 (calendar), 数据分析 (three bars), 系统设置 (gear). Outline icons `#093815`–`#0a3f17`; labels `#0f2a15`. Icon-to-label gap 12 px.
- **Highlighted item:** P2 项目管理 (second), P3 收款日历 (third). The highlight is only the pill: gradient `#cbe6c6` (top) to `#bce0b9` (bottom), with a 3–6 px soft shadow under it (`#b2c3b7`). Icon and label keep the same dark green as the other items.

---

## 2. Page 02 项目管理 (P2)

### 2.1 All visible text, verbatim

- Title: `项目管理`
- Subtitle: `查看合同与收款进度`
- Button: `新建项目` (with a plus icon)
- Search placeholder: `搜索项目`
- Selects: `全部状态`, `全部客户`
- Table header: `项目名称` `客户` `截止日期` `合同金额` `已收款` `收款进度` `状态`
- Row 1: `网站视觉升级` · `知行科技` · `2025-04-30` · `¥6,000` · `¥3,600` · `¥3,600 / ¥6,000` `60%` · `进行中`
- Row 2: `品牌物料设计` · `云栖生活` · `2025-03-20` · `¥2,000` · `¥2,000` · `¥2,000 / ¥2,000` `100%` · `已完成`
- Row 3: `门店导视系统` · `青禾餐饮` · `2025-05-15` · `¥8,000` · `¥0` · `¥0 / ¥8,000` `0%` · `未开始`
- Row 4: `产品手册设计` · `致远电子` · `2025-04-10` · `¥6,000` · `¥3,000` · `¥3,000 / ¥6,000` `50%` · `进行中`
- Pagination: `1` between a left and a right chevron
- Dock: `工作台` `项目管理` `收款日历` `数据分析` `系统设置`

Nothing else is on the page: no eyebrow, no metric cards, no tabs, no record count, no page-size control.

### 2.2 Vertical landmarks

| y | What |
|---|---|
| 82 | panel top |
| 132..177 | title ink |
| 195..217 | subtitle ink |
| 160..209 | 新建项目 button |
| 254..298 | toolbar controls |
| 324–325 | table top rule |
| 353..370 | header text ink |
| 393 | header bottom rule |
| 475.5, 554.5, 634.5, 713.5 | row rules |
| 792..829 | pagination |
| 883 | panel bottom |

Horizontal: text starts at x 141 (61 px inside the panel); table rules run x 125..1365; the button's right edge is x 1354.

### 2.3 Page header (section B)

**Title `项目管理`**
- Ink x 141..339, y 132..177. Glyph height 46; glyph boxes 46 × 45, 34 × 44, 45 × 46, 47 × 42; pitch 50–52.
- Font size ≈ 50 px. **Serif** (Song/Ming style: vertical stems 5.1 px, horizontal strokes 1.6 px). Weight bold to heavy (700–900). Colour `#0c2f17`.
- The ink top is 50 px below the panel top.

**Subtitle `查看合同与收款进度`**
- Ink x 141..357, y 195..217, glyph height 23, pitch 24.3 → 24 px. Sans, regular (stems 1.8 px). Colour `#425546`.
- 18 px between title ink bottom and subtitle ink top.

**Right-side action: one button, `新建项目`**
- Box (1161, 160, 194, 50), x 1161..1354, y 160..209. Full pill (r 25).
- Fill: vertical gradient `#cee8cc` (top) → `#c5e3c3` (middle) → `#bddebb` (bottom). No border.
- Shadow: tight and soft, 3–4 px below (`#c3d9c6`, `#d8e2db`, `#e2e9e6`, then panel).
- Plus icon 19 × 19 at x 1199..1217, y 175..193, stroke 1.9 px, `#063714`.
- Text x 1235..1320, y 173..193, 22 px (pitch 22.5), medium, `#04290c`.
- Padding: 38 left, 18 between icon and text, 34 right.

### 2.4 Toolbar (section C)

One row, y 254..298 (height 45), three controls, 17 px gaps, left-aligned. The row is empty from x 1015 to the right edge.

| # | Type | Text | Box | Radius | Fill | Border | Icon |
|---|---|---|---|---|---|---|---|
| 1 | Search input | placeholder `搜索项目`, 19 px regular, `#64716b`, x 193..265 | (138, 254, 429, 45) | ≈ 14 | `#edf3ef` (panel + 2 levels) | ≈ 1.5 px `#cbd8ce`–`#cfdbd1`, plus a 1 px white hairline inside (`#f1f8f2`) | magnifier 21 × 21 at x 158..178, y 265..285, stroke 1.9, `#203228` |
| 2 | Select | `全部状态`, 20 px regular, `#031508`, x 603..680 | (584, 254, 205, 45) | ≈ 14 | `#ecf3ef` | same | chevron-down 13 × 8 at x 758..770, y 273..280, stroke 2.2, `#1a2b1f` |
| 3 | Select | `全部客户`, 20 px regular, x 824..900 | (806, 254, 209, 45) | ≈ 14 | `#ecf3ef` | same | chevron-down at x 984..996 |

Inner padding: search 20 px to the icon, 15 px icon to text; selects 19 px left, 18 px right of the chevron.

### 2.5 Table (section D)

No card, no border box, no header background (header band is `#eaf3ed`, the same as the panel). Only horizontal hairlines, x 125..1365 (width 1240). No vertical lines.

**Rules**

| y | Raw pixels | Role |
|---|---|---|
| 324–325 | `#cbd9ce`, `#cedbd1` | top of header |
| 393 | `#bfcfc2` (soft neighbours `#e1ede4`) | bottom of header, the strongest line |
| 475–476, 554–555, 634–635, 713–714 | `#d0dad2`–`#d9e3da` | row separators, lighter |

As crisp 1 px lines these equal about `#b4c4b9` for the two header rules (text green at alpha 0.25) and `#c3d1c7` for row rules (alpha 0.18).

**Header row:** height 68 (y 325..393). Text 19 px, regular to medium (stems 1.6–1.8), colour `#0b2811` — dark, not muted. Ink y 353..370.

**Columns**

| Header | Header ink x | Cell ink x (row 1) | Alignment |
|---|---|---|---|
| `项目名称` | 139..213 | 141..272 | left at ≈ 140 |
| `客户` | 345..380 | 346..423 | left at ≈ 345 |
| `截止日期` | 504..578 | 503..606 | left at ≈ 503 |
| `合同金额` | 676..751 | 688..753 | right at ≈ 752 |
| `已收款` | 819..873 | 820..884 (`¥0` is 862..884) | values right at ≈ 885; the header label starts at 819 |
| `收款进度` | 932..1007 | bar 932..1150 | left at ≈ 932 |
| `状态` | 1194..1230 | chip 1195..1279 | left at ≈ 1194 |
| (no label) | — | dots 1326..1347 | centred at ≈ 1336 |

**Project name and client are two separate columns, one line each.** No second line under the name.

**Body rows:** pitch 80 (82, 79, 80, 79). Rows span y 394..475, 477..554, 556..634, 636..713. Content is vertically centred.

| Cell | Size / weight | Colour | Ink height |
|---|---|---|---|
| Project name | 22 px, medium (stems 1.8, the heaviest text in the row) | `#041407` | 21 |
| Client | 20 px, regular | `#0b1d10` | 19 |
| Date `2025-04-30` | ≈ 20 px, regular, digit pitch 11 | `#07150c` | 15 |
| Contract amount, received | ≈ 21–22 px, medium, digit pitch 12, no decimals | `#041107` | 16 (digits) |
| Progress caption | ≈ 17–18 px, regular, digit pitch 10 | `#1c3623` | 13 (digits) |

**Progress column**
- Bar (932, 418, 219, 13) in row 1: 13 px high, full pill (r 6.5). Track `#d0e0d3`; fill `#629866` (range `#5e9362`–`#689c6e`), with a rounded right end.
- Fill widths: 136 of 219 for 60 %, 219 for 100 %, none for 0 % (track only), 112 for 50 %.
- **The percentage sits under the bar**, on the caption line, after the amounts: `¥3,600 / ¥6,000` at x 933..1056, then about 20 px of space, then `60%` at x 1077..1110. Caption ink y 441..456, 11 px below the bar.
- Bar plus caption form a 39 px block (y 418..456) centred in the row.

**Status chips**
- Pill, (1195, 416, 85, 34) in row 1, full radius (17). No border, no icon. A 2–3 px soft shadow under each.
- Text 18 px, regular to medium, centred, 16 px side padding.

| Text | Fill (top → bottom) | Text colour |
|---|---|---|
| `进行中` | `#d4e8d0` → `#cae2c6` | `#113a19` |
| `已完成` | `#d6ecd8` → `#cce7cf` (slightly cooler mint) | `#0b3217` |
| `未开始` | `#d9e2da` → `#d4dfd4` (neutral grey-green) | `#324237` |

Only these three statuses appear.

**Row action**
- A horizontal ellipsis: three filled dots, 5 px each, 8.5 px pitch, 22 px wide, `#042108`.
- x 1326..1347, vertically centred in the row (y 429..433 in row 1). No button chrome, no column header. Its right edge is 17 px inside the table's right end.

**Pagination**
- Bottom-right of the panel, y 792..829, right edge x 1369. 78 px below the last row rule, 54 px above the panel bottom.
- Three buttons, 17 px gaps:
  - Previous: (1220, 792, 38, 38), r ≈ 12, 1.5 px border `#cedbcf`–`#d6e2d9`, fill `#e7f1eb`, chevron-left 8 × 14, stroke 2.3, muted `#79867b`.
  - Current page `1`: (1275, 792, 40, 38), r ≈ 11, fill `#c9e3c6` → `#c0dfbf`, no border, small soft shadow, digit ≈ 19–20 px medium, `#02290e`.
  - Next: (1332, 792, 38, 38), same as previous.
- Nothing else below the table: no "共 N 条", no page-size select, no summary row.

---

## 3. Page 03 收款日历 (P3)

### 3.1 All visible text, verbatim

- Title: `收款日历`
- Subtitle: `查看计划收款与到账安排`
- Month title: `2026年11月`
- Month controls: left chevron, `本月`, right chevron
- Weekdays: `日` `一` `二` `三` `四` `五` `六`
- Day numbers `1` to `30`
- Day entries: on 10 `已收 ¥3,600`; on 13 `待收 ¥2,400`; on 18 `待收 ¥1,200`; on 24 `待收 ¥800`
- Right column heading: `11月13日 · 周五`
- Entry: `网站视觉升级`, `尾款`, `¥2,400`, chip `待收`
- Second heading: `近期收款`
- Rows: `11月18日` `品牌物料设计`; `11月24日` `门店导视系统`
- Dock labels as on page 02

Nothing else: no header button, no metric cards, no legend, no footer link, no record count.

### 3.2 Landmarks

| | Value |
|---|---|
| Title ink | x 141..339, y 132..177 |
| Subtitle ink | x 141..405, y 195..217 |
| Vertical divider | x 908–909, y 235..816 |
| Month controls | y 256..299 |
| Month title ink | x 141..316, y 261..291 |
| Rule under month header | y 316–317, x 124..885 |
| Weekday ink | y 341..360 |
| Day grid | x 124..885, y 386..813 |
| Right column | x 949..1365 |
| Panel bottom | y 884 |

Everything fits inside the panel with no scrolling; 70 px remain under the grid.

### 3.3 Page header (section B)

- Title `收款日历`: same style as page 02 (≈ 50 px bold serif, `#0a2f15`, glyph height 46, pitch 51).
- Subtitle `查看计划收款与到账安排`: 24 px regular sans, `#46564a`.
- No right-side actions.

### 3.4 Controls row = month header (section C)

Left block only, y 256..299.

- **Month title `2026年11月`:** left-aligned at x 141. ≈ 33–34 px, bold sans (stems 4.1 px), `#0b2a14`. Digits 25 px high, CJK glyphs 30 × 31. No spaces between number and unit.
- **Controls, grouped at the right, 17 px gaps:**

| Control | Box | Content |
|---|---|---|
| Previous | (648, 256, 47, 44) | chevron-left 9 × 15, stroke 2.4, `#07210b` |
| `本月` | (712, 256, 89, 44) | text 19–20 px regular to medium, `#04240d`, x 735..771 |
| Next | (818, 256, 47, 44) | chevron-right 9 × 15 |

  All three: radius ≈ 12, border ≈ 1.5 px `#c5d5cd`–`#ccdad1`, fill `#ecf5ef` (`本月` is `#e9f3ed`), a white hairline inside the border, no shadow.
- The group's right edge (x 864) is 21 px inside the grid's right edge; the month title is 17 px inside the grid's left edge.
- Rule under the header: y 316–317 (`#dce8e0`, `#cad8cf`), spanning the grid width.

### 3.5 Main content (section D)

**Split**
- Left block (month): x 124..885, width 762.
- A **visible vertical line** at x 908–909 (`#d9e5dd`, `#c9d8ce`), y 235..816.
- Right column: x 949..1365, width 417.
- Gutter: 23 px from grid to line, 40 px from line to right column. Proportion of the 1241 px content width: 61.4 % left, 33.6 % right.

**Weekday row**
- Labels `日 一 二 三 四 五 六` — **week starts on Sunday.**
- ≈ 20 px regular sans, `#032407` (dark, not muted). Centred over the columns (centres x 175, 286.5, 398.5, 510, 621.5, 733.5, 842.5; pitch 111.4).
- Band y 318..385 (68 px), no background.

**Day grid**
- One bordered box (124, 386, 762, 428) with outer corner radius ≈ 8–10. **1 px grid lines in both directions**, not separate cards. Line colour `#d4e0d8`–`#d8e3dc` (as a crisp 1 px line about `#cfdcd3`, text green at alpha 0.12). Cell fill is the panel colour (`#eaf4ee`).
- 5 rows × 7 columns. Row lines at y 386, 472, 558, 643, 729, 813 → **cell height 85.4**.
- Column lines as painted: x 124, 226, 333, 458, 568, 670, 797, 885 (widths 102, 107, 125, 110, 102, 127, 88). Target: equal columns of **108.9**.
- **Day number:** at the top of the cell, roughly centred. As painted, its centre sits 42–54 px (mean 45) from the cell's left line in every column, which is about 9 px left of the centre of a 108.9 px cell; the entry line below it is truly centred (±3 px). Target: centre both. Digit top 17–19 px below the cell's top line. Digits 18 px high → ≈ 24–25 px, medium (stems 2.4), `#021a06`.
- **Adjacent months: blank.** The five cells after 30 are empty (grid lines only). No faded numbers.

**A day with a payment**
- One text line under the number, horizontally centred in the cell: a 12 px status dot, 6–8 px gap, then status word and amount, for example `已收 ¥3,600`.
- Line ink starts 34 px below the number's top (cell top + 52) and is 16 px high. Text ≈ 16 px regular, `#0c260f`.
- Dot colour by status: `已收` green `#5e9a63`; `待收` gold `#e8c561` (`#ddbb56` on the selected cell). The text is not coloured.
- No chips, no counts, no bars.
- **More than one item: not shown.** Every day in the prototype has at most one line. With an 85 px cell there is room for one line as drawn (19 px remain below it).

**Selected day (13)**
- A tinted rounded rectangle filling the cell, inset 2–3 px from the grid lines: (672, 475, 124, 81), radius ≈ 10, flat fill `#d0ecc9`, a faint light edge, no border.
- The number and entry keep their normal colour and weight.

**Today**
- No separate today style exists in the prototype. Day 13 is the only marked day and it is the day shown in the right column. All 30 numbers have the same colour and stroke weight; no ring, dot or bold.

**Right column**

1. **Heading `11月13日 · 周五`** — the selected date itself is the heading. Ink x 951..1162, y 259..285. ≈ 29–30 px bold sans (stems 3.4), `#04230c`. Rule under it at y 306–307, x 949..1365.
2. **Entry row** (y 307..429, 122 px):
   - Left, two lines: `网站视觉升级` 24 px medium, `#011306`, ink y 336..357; `尾款` 19 px regular, `#46564c`, ink y 370..387.
   - Amount `¥2,400`: ≈ 24 px medium, `#021806`, right edge x 1264, vertically centred on the two lines.
   - Chip `待收`: (1291, 345, 69, 36), full pill, flat fill `#f2e3b1`, text 18–19 px `#755217`, no border, no icon. 27 px after the amount.
   - Rule at y 428–429.
3. **Heading `近期收款`** — ink x 950..1062, y 475..500. ≈ 28–29 px semibold sans (stems 2.6), `#021a08`. Rule at y 523–524.
4. **Rows, 63 px each**, two fields only: date `11月18日` at x 957 and project name `品牌物料设计` at x 1089 (date column 132 px). ≈ 21 px regular, `#07210b` and `#091a0d`. A rule after each row (y 588–589, 650–651). No amount, no chip.
5. Rules in this column: `#c8d7ce`–`#d6e2db` raw (alpha ≈ 0.2 as a crisp line), full column width.
6. No legend. No footer link or button. The column is empty from y 652 to the panel bottom.

---

## 4. Palette (section E)

Measured values; lines are given raw (soft, 1.5–2 px in the bitmap).

| Role | Hex |
|---|---|
| Panel fill, top / middle / bottom | `#e9f2eb` / `#e8f1ea` / `#e4efe7` |
| Panel rim highlight | `#f1faf5`–`#f4fcf4` |
| Control fill (inputs, outline buttons) | `#ecf3ef`–`#edf3ef` |
| Control border | `#cbd8ce`–`#cfdbd1` |
| Table header rule | `#bfcfc2` |
| Table row rule | `#d0dad2`–`#d9e3da` |
| Calendar grid line | `#d4e0d8`–`#d8e3dc` |
| Divider and section rules (calendar) | `#c8d7ce`–`#d1ded5` |
| Display text (serif title) | `#0c2f17` |
| Heading text (bold sans) | `#0b2a14`, `#04230c` |
| Body text, primary | `#041407`–`#0b1d10` |
| Text secondary (subtitle, sub-line) | `#425546`–`#46564c` |
| Progress caption | `#1c3623` |
| Placeholder | `#64716b` |
| Muted icon (pagination chevrons) | `#79867b` |
| Accent green (progress fill) | `#629866` |
| Status dot, 已收 | `#5e9a63` |
| Progress track | `#d0e0d3` |
| Primary button fill | `#cee8cc` → `#bddebb`; text `#04290c` |
| Current page fill | `#c9e3c6` → `#c0dfbf` |
| Selected day fill | `#d0ecc9` |
| Dock active pill | `#cbe6c6` → `#bce0b9` |
| Chip 进行中 | fill `#d4e8d0` → `#cae2c6`; text `#113a19` |
| Chip 已完成 | fill `#d6ecd8` → `#cce7cf`; text `#0b3217` |
| Chip 未开始 | fill `#d9e2da` → `#d4dfd4`; text `#324237` |
| Gold chip 待收 | fill `#f2e3b1`; text `#755217` |
| Gold dot 待收 | `#e8c561` (range `#ddbb56`–`#eac660`) |
| Dock glass | `#d2e1d6` (left) to `#c4d8c7` (right) |
| Dock icon / label | `#093815` / `#0f2a15` |
| **Danger** | **not present on either page.** No overdue or error state is drawn. |

---

## 5. Differences from the baseline (section F)

### 5.1 Both pages

1. **Theme.** Baseline is dark; target is light (see 0.1).
2. **Panel.** Baseline (75, 83, 1337, 814), radius 29. Target (80, 82, 1327, 802), radius 38. The panel bottom moves from y 896 to y 883.
3. **Nothing scrolls in the prototype.** In both baselines the content is cut off by the panel bottom (the table in B2, the calendar and the second right card in B3). In the prototypes all content ends 54–70 px above the panel bottom.
4. **Title.** Baseline 40 px serif, stems 3.4 px. Target ≈ 50 px, stems 5.1 px (heavier weight), ink top at y 132.
5. **Subtitle.** Baseline 16 px, a data sentence (`77 个项目 · 显示 1-10 条，共 77 条`; `11 月暂无收款计划`). Target 24 px, a fixed description (`查看合同与收款进度`; `查看计划收款与到账安排`), ink y 195..217.
6. **Dock.** Baseline (414, 923, 658, 95), icons 22 px, labels 14 px, active pill flat `#94bd94`. Target (398, 912, 691, 102), icons 28 px, labels 15 px, item pitch 133, active pill a pale gradient `#cbe6c6` → `#bce0b9` with unchanged icon and label colour.
7. **Scene.** Baseline blurred and dimmed; target sharp outside the panel.

### 5.2 Page 02, in priority order

Baseline has, prototype does not:

1. Eyebrow `WORKSPACE / PROJECTS` (y 131..141). Remove; the title moves up from ink y 161 to 132.
2. Three metric cards `项目总数`, `当前页合同额`, `当前页收款率` (y 255..350, each 403 wide, at x 123, 542, 961). Remove.
3. Toolbar label block `PROJECT LEDGER` / `显示 1-10 条，共 77 条` (x 124..270). Remove.
4. Segmented status tabs `全部项目 进行中 已完成 未开始 已逾期 已归档` (x 454..893, y 375..416). Replace by the `全部状态` select.
5. Table card: 2 px border `#42554c` around x 123..1363, darker header fill. Remove; hairlines only.
6. `操作` column header and three inline icons (edit, delete, more). Replace by one ellipsis, no header.
7. Icon inside the status chip and the chip border. Remove.
8. Second line (client) under the project name, and two-line project names.
9. Two decimals on amounts (`¥4,000.00`); the prototype shows `¥6,000`.

Prototype has, baseline lacks:

1. `全部客户` select (806, 254, 209, 45).
2. A separate `客户` column.
3. Caption under the progress bar, `¥已收 / ¥合同` plus the percentage.
4. Pagination visible inside the panel, bottom-right, y 792..829 (in B2 it is below the cut-off).

Same element, different value (baseline → target):

| Element | Baseline | Target |
|---|---|---|
| Primary button | (1244, 160, 120, 36), text 14 px, saturated fill `#92bb92` | (1161, 160, 194, 50), text 22 px, plus 19 px, fill `#cee8cc` → `#bddebb`, text `#04290c` |
| Toolbar | y 375..416, height 42; search at the right, (1077, 375, 286, 42) | y 254..298, height 45; search first at the left, (138, 254, 429, 45); then two selects; 17 px gaps |
| Column order | 项目 / 客户, 合同金额, 已收款, 收款进度, 截止日期, 状态, 操作 | 项目名称, 客户, 截止日期, 合同金额, 已收款, 收款进度, 状态, (ellipsis) |
| Header row | height 45, 14 px, muted colour, filled | height 68, 19 px, dark `#0b2811`, no fill |
| Body row | 89 px; name 14 px, up to two lines; client 12 px below | 80 px; name 22 px medium, one line; client 20 px in its own column |
| Numbers | 15 px | 21–22 px medium, right-aligned at x 752 and 885 |
| Progress | bar 80 × 4 (x 790..869), percentage to the right | bar 219 × 13 pill, track `#d0e0d3`, fill `#629866`; caption line below |
| Status chip | about 70 × 22, bordered, icon, 12 px text | 85 × 34 pill, 18 px text, no border or icon |
| Row action | three ≈ 10 px icons at x 1246, 1285, 1326 | one ellipsis, 22 px wide, x 1326..1347 |
| Rows visible | 4.6 (clipped) of 10 | exactly 4, then pagination |

### 5.3 Page 03, in priority order

Baseline has, prototype does not:

1. Three metric cards `11 月应收`, `逾期收款`, `已收回款` (y 227..361). Remove; this frees 160 px.
2. Card around the calendar (x 123..934, from y 386). Remove; the month header becomes a free row above a bordered grid.
3. Cards around the right column (x 958..1363; `选中日期收款` at y 387..681, `本月收款` from y 699). Remove; open sections separated by hairlines, plus one vertical divider.
4. Heading label `选中日期收款` with the ISO date `2026-11-16` under it. The target heading is the date itself, `11月13日 · 周五`.
5. Sub-caption `最近两笔 · 按计划日期从新到旧`. Remove.
6. Footer `共 0 笔` and link `查看全部 →`. Remove.
7. Faded days of the adjacent months (26–31). Target: blank cells.
8. Today drawn as a 47 × 48 filled green square behind a bold number. Target: whole-cell tint, normal number.

Prototype has, baseline lacks:

1. Vertical divider line at x 908, y 235..816.
2. 1 px grid lines and a rounded outer border on the month grid.
3. In-cell entry line: status dot, status word, amount. (B3 has no payments this month, so I could not see whether the app already draws entries.)
4. Entry row layout: project name, stage name under it, amount, status chip.
5. Section `近期收款` with date + project rows.

Same element, different value (baseline → target):

| Element | Baseline | Target |
|---|---|---|
| Month block | card (123, 386, 812, …), calendar starts at y 386 | open; header y 256..299, grid (124, 386, 762, 428) |
| Month title | `2026 年 11 月`, ≈ 17 px bold, in the middle (x 358..468) | `2026年11月`, ≈ 33–34 px bold, left at x 141 |
| Month controls | chevrons at the far left (x 153) and far right (x 899) of the card; `本月` a 45 × 27 outlined pill at x 660 | grouped at the right: (648, 256, 47, 44), (712, 256, 89, 44), (818, 256, 47, 44); radius 12, outlined |
| Weekday row | Monday first; 12 px, muted; y 455..465 | Sunday first; ≈ 20 px, dark; y 341..360 |
| Cell | 111.4 × 82.5, no lines | 108.9 × 85.4, 1 px lines |
| Day number | ≈ 15 px, centred in the cell | ≈ 24–25 px medium, top-centre, 18 px from the cell top |
| Selected day | 47 × 48 square `#91bb8f`, bold dark number | cell tint `#d0ecc9`, inset 2–3 px, radius 10 |
| Right column | x 958..1363 (406), 24 px after the calendar card | x 949..1365 (417), 64 px after the grid, divider in between |
| Section headings | 20 px bold | 29–30 px bold and 28–29 px semibold |

### 5.4 Possible new product capabilities — decide before building

Page 02:

1. **Client filter (`全部客户`).** The baseline has no client filter. Needs a client list and a filter parameter.
2. **Status filter as a select.** The capability exists (tabs), the control changes. The baseline's `已逾期` and `已归档` have no chip design in the prototype.
3. **Summary metrics and the record count disappear.** `项目总数`, `当前页合同额`, `当前页收款率` and "共 77 条" have no place in the prototype. This is a loss of information, not a restyle.
4. **Page size.** The prototype fits exactly 4 rows of 80 px between header and pagination and does not scroll. The baseline loads 10 per page. Either reduce the page size at this window height, or let the table body scroll with pagination pinned.
5. **Row actions collapse into one menu.** Edit and delete move behind the ellipsis.
6. **Amount format** without decimals.

Page 03:

1. **Week starts on Sunday.** The baseline starts on Monday. Note that November 2026 needs 5 rows from Sunday but 6 rows from Monday; 6 rows of 85 px (510 px) do not fit above the panel bottom, so the row height must drop to about 71 px in six-row months.
2. **`近期收款` list.** The baseline's second section is `本月收款` ("最近两笔 · 按计划日期从新到旧"). The prototype lists the next pending payments in date order with only date and project. Different definition and fewer fields.
3. **Stage name (`尾款`)** as the second line of an entry. Needs the payment-stage label.
4. **In-cell entry text** (status and amount per day). The rule for a day with several payments is undefined in the prototype.
5. **Month summary and overdue count disappear.** `11 月应收`, `逾期收款`, `已收回款` are gone, and no overdue status or danger colour is drawn anywhere.
6. **Empty states.** The prototype shows data only; there is no reference for "该日无收款计划" or an empty upcoming list.

---

## 6. Appendix

### 6.1 Type scale, baseline against prototype

| Role | Baseline px | Prototype px |
|---|---|---|
| Page title (serif) | 40 | ≈ 50 |
| Subtitle | 16 | 24 |
| Primary button text | 14 | 22 |
| Table header | 14 | 19 |
| Project name | 14 | 22 |
| Client | 12 | 20 |
| Table numbers | 15 | 21–22 |
| Status chip text | 12 | 18 |
| Input and select text | 14–15 | 19–20 |
| Month title | 17 | 33–34 |
| Weekday label | 12 | 20 |
| Day number | 15 | 24–25 |
| Day entry line | — | 16 |
| Right-column heading | 20 | 28–30 |
| Right-column row text | — | 21–24 |
| Dock label | 14 | 15 |

Only the page title is serif. Every other text in both prototypes is sans.

### 6.2 Control sizes in the prototype

| Control | Height | Radius |
|---|---|---|
| Primary button | 50 | pill |
| Search input, selects | 45 | ≈ 14 |
| Calendar month buttons | 44 | ≈ 12 |
| Pagination buttons | 38 | ≈ 12 |
| Status chip | 34–36 | pill |
| Progress bar | 13 | pill |
| Selected day tint | cell − 5 | ≈ 10 |
| Day grid outer border | — | ≈ 8–10 |
| Panel | — | ≈ 38 |
| Dock, active Dock pill | 102, 76 | pill |

### 6.3 Measuring scripts (reusable, no images needed)

In `/tmp/orange-resume/agent-b/`, run with `python3 -I`. The first argument is `p2`, `p3`, `b2`, `b3` or a path to any PNG.

- `s11_inventory.py <png> x0 y0 x1 y1 [thr] [gapY] [gapX]` — lists every band of content in a region with its x clusters. Works on light and dark screenshots (use thr 14 for light, 40 for dark).
- `s05_lineext.py <png> h:y1,y2 v:x1,x2` — extent of horizontal or vertical hairlines.
- `lines.py <png> h x y0 y1 thr` / `v y x0 x1 thr` — finds hairlines along a column or row.
- `glyphs.py <png> dark|light label x0 y0 x1 y1 delta gap` — per-glyph boxes and pitch (font size).
- `shape.py <png> label x0 y0 x1 y1 thr` — bounding box, fill and corner profile of a filled shape.
- `edges.py <png> row|col p q0 q1 thr minlen` — colour plateaus along a line (borders, gradients, shadows).
