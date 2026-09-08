# Core Tokens
## Domain-agnostic implementation tokens

Use this file for all Cozy Pixel products.
Domain packs may override semantic tokens, but should not introduce arbitrary one-off values without a reason.

---

# 1. Spacing
Base unit: 4 px.

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

Usage:
- 4: micro ornaments, icon internals
- 8: icon-label gap
- 12: dense card padding
- 16: standard card padding
- 24: section gap
- 32+: major composition separation

---

# 2. Primitive neutral colors

```css
:root {
  --px-ink-950: #2f2b20;
  --px-ink-900: #443d2b;
  --px-ink-700: #625a40;
  --px-ink-500: #81775a;

  --px-paper-050: #fffdf6;
  --px-paper-100: #fff8e8;
  --px-paper-200: #fbeecf;
  --px-paper-300: #f5e3bd;
  --px-paper-400: #ecd49d;

  --px-brown-300: #cbb38a;
  --px-brown-500: #a8865f;
  --px-brown-700: #7e6042;
  --px-brown-900: #563f2f;

  --px-success: #79a55d;
  --px-warning: #e9c45c;
  --px-danger: #ca6a62;
  --px-info: #7ea5d8;
}
```

---

# 3. Semantic tokens

```css
:root {
  --color-canvas: var(--px-paper-100);
  --color-surface: var(--px-paper-200);
  --color-surface-strong: var(--px-paper-300);
  --color-surface-muted: var(--px-paper-050);

  --color-text-primary: var(--px-ink-900);
  --color-text-secondary: var(--px-ink-700);
  --color-text-muted: var(--px-ink-500);
  --color-text-inverse: var(--px-paper-050);

  --color-border-primary: var(--px-brown-700);
  --color-border-secondary: var(--px-brown-500);
  --color-border-highlight: var(--px-paper-050);

  --color-accent-primary: #6f8a3d;
  --color-accent-secondary: #8fa24d;
  --color-accent-soft: #dbe8b8;
  --color-reward: #ddb14e;
}
```

---

# 4. Geometry

```css
:root {
  --border-pixel-thin: 1px;
  --border-pixel: 2px;
  --border-pixel-strong: 4px;

  --corner-micro: 2px;
  --corner-small: 4px;
  --corner-medium: 8px;

  --control-h-sm: 32px;
  --control-h-md: 40px;
  --control-h-lg: 48px;

  --tap-target-min: 44px;
}
```

Avoid large modern rounded-card radii as the default.
When CSS radius is used, preserve a stepped/pixel feeling with layered borders.

---

# 5. Typography

Recommended semantic scale:

```css
:root {
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 24px;
  --font-size-2xl: 32px;
}
```

Rules:
- Korean body text prioritizes legibility over pixel purity.
- Use pixel/bitmap display fonts for titles, plaques, labels, and short UI strings when suitable.
- Use a readable Korean sans for paragraphs if bitmap Hangul quality is poor.
- Prefer medium/bold weights; avoid hairline typography.

---

# 6. Z layers

```css
:root {
  --z-bg: 0;
  --z-scene: 10;
  --z-panel: 20;
  --z-content: 30;
  --z-ornament: 40;
  --z-nav: 50;
  --z-popover: 70;
  --z-modal: 80;
  --z-toast: 90;
}
```

---

# 7. Component semantic tokens

```css
:root {
  --panel-bg: var(--color-surface);
  --panel-border: var(--color-border-primary);
  --panel-inner-border: var(--color-border-highlight);

  --button-primary-bg: var(--color-accent-primary);
  --button-primary-border: var(--color-border-primary);
  --button-primary-text: var(--color-text-inverse);

  --badge-bg: var(--color-accent-soft);
  --badge-border: var(--color-border-secondary);
  --badge-text: var(--color-text-primary);

  --progress-track: var(--px-paper-400);
  --progress-fill: var(--color-accent-primary);
  --progress-border: var(--color-border-primary);
}
```

---

# 8. Responsive density

Mobile:
- preserve large readable UI
- stack framed groups vertically
- do not shrink sprites until details disappear

Tablet/Desktop:
- increase composition breadth rather than simply scaling everything larger
- use 2-column or illustrated-window compositions
- retain integer raster scale wherever practical
