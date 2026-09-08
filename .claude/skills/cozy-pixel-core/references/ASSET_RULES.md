# Asset Rules
## Domain-neutral asset architecture

---

# 1. Five asset layers

## Functional
- frames
- controls
- icons
- inputs
- tabs
- progress

## Semantic/domain
- objects directly representing the product domain

## Worldbuilding
- room/environment props
- scene motifs
- ambient decorations

## Reward
- badges
- trophies
- collectible seals
- milestone effects

## Social/identity
- avatars
- role badges
- community reactions
- profile frames

Not every app needs all five at equal strength.

---

# 2. Naming convention

```text
[category]_[subject]_[variant]_[size].png
```

Examples:
```text
icon_search_default_32.png
frame_panel_primary_9slice.png
badge_streak_gold_64.png
item_wallet_small_64.png
sprite_mascot_idle_128x160.png
```

---

# 3. Suggested directory

```text
assets/pixel/
├─ ui/
│  ├─ frames/
│  ├─ ribbons/
│  ├─ buttons/
│  ├─ inputs/
│  └─ progress/
├─ icons/
│  ├─ navigation/
│  ├─ actions/
│  ├─ utility/
│  └─ domain/
├─ items/
├─ characters/
├─ scenes/
├─ effects/
└─ seasonal/
```

---

# 4. Domain separation
Do not leak domain assets between unrelated products.

Examples:
- reading pack may use bookshelves; travel should not inherit them by default
- finance may use vaults; education should not inherit them by default
- habit growth motifs can inspire another domain only if semantically useful

---

# 5. Asset family QA
A family is complete when:
- outline thickness matches
- perspective matches
- lighting matches
- palette feels related
- transparent edges are clean
- intended-size readability passes
- required states exist

---

# 6. Production principle
Create anchor assets before a large library:
1. frame
2. ribbon
3. icon
4. semantic object
5. progress metaphor
6. optional character
7. one complete screen

Only expand after these look like one coherent product.
