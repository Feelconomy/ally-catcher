# Core Components
## Reusable UI primitives independent of domain

---

# 1. PixelAppShell
Responsibilities:
- theme
- canvas background
- page margins / safe areas
- global scene or texture layer
- main navigation

Variants:
- `light`
- `medium`
- `full-game`

---

# 2. PixelFrame / PixelPanel
Anatomy:
1. outer border
2. inner highlight
3. content fill
4. optional bottom/right shadow edge
5. optional corner ornament slots

Variants:
- primary
- secondary
- compact
- modal
- tooltip
- selected
- reward
- warning

Rule:
Use CSS for simple frames and 9-slice raster assets for ornate frames.

---

# 3. RibbonTitle
Anatomy:
- central plaque
- folded tails
- darker lower fold
- 1 px highlight
- optional icon/ornament slot

Variants:
- short
- long
- tab
- event
- reward
- warning

---

# 4. PixelButton
Variants:
- primary
- secondary
- tertiary
- destructive
- icon-only
- selected/toggled

Interaction:
- 1–2 px press offset
- small discrete highlight change
- no large soft elevation animation

---

# 5. PixelBadge
Use for:
- status
- role
- category
- reward
- rarity

Anatomy:
- 1–2 px outline
- short plaque body
- optional tiny sprite
- concise text

Avoid long pill chips.

---

# 6. ItemSlot
Use for domain objects and collectibles.

Anatomy:
- frame
- sprite center
- optional rarity marker
- optional locked state
- optional quantity
- short label below/within

---

# 7. StatRow
Anatomy:
- semantic sprite
- short label
- aligned value
- optional meter or trend indicator

Use tabular numbers where practical.

---

# 8. PixelProgress
Variants:
- standard bar
- segmented bar
- domain metaphor bar

Core anatomy:
- outer frame
- track
- fill
- 1 px highlight
- numeric indicator

Domain packs may replace visual metaphor while retaining measurement behavior.
Examples:
- finance: treasure chest fill
- habits: plant growth
- reading: bookmark fill
- travel: route completion

---

# 9. PixelTabs
Use plaque/ribbon tabs.
Required states:
- default
- hover/focus
- active
- disabled

Do not rely on color alone for active state.

---

# 10. PixelInput
Components:
- text field
- textarea
- select
- checkbox
- radio
- toggle
- date field
- search field

Rules:
- visible focus state
- readable text
- decorative frame must not reduce usable hit area

---

# 11. PixelModal
Anatomy:
- dim overlay
- framed modal
- ribbon title or plaque
- body content
- action row
- optional contextual sprite

Use decor sparingly in destructive or urgent dialogs.

---

# 12. PixelTooltip / Toast
Keep compact.
Good motifs:
- small speech plaque
- tiny sprite icon
- short tail or notch

---

# 13. PixelNavigation
Possible implementations:
- bottom nav plaque
- top tabs
- side menu
- illustrated game-menu strip

All semantic icons should come from the same icon family.

---

# 14. PixelEmptyState
Anatomy:
- domain mini scene
- optional mascot/companion
- short text block
- one CTA

Core controls the layout; domain pack controls the story.

---

# 15. Intensity mapping by component

## Light
- PixelFrame simplified
- PixelButton
- PixelBadge
- Icon family
- plain background or light pattern

## Medium
All Light components plus:
- RibbonTitle
- ItemSlot
- decorated progress meters
- moderate ornaments

## Full
All Medium components plus:
- scene layers
- mascot slots
- environmental decorations
- collectible frames
- animated effect layers
