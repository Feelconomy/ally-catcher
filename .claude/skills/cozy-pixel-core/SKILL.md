---
name: cozy-pixel-core
description: Reusable domain-agnostic cozy pixel-art design system for apps and websites. Use for detailed game-like pixel UI across finance, travel, habits, education, community, commerce, productivity, lifestyle, or new product domains. Provides visual grammar, tokens, reusable UI primitives, themes, art rules, icon rules, asset architecture, and Light/Medium/Full intensity modes. Do not inject reading-specific books, shelves, quotes, or book-club motifs unless the requested domain needs them.
when_to_use: Use whenever the user wants a cozy, highly detailed pixel-art interface or wants an existing product adapted into this visual system. Combine with a domain pack when one exists. Otherwise derive domain assets from the user's product semantics while preserving the core system.
---

# Cozy Pixel Core

## Mission
Create highly detailed, handcrafted pixel-art product interfaces that share a coherent visual language without forcing every product into the same world or subject matter.

The **visual grammar is reusable**.
The **domain metaphor is replaceable**.

Never confuse those two layers.

---

# 1. Required mental model

Every implementation has two parts:

```text
CORE VISUAL LANGUAGE
+ DOMAIN CONTENT PACK
= FINAL PRODUCT
```

Core controls:
- pixel geometry
- borders
- panels
- ribbons
- buttons
- typography hierarchy
- spacing
- state design
- animation logic
- icon construction
- theme architecture
- detail density

Domain controls:
- semantic objects
- mascots
- room/world metaphor
- achievement meaning
- empty-state scene
- contextual illustrations
- screen-specific motifs

If no domain pack exists, derive a temporary domain vocabulary from the product itself.

---

# 2. Read reference files selectively

For implementation or token work, read:
- `references/CORE_TOKENS.md`
- `references/CORE_COMPONENTS.md`

For visual/art quality, read:
- `references/PIXEL_ART_RULES.md`
- `references/ASSET_RULES.md`

For theme work, read:
- `references/COLOR_THEMES.md`

For animation, read:
- `references/MOTION_SYSTEM.md`

For icon systems, read:
- `references/ICON_SYSTEM.md`

For creating a new domain pack, read:
- `references/DOMAIN_PACK_TEMPLATE.md`

---

# 3. Core visual DNA

The system should feel:
- handcrafted
- cozy
- game-like
- collectible when appropriate
- richly detailed without becoming illegible
- crisp rather than blurry or painterly

Default structural language:
- layered pixel frames
- plaques and ribbons
- inset panels
- small sprite icons
- compact progress meters
- deliberate corner ornaments
- stepped/chamfered pixel geometry
- warm or themed outlines instead of pure black

Avoid:
- glassmorphism
- smooth generic SaaS cards
- giant soft drop shadows
- stock vector icon sets left untouched
- blurry faux-pixel art
- automatically using forest/books/flowers everywhere

---

# 4. Intensity system

Always choose or infer one level.

## Light
Use:
- pixel icon family
- stepped borders
- pixel buttons
- small badges
- restrained theme colors

Do not require:
- character mascots
- full scene backgrounds
- collectibles
- environmental frames

## Medium
Use:
- pixel panels
- ribbon headers
- sprite icons
- themed badges
- contextual ornaments
- small decorative scenes where helpful

## Full
Use:
- characters or domain mascots
- environmental worldbuilding
- collectible assets
- layered scene composition
- rich decorations
- achievements
- animated sprite moments

Default to **Medium** if the user gives no intensity preference.
Use **Full** for products explicitly seeking a life-sim/game feeling.

---

# 5. Domain translation rules

Before designing a screen, identify:
1. what the user tracks
2. what actions they perform
3. what progress means
4. what reward means
5. what objects naturally symbolize the domain
6. what environment can embody the product metaphor

Examples:

### Finance
Use:
- coins
- vaults
- wallets
- treasure chests
- savings jars
- goal flags
- ledgers

Avoid accidentally using:
- bookshelves
- quote cards
- reading mascots

### Travel
Use:
- maps
- tickets
- luggage
- trains
- airplanes
- stamps
- cameras
- signposts

### Habit
Use:
- plants
- sprouts
- watering cans
- streak flames
- calendar stamps
- growth stages

### Education
Use:
- notebooks
- stars
- pencils
- chalkboards
- subject badges
- progress medals

---

# 6. Core component requirement

Prefer reusable primitives such as:

```text
PixelAppShell
PixelSceneLayer
PixelFrame
PixelPanel
RibbonTitle
PixelButton
PixelIconButton
PixelBadge
ItemSlot
StatRow
PixelProgress
PixelTabs
PixelInput
PixelModal
PixelTooltip
PixelToast
PixelCalendarCell
PixelAvatarFrame
PixelEmptyState
```

Do not style every screen from scratch.

---

# 7. Theme requirement

Use a theme family from `COLOR_THEMES.md` or define a compatible domain theme.
Do not apply every color at equal strength.

Recommended composition:
- 60–75% neutral/background
- 15–30% primary theme color
- 5–10% secondary accents/reward color

---

# 8. Pixel integrity requirement

All raster assets must:
- use crisp hard edges
- avoid anti-aliased halos
- scale by integers when practical
- use coherent outline thickness
- share a consistent lighting direction
- remain readable at their intended UI size

For generated imagery, cleanup is part of production, not optional.

---

# 9. Accessibility requirement

The visual system must preserve:
- readable Korean and Latin text
- sufficient contrast
- semantic HTML
- non-color status indicators
- comfortable touch targets
- reduced-motion options

Decorative complexity cannot justify unreadable interfaces.

---

# 10. Default workflow

1. Determine domain.
2. Determine intensity: Light / Medium / Full.
3. Choose primary theme.
4. Identify domain metaphor and semantic object set.
5. Define tokens before page-level styling.
6. Build shared primitives.
7. Produce one high-fidelity anchor screen.
8. Check pixel integrity and density.
9. Expand to additional screens.
10. Add optional worldbuilding and animation last.

Current user request when manually invoked:
`$ARGUMENTS`
