---
name: cozy-pixel-claw
description: Claw-machine / crane-game domain pack for the Cozy Pixel Core design system. Use for mobile web or app products centered on gacha-like crane play, collectible plushies, arcade reward loops, token/ticket economies, missions, rankings, friend/community play, machine browsing, result screens, and inventory/cabinet management. Inherit pixel geometry, UI primitives, theme logic, and quality rules from cozy-pixel-core; add arcade- and toy-specific assets and playful interaction patterns here.
when_to_use: Use for products whose main domain is claw machines, crane games, arcade-style collectible play, plush/capsule rewards, token economy, inventory/showcase, mission/reward systems, or playful event/lobby screens. Do not use this pack for unrelated productivity apps; invoke cozy-pixel-core alone or create another domain pack.
---

# Cozy Pixel Claw Domain Pack

## Dependency
This pack extends `cozy-pixel-core`.
Treat Core as the source of truth for:
- token architecture
- components
- pixel-art construction
- generic themes
- motion
- icon consistency
- asset architecture

This pack only adds:
- arcade/claw-machine semantic assets
- machine, reward, and play-flow screens
- toy/plush-specific reward vocabulary
- character / mascot direction for playful collectible experiences
- claw-game prompt recipes

---

# 1. Read reference files by task

For domain identity:
- `references/CLAW_DOMAIN_CONFIG.md`

For assets:
- `references/CLAW_ASSETS.md`

For screen design:
- `references/SCREEN_ASSET_MAP.md`

For generation prompts:
- `references/PIXEL_PROMPTS.md`

For mascot / plush / avatar direction:
- `references/SPRITE_BRIEF.md`

For color usage specific to this domain:
- `references/CLAW_THEME_OVERRIDES.md`

For production planning:
- `references/ASSET_PRODUCTION_ROADMAP.md`

---

# 2. Product fantasy
A playful pixel-art claw-machine world where the user:
- logs in and enters an arcade plaza
- browses cute claw machines
- spends coins or tickets
- plays a machine through simple mobile-web controls
- receives animated win / near-miss / result feedback
- collects plushies and capsule rewards
- manages inventory / display cabinet
- completes missions and attendance rewards
- optionally joins rankings, friend events, or seasonal collections

The product should remain usable as a mobile web game while feeling like a vibrant toy-arcade world.

---

# 3. Recommended intensity
Default: **Full** for consumer game/mobile-web experiences.

Use Medium when:
- a screen is wallet/shop heavy
- admin, policy, or settings readability matters
- dense account or transaction information is shown

Use Light for:
- legal pages
- top-up history
- customer support / FAQ tools

---

# 4. Claw-specific visual vocabulary
Prefer:
- claw arms
- acrylic machine windows
- prize platforms
- plush toys
- capsule balls
- tickets / coins / tokens
- joysticks / big buttons
- blinking bulbs / marquee frames
- gift boxes
- confetti / stars / sparkles
- collection shelves / display cabinets
- mission stamps
- combo / streak / jackpot badges

Keep the atmosphere playful and tactile.
Do not make every screen feel like the inside of a literal arcade cabinet; use the metaphor with hierarchy.

---

# 5. Recommended theme mapping
- Login / onboarding: Candy or Peach
- Lobby / machine browse: Candy / Sky / Berry
- Machine detail / play: Candy / Ocean with accent lights
- Results / jackpot: Honey + Candy accents
- Collection / cabinet: Peach / Lavender / Mono Parchment
- Missions / attendance: Honey / Sky
- Shop / recharge: Honey / Ocean
- Rankings / events: Berry / Candy
- Night arcade event: Night + neon accents used sparingly

---

# 6. Domain separation rule
If this design system is reused for another app, do not carry over:
- claw machines
- plush inventory shelves
- joystick/button game controls
- ticket/token economy assets
- jackpot effects
- arcade marquee motifs

Those belong to this domain pack only.

Current user request when manually invoked:
`$ARGUMENTS`
