# CM-6: Grid size setting (player configurable)

## Summary

As a player, I want to configure the grid size so I can play on smaller or larger boards depending on my preference. The current grid size is `10`, and this remains the default value. The allowed grid size range is `1` to `30` (inclusive).

## Background

Grid size is currently fixed at `10`. Players need a simple way to adjust board size for different play styles and experimentation, while keeping a safe lower and upper bound to avoid invalid or extreme values.

## User-facing behavior

1. The UI exposes a **Grid Size** setting in an appropriate controls area (for example, Settings or control panel).
2. On initial load, the grid size is set to the default value: `10`.
3. Players can set grid size to any integer value from `1` through `30`.
4. Values outside the allowed range are prevented or rejected with clear feedback.
5. After setting a valid value, the simulation/grid updates using the selected size.

## Acceptance criteria

1. A visible **Grid Size** control exists for players.
2. Default grid size is `10` when opening the experience.
3. Valid input range is enforced as `1-30` inclusive.
4. Non-integer or out-of-range values do not result in an invalid grid state.
5. Setting a valid size applies correctly and consistently to the active grid.

## Out of scope (unless amended)

- Persistence of chosen grid size across sessions.
- Final visual styling and exact placement of the control.
- Performance optimizations for very large grids beyond the `30` maximum.

## References

- Existing settings story: [CM-5](CM-5.md)
- Existing rule/model context: [CM-1](CM-1.md), [CM-2](CM-2.md), [CM-3](CM-3.md)
