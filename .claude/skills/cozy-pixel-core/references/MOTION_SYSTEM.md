# Motion System
## Discrete game-like micro-interactions

---

# 1. Principles
Motion should feel:
- small
- intentional
- sprite-like
- low-latency
- optional

Avoid:
- exaggerated elastic SaaS motion
- large blur trails
- constant distracting motion

---

# 2. Timing
Recommended:
- press: 80–120 ms
- hover/focus transition: 100–160 ms
- small sparkle: 300–700 ms
- idle sprite loop: 1.5–3 s

---

# 3. Motion patterns
- button press: translateY(1–2px)
- item hover: tiny highlight/glint
- reward unlock: 2–4 frame sparkle
- badge reveal: quick scale step + sparkle
- notification: 1–2 px shake or bob
- ambient leaves/objects: discrete slow sway

---

# 4. CSS example
```css
@keyframes tiny-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

.sprite-idle {
  animation: tiny-bob 1.8s steps(2, end) infinite;
}
```

---

# 5. Reduced motion
Honor `prefers-reduced-motion`.
Replace looping movement with static highlight states where possible.
