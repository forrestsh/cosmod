# CM-8: Export found magic-search rules for Cosmic Grid 4x4 import

## Summary

As a player, I want to export rules discovered in `cosmic-magic-search.jsx` as a JSON file (including both initial values and the rule), so I can import that file into the Cosmic Grid 4x4 model and test it.

## Background

`cosmic-magic-search.jsx` can discover rule candidates that evolve into a 4x4 magic square. Players need a direct way to take a discovered result and validate it in the main Cosmic Grid 4x4 experience without re-entering rule data manually.

## User-facing behavior

1. In the magic-search experience, each discovered result can be exported as a `.json` file.
2. Export is available from a clear UI action (for example, button on the selected result or detail panel).
3. The exported file includes:
   - The initial grid values used for the search scenario.
   - The rule definition required by Cosmic Grid 4x4.
4. Players can import that file in Cosmic Grid 4x4 using the existing/defined JSON import flow.
5. After import, the 4x4 model reflects the exported initial values and rule so players can run and verify behavior.
6. If export data is invalid or import detects incompatibility, the app shows clear feedback and preserves current state.

## JSON format expectations

The exported JSON should be valid, versionable, and explicitly compatible with Cosmic Grid 4x4 import. The schema can evolve, but should include fields equivalent to:

- `version`: export schema version.
- `model`: compatibility identifier (for example, `cosmic-grid-4x4`).
- `source`: optional producer metadata (for example, `cosmic-magic-search`).
- `initialValues`: full 4x4 initial grid payload used by the result.
- `rule`: full rule payload needed by the 4x4 model (not partial/derived only).

If helpful, include optional search context (such as `ruleInt`, `stepFound`, or trace metadata), but import-critical fields must remain stable and documented.

## Acceptance criteria

1. A player can export a discovered result from `cosmic-magic-search.jsx` to a `.json` file.
2. The exported file includes both initial values and full rule data required for replay in Cosmic Grid 4x4.
3. The exported JSON can be imported by Cosmic Grid 4x4 through its JSON import workflow.
4. After successful import, simulation state and behavior match the exported configuration (no missing initial state or mixed rule state).
5. Exported JSON is syntactically valid, and invalid/incompatible files are handled gracefully with user-visible errors.
6. Export action is discoverable in the magic-search result flow (clear label and placement).

## Out of scope (unless amended)

- Bulk export of all results in one archive.
- Server/cloud storage and sharing links.
- Automatic schema conversion for non-4x4 models.

## References

- Save/load JSON in 4x4 model: [CM-7](CM-7.md)
- Grid size and settings context: [CM-5](CM-5.md), [CM-6](CM-6.md)
- Home/model navigation context: [CM-3](CM-3.md)
