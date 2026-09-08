# Pixel Art Rules
## Core raster and visual-quality rules

---

# 1. Base grids
Recommended source sizes:
- micro icon: 16x16 or 24x24
- standard icon: 32x32
- item sprite: 48x48 or 64x64
- badge: 48x48 or 64x64
- character: 96x128, 128x160, or 128x192
- mini scene: 160x160 or 192x192
- room/large object: 128x128 to 320x240 depending on context

---

# 2. Scaling
- prefer integer scaling
- use nearest-neighbor for true pixel assets
- avoid fractional transforms on raster art
- avoid repeated resampling

```css
.pixel-art {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

---

# 3. Outlines
- use contextual dark brown, olive, slate, plum, or theme-compatible dark colors
- avoid pure black unless deliberate
- outline thickness should be consistent within a family

---

# 4. Lighting
Default:
- top-left or top-center light
- darker lower-right cluster
- 1 px upper-edge highlight where useful

Keep lighting consistent across one asset family.

---

# 5. Detail density
Use meaningful clusters, not noise.

High-detail pixel art may include:
- tiny highlights
- material cues
- trim
- stitching
- leaf/petal clusters
- glints
- shallow inset shading

Reject random one-pixel static that does not improve form.

---

# 6. Generated-art cleanup
1. crop to intended bounds
2. reduce to controlled base grid
3. quantize palette when necessary
4. remove semi-transparent edge fuzz
5. repair outlines manually
6. upscale by integer multiple
7. inspect at 100%, 200%, and final UI size

Reject if:
- painterly edges
- anti-aliased halos
- fake tiny brush noise
- inconsistent outlines
- conflicting light direction
- vector art with a pixel filter

---

# 7. Perspective
Each world/room asset family must choose a perspective and stick to it.
Options:
- front/flat game menu
- slight 3/4 object perspective
- top-down/isometric only if the entire product commits to it

Do not mix unrelated perspectives inside one composition.

---

# 8. Transparency
Standalone sprite assets should generally:
- use transparent background
- have clean alpha edges
- avoid glow unless the effect is intentional and separately controllable
