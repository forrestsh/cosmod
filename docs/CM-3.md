# CM-3: Home page — choose simulation model

## Summary

The product should expose a **home page** (landing experience) where the user **chooses which hex cosmic grid model to open** before interacting with the simulation. At minimum, users must be able to pick between the **standard (planar) grid** and the **toroidal** variant so each model remains a distinct entry point rather than requiring a URL or file guess.

## Background

Today the codebase includes two interactive implementations:

- **Planar hex grid:** `hex-cosmic-grid.jsx` — the primary grid experience referenced by prior stories ([CM-1](CM-1.md), [CM-2](CM-2.md)).
- **Toroidal grid:** `cosmic-grid-toroidal.jsx` — same general interaction paradigm with toroidal (wrap-around) topology.

A dedicated home page makes the product easier to discover, avoids duplicated “which file do I run?” confusion, and leaves room to add more models later under the same pattern.

## User-facing behavior

1. On first visit (or when returning to “home”), the user sees a **clear list or set of cards** for each available model (short title, one-line description optional).
2. Choosing a model **navigates** (or loads) that model’s full-screen experience; the user can **return to home** to switch models without manually editing routes or filenames.
3. Model names and descriptions are **understandable to someone who has not read the repo** (e.g. “Hex grid (planar)” vs “Hex grid (toroidal)” — exact copy TBD).

## Acceptance criteria

1. A **home page** exists and is the default entry when launching the app (or the documented primary URL), unless a deep link to a specific model is explicitly supported.
2. The home page presents **at least two choices**: planar (`hex-cosmic-grid.jsx` concept) and toroidal (`cosmic-grid-toroidal.jsx` concept).
3. Selecting an option opens the corresponding experience with **functional parity** to opening that component directly today (simulation, controls, no broken routing).
4. From within a model, the user can **return to the home page** (link, button, or equivalent — pattern TBD) without a full browser refresh if the stack supports it.
5. Adding a third model later should require **minimal home-page changes** (e.g. one new card and route), not a redesign of the selection UI.

## Out of scope (unless amended)

- Visual design system, branding, or marketing copy beyond clear labels.
- Persisting “last used model” across sessions (could be a follow-up).
- Merging the two grids into one component with a topology toggle (this story assumes **separate implementations** surfaced from one home page).

## References

- Planar implementation: `hex-cosmic-grid.jsx`
- Toroidal implementation: `cosmic-grid-toroidal.jsx`
- Rule model: [CM-1](CM-1.md), [CM-2](CM-2.md)
