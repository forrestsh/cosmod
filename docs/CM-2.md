# CM-2: Identity rule preset

## Summary

The product should support an **identity** rule (preset or named rule): for every combination of the three binary inputs, each output bit equals the corresponding input bit. **rule+** and **rule−** may each be set to identity independently unless product requirements say otherwise.

## Background

Per [CM-1](CM-1.md), each polarity has a rule mapping [**ix±**, **iy±**, **iz±**] → [**ox±**, **oy±**, **oz±**] across eight rows. The **identity** rule is the mapping where **ox = ix**, **oy = iy**, and **oz = iz** for every input row.

## Rule definition (identity)

For either **rule+** or **rule−**, the mapping is:

| ix | iy | iz | → | ox | oy | oz |
|----|----|----|---|----|----|----|
| 0 | 0 | 0 | → | 0 | 0 | 0 |
| 0 | 0 | 1 | → | 0 | 0 | 1 |
| 0 | 1 | 0 | → | 0 | 1 | 0 |
| 0 | 1 | 1 | → | 0 | 1 | 1 |
| 1 | 0 | 0 | → | 1 | 0 | 0 |
| 1 | 0 | 1 | → | 1 | 0 | 1 |
| 1 | 1 | 0 | → | 1 | 1 | 0 |
| 1 | 1 | 1 | → | 1 | 1 | 1 |

Equivalently: **[a b c] → [a b c]** for all **a**, **b**, **c** ∈ {0, 1}.

## Acceptance criteria

1. Users (or the data model) can select or assign **identity** for **rule+**, for **rule−**, or for both, without altering the other table unless explicitly changed.
2. When **identity** is active for a polarity, simulation produces outputs that match that polarity’s inputs row-for-row as in the table above.
3. If the UI exposes presets, **identity** appears as a first-class option with a clear label (exact copy TBD).

## Out of scope (unless amended)

- Whether **identity** is the default for new nodes.
- Performance or storage optimizations specific to identity.

## References

- Port and dual-rule model: [CM-1](CM-1.md)
