# CM-5: Cosmic Grid 4x4 settings menu with predefined rules

## Summary

The Cosmic Grid 4x4 experience should include a **Settings** menu where users can choose predefined rule presets. One required preset is **Odd-Even**: if the input contains an odd number of `1` bits, output `1111`; if the input contains an even number of `1` bits, output `0000`.

## Background

Current stories define rule behavior and model selection, but users still need a simple way to configure rule behavior from the UI. A settings menu makes predefined rule selection discoverable and reduces manual rule editing.

## User-facing behavior

1. The Cosmic Grid 4x4 UI exposes a visible **Settings** entry point (button, icon, or panel toggle).
2. Inside Settings, users can view and select from predefined rule presets.
3. The **Odd-Even** preset is available with clear labeling and short helper text.
4. Selecting **Odd-Even** applies the rule immediately (or via an explicit Apply action, if that pattern is used consistently in the app).

## Rule definition (Odd-Even preset)

For a 4-bit input vector, let `k` be the number of `1` bits in the input:

- If `k` is odd, output is `1111`.
- If `k` is even, output is `0000`.

Examples:

| Input | Count of `1`s | Parity | Output |
| ------ | ---------------- | -------- | -------- |
| `0000` | 0 | even | `0000` |
| `0001` | 1 | odd | `1111` |
| `0011` | 2 | even | `0000` |
| `0111` | 3 | odd | `1111` |
| `1111` | 4 | even | `0000` |

## Acceptance criteria

1. A Settings menu exists in Cosmic Grid 4x4 and can be opened/closed by the user.
2. Settings includes a predefined-rule selector that contains **Odd-Even**.
3. When **Odd-Even** is active, every 4-bit input evaluation follows parity behavior exactly:
   - odd number of `1`s -> `1111`
   - even number of `1`s -> `0000`
4. Rule application is consistent across simulation updates (no mixed old/new behavior after selection).
5. The selected preset is clearly visible in the Settings UI (active state or equivalent).

## Out of scope (unless amended)

- Final visual design details of the Settings panel.
- Additional presets beyond the required Odd-Even example.
- Persistence of selected preset across sessions.

## References

- Home/model selection: [CM-3](CM-3.md)
- Existing rule-story format: [CM-2](CM-2.md)
