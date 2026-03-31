# CM-7: Save and reload edited rules for Cosmic Grid 4x4 (JSON)

## Summary

As a user of Cosmic Grid 4x4, I want to save my edited rule as a JSON file and later reload that file, so I can reuse, share, and continue working with the same rule configuration without re-entering it manually.

## Background

Users can edit rules, but there is currently no explicit save/reload workflow for rule definitions. Exporting to JSON and importing from JSON provides a portable, human-readable format for persistence and collaboration.

## User-facing behavior

1. In the Cosmic Grid 4x4 rule editor, users can choose **Save Rule** (or equivalent action) to export the current rule as a `.json` file.
2. The exported JSON contains all data required to restore the edited rule accurately in Cosmic Grid 4x4.
3. Users can choose **Load Rule** (or equivalent action) and select a previously saved `.json` rule file.
4. After loading a valid file, the rule editor and active simulation use the loaded rule.
5. If the selected file is invalid, unreadable, or incompatible, the app shows clear feedback and keeps the current rule unchanged.

## JSON format expectations

The saved file must be valid JSON and include enough information to recreate the rule used by Cosmic Grid 4x4. The exact schema can evolve, but should:

- Be versionable (for example, include a `version` field).
- Identify compatibility with the 4x4 model (for example, `model: "cosmic-grid-4x4"` or equivalent).
- Store the full editable rule content (not a partial snapshot).

## Acceptance criteria

1. A user can export the currently edited Cosmic Grid 4x4 rule to a `.json` file from the UI.
2. Exported JSON is syntactically valid and includes all fields needed to reconstruct the same rule.
3. A user can import a previously exported `.json` file and restore that rule in the editor.
4. After successful import, simulation behavior matches the loaded rule with no residual state from a prior rule.
5. Invalid/incompatible JSON files are rejected gracefully with a user-visible error message, and current rule state remains intact.
6. Save/load actions are discoverable in the rule-editing flow (clear labels and accessible placement).

## Out of scope (unless amended)

- Cloud sync or server-side rule storage.
- Multi-rule libraries, tagging, or search UX.
- Cross-model conversion between 4x4 and non-4x4 rule formats.

## References

- Rule/model context: [CM-1](CM-1.md), [CM-2](CM-2.md), [CM-3](CM-3.md)
- Settings and configuration context: [CM-5](CM-5.md), [CM-6](CM-6.md)
