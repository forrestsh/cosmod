# CM-1: Six inputs and six outputs per node (rule+ and rule-)

## Summary

Each hex node’s signal logic should support **six inputs** and **six outputs**, driven by **two independent rule tables**: **rule+** for the “positive” edge directions and **rule-** for the “negative” edge directions. Today the system only models the positive set (conceptually **rule+**); this story adds the negative set (**rule-**).

## Background

Nodes sit on a hex grid. Along the three edge directions, each direction has two possible orientations (incoming from one neighbor vs. incoming from the opposite neighbor). We name the positive-facing ports with a `+` suffix and the opposite-facing ports with a `-` suffix.

## Port geometry (flow direction)

Directions describe how a signal **travels along** that port when it is active (e.g. “left → right” means the line runs from the left side of the node toward the right).

### Inputs (incoming to the node)

| Port | Direction along edge |
|------|----------------------|
| **ix+** | left → right |
| **iy+** | lower-right → upper-left |
| **iz+** | upper-right → lower-left |
| **ix−** | right → left |
| **iy−** | upper-left → lower-right |
| **iz−** | lower-left → upper-right |

### Outputs (outgoing from the node)

| Port | Direction along edge |
|------|----------------------|
| **ox+** | left → right |
| **oy+** | lower-right → upper-left |
| **oz+** | upper-right → lower-left |
| **ox−** | right → left |
| **oy−** | upper-left → lower-right |
| **oz−** | lower-left → upper-right |

> **Note:** **iz−** and **oz−** are the reversals of **iz+** / **oz+** on the same physical axis so that each `+` / `−` pair is a proper bidirectional pair. If a one-line spec duplicated the `+` direction for `−`, implementation should still follow this opposite pairing.

## Rules

Each rule is a mapping from the **three binary inputs** on that polarity (eight combinations) to the **three binary outputs** on the same polarity.

- **rule+:** [**ix+**, **iy+**, **iz+**] → [**ox+**, **oy+**, **oz+**] — only these **+** outputs; it does **not** map to [**ox−**, **oy−**, **oz−**].
- **rule−:** [**ix−**, **iy−**, **iz−**] → [**ox−**, **oy−**, **oz−**] — only these **−** outputs; it does **not** map to [**ox+**, **oy+**, **oz+**].

The two rules are **independent**: editing or presetting **rule+** must not implicitly change **rule−** unless the product explicitly defines a linked mode (out of scope unless specified).

## Current vs. desired

| Aspect | Current | Desired (CM-1) |
|--------|---------|----------------|
| Inputs per node | 3 (**ix**, **iy**, **iz**) — maps to **+** semantics | 6: **ix+**, **iy+**, **iz+**, **ix−**, **iy−**, **iz−** |
| Outputs per node | 3 (**ox**, **oy**, **oz**) — maps to **+** semantics | 6: **ox+**, **oy+**, **oz+**, **ox−**, **oy−**, **oz−** |
| Rule tables | One (implicit **rule+**) | Two: **rule+** and **rule−** |

## Acceptance criteria

1. Each node exposes six distinct input channels and six distinct output channels with the directions above.
2. Simulation (or equivalent runtime) applies **rule+** only to [**ix+**, **iy+**, **iz+**] when producing [**ox+**, **oy+**, **oz+**].
3. Simulation applies **rule−** only to [**ix−**, **iy−**, **iz−**] when producing [**ox−**, **oy−**, **oz−**].
4. UI and/or data model allow viewing and editing **rule+** and **rule−** separately (layout TBD; parity with how **rule+** is edited today is acceptable).
5. Wire/neighbor coupling matches **polarity on the shared edge**: **ox+** of A drives **ix+** of B when B is to the right of A; **ox−** drives **ix−** on the left neighbor; and analogously **oy±**→**iy±**, **oz±**→**iz±** along the corresponding hex directions.

## Out of scope (unless amended)

- Whether **rule+** and **rule−** must sometimes be synchronized or derived from one another.
- New presets beyond duplicating or extending the existing preset concept for both rules.

## References

- Implementation sketch: `hex-cosmic-grid.jsx` (today: three inputs **ix**, **iy**, **iz** and three outputs **ox**, **oy**, **oz**, single rule).
