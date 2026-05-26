# Movable & Resizable Panel

**Date:** 2026-05-25  
**Status:** Approved

## Problem

The Leet Buddy panel is fixed at `bottom: 16px; right: 16px` and 320px wide. On LeetCode it can overlap the test-result terminal at the bottom of the screen, blocking output the user needs to see.

## Goal

Let the user drag the panel anywhere on screen and resize it, so it never permanently blocks LeetCode's test result area.

## Decisions

| Question | Decision |
|---|---|
| Positioning model | Free drag (any position on screen) |
| Resize support | Yes — both width and height |
| Persistence | None — resets to default on each new problem |
| Dependencies | None — custom React hook only |

## Behavior

### Drag

- The entire header row (`lb-header`) is the drag handle.
- Cursor changes to `grab` on hover, `grabbing` while dragging.
- A subtle `⠿` icon in the header hints at the drag affordance.
- On `mousedown` on the header, track pointer delta and update `{x, y}` state.
- Before the first drag, `pos` is `null` and the CSS `right: 16px; bottom: 16px` rule positions the panel. Once dragged, `pos` becomes `{x, y}` and those values are applied as inline `left`/`top`, overriding the CSS defaults.
- Dragging outside the viewport edge is allowed but the panel is not forcibly clamped — the user can pull it back.

### Resize

- A resize grip sits in the bottom-right corner of the panel.
- Visual: a 3-line diagonal SVG indicator matching the panel's dark theme (`#555` lines).
- On `mousedown` on the grip, track pointer delta and update `{width, height}` state.
- Width clamped: 240px – 600px.
- Height clamped: 80px – 90vh.

### Reset

- When `slug` changes, `pos` resets to `null` (CSS `right/bottom` defaults take over) and `size` resets to `{ width: 320, height: undefined }` (height unset, content-driven).

## Architecture

### New file: `src/content/hooks/useDragResize.ts`

A single hook that owns all drag/resize state and event wiring.

```ts
useDragResize(slug: string | null): {
  pos: { x: number; y: number } | null;   // null = use CSS defaults
  size: { width: number; height?: number };
  dragHandleProps: React.HTMLAttributes<HTMLElement>;
  resizeGripProps: React.HTMLAttributes<HTMLElement>;
}
```

- `pos` and `size` reset to defaults whenever `slug` changes.
- Registers `mousemove` / `mouseup` listeners on `document` during a drag or resize (prevents sticking when the pointer leaves the element).
- Cleans up all listeners on unmount.

### Modified: `src/content/components/Panel.tsx`

- Call `useDragResize(slug)`.
- Spread `dragHandleProps` onto the `lb-header` div.
- Apply `pos` and `size` as inline styles on `.lb-root`.
- Render a `<div className="lb-resize-grip" {...resizeGripProps}>` containing the SVG indicator inside `.lb-root`.

### Modified: `src/content/panel.css`

- Remove `right: 16px; bottom: 16px` from `.lb-root` (position now driven by inline style).
- Keep `position: fixed` and `z-index`.
- Add `.lb-resize-grip` rule: `position: absolute; bottom: 0; right: 0; width: 18px; height: 18px; cursor: se-resize;`.

## Out of scope

- Persisting position/size to `chrome.storage`.
- Minimise/collapse toggle.
- Snap-to-corner shortcuts.
