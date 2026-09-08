# Domain Pack Template
## Use this to create a new domain-specific Cozy Pixel skill

Create a new skill named:

```text
cozy-pixel-[domain]
```

It should inherit visual rules from `cozy-pixel-core` and only define what changes for that product domain.

---

# 1. Domain identity

```yaml
domain: [Finance / Travel / Habit / Education / etc.]
product_jobs:
  - [what users actually do]
primary_emotion:
  - [calm / exciting / reliable / social / etc.]
recommended_intensity: [Light / Medium / Full]
```

---

# 2. Domain metaphor
Define one coherent world metaphor.

Example Finance:
```text
personal treasury / town bank / savings vault
```

Example Travel:
```text
journey board / station / passport desk / map room
```

Do not mix multiple unrelated metaphors without hierarchy.

---

# 3. Semantic asset vocabulary
Define at least:
- 20 core domain icons
- 10 semantic objects
- 5 progress/reward objects
- 5 empty-state motifs
- 1 optional environment set

---

# 4. Screen asset map
For every major screen define:
- required core UI primitives
- required domain assets
- optional worldbuilding assets
- recommended theme
- recommended intensity
- empty state

---

# 5. Reward system
Define what success means.
Examples:
- finance: goal achieved, savings streak, budget kept
- habit: streaks, consistency, growth stages
- travel: visited places, completed itineraries, stamp collection

Then create corresponding badge/trophy vocabulary.

---

# 6. Character policy
Choose one:
- no mascot
- subtle companion only
- full mascot
- user-avatar-centered

Do not add a mascot automatically if it weakens trust or product tone.

---

# 7. Theme overrides
Select:
- primary theme
- secondary theme
- reward theme
- optional night/season themes

---

# 8. Forbidden inheritance
Explicitly list motifs that should not leak from other packs.
Example:
```text
Do not use books, quotes, shelves, librarians, or book-club tea imagery unless the finance product explicitly calls for them.
```

---

# 9. Minimum files for a new domain pack

```text
SKILL.md
references/
├─ DOMAIN_CONFIG.md
├─ DOMAIN_ASSETS.md
├─ SCREEN_ASSET_MAP.md
├─ DOMAIN_PROMPTS.md
└─ THEME_OVERRIDES.md
```
