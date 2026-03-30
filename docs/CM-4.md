# CM-4 Toroidal model: settings and 4×4 rule system

## User story

As a user exploring the toroidal model, I want a **settings** entry point so I can choose how cellular automaton rules are expressed, including an optional **4-input / 4-output** neighborhood, in addition to the existing **2-input / 2-output** rules.

## Context

- **Today:** Rules are defined with **2 inputs and 2 outputs**.
- **Desired:** Support a second rule mode: **4 inputs and 4 outputs**, with a fixed ordering of signals.

## Rule mode: 4 input → 4 output

A rule is written as a mapping from four incoming edge signals to four outgoing edge signals:

`[ix+ iy+ ix- iy-] → [ox+ oy+ ox- oy-]`

### Input signals (read from neighbors)

| Symbol | Meaning        | Direction   |
|--------|----------------|-------------|
| `ix+`  | Along +x edge  | Left → right |
| `iy+`  | Along +y edge  | Top → bottom |
| `ix-`  | Along −x edge  | Right → left |
| `iy-`  | Along −y edge  | Bottom → top |

### Output signals (written to neighbors)

| Symbol | Meaning        | Direction   |
|--------|----------------|-------------|
| `ox+`  | Along +x edge  | Left → right |
| `oy+`  | Along +y edge  | Top → bottom |
| `ox-`  | Along −x edge  | Right → left |
| `oy-`  | Along −y edge  | Bottom → top |

Ordering in brackets is fixed: **`ix+`, `iy+`, `ix-`, `iy-`** on the left and **`ox+`, `oy+`, `ox-`, `oy-`** on the right.

### Node geometry (outputs)

Each node is drawn as a **circle**. The four outputs **`[ox+ oy+ ox- oy-]`** are shown as line segments that **start at the center** of that circle and **end on the inner circumference** (toward east, south, west, and north respectively), i.e. radial spokes **inside** one disc only, not crossing into a neighbor’s circle.

### Wire coupling (inputs from neighbors)

On the torus, each input at a node is the corresponding output from the adjacent neighbor:

| Input at this node | Equals |
|--------------------|--------|
| **`ix+`** | **Left** neighbor’s **`ox+`** |
| **`iy+`** | **Upper** (north) neighbor’s **`oy+`** |
| **`ix-`** | **Right** neighbor’s **`ox-`** |
| **`iy-`** | **Below** (south) neighbor’s **`oy-`** |

(Left/right and upper/below are the cardinal directions on the grid used by the toroidal UI.)

**Implementation note:** On each undirected horizontal (resp. vertical) wire, **ix+** and **ix−** (resp. **iy+** and **iy−**) of the two incident nodes refer to the same bit. After each tick it is updated as the **XOR** of the western / northern cell’s **ox+** / **oy+** with the eastern / southern cell’s **ox−** / **oy−**, so both polarities contribute.

## UI

- **Settings** control (e.g. button or icon) is available in the toroidal model experience.
- Settings includes a clear choice between rule modes (at minimum: **2→2** vs **4→4**), with short help text so users understand what each mode means.

## Acceptance criteria

1. User can open **settings** from the toroidal model view.
2. User can select **2-input / 2-output** rules (current behavior preserved) **or** **4-input / 4-output** rules.
3. In **4→4** mode, rule semantics follow the fixed tuple  
   `[ix+ iy+ ix- iy-] → [ox+ oy+ ox- oy-]` and the direction conventions above.
4. Switching modes updates the toroidal simulation consistently (no stale rule interpretation across mode changes).

## Notes

- Implementation details (editor UX, totalistic vs explicit tables, etc.) can be specified in a technical task; this story defines **user-visible behavior** and **signal semantics** only.
