import * as FloatingUIDOM from '@floating-ui/dom';

// True on devices that can't hover (touch). An anchored popover makes little
// sense there, so callers show a bottom drawer (`.hover-sheet`) instead.
export function prefersTouchHover() {
  return !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
}

// Anchor `floatingEl` to `reference` and keep it positioned and on-screen for as
// long as it is shown. Returns a cleanup function to call when hiding.
//
// `onPos` receives each computed `{ top, left }`. Positioning re-runs on
// scroll/resize and when the popover itself resizes — e.g. its icon image
// finishes loading on a brand-new hover, which previously left the first
// position computed for the wrong size until a mousemove corrected it.
export function attachHoverPosition(reference, floatingEl, onPos, placement = 'right-start') {
  // Clear any size clamp left by a previous use before the first measure, so the
  // element is sized naturally. Done once here (not in the update loop) to avoid
  // a clamp/grow oscillation with the size middleware.
  floatingEl.style.maxWidth = '';
  floatingEl.style.maxHeight = '';
  const update = () => {
    FloatingUIDOM.computePosition(reference, floatingEl, {
      placement,
      strategy: 'fixed',
      middleware: [
        FloatingUIDOM.offset(16),
        FloatingUIDOM.flip({ fallbackPlacements: ['left-start', 'right-end', 'left-end'] }),
        // crossAxis keeps the popover on-screen vertically too, so a tall card
        // anchored low in the viewport isn't clipped.
        FloatingUIDOM.shift({ padding: 8, crossAxis: true }),
        // Clamp to the available space so it never overflows on small viewports.
        FloatingUIDOM.size({
          padding: 8,
          apply({ availableWidth, availableHeight, elements }) {
            Object.assign(elements.floating.style, {
              maxWidth: `${Math.max(0, availableWidth)}px`,
              maxHeight: `${Math.max(0, availableHeight)}px`,
            });
          },
        }),
      ],
    }).then(({ x, y }) => onPos({ top: y, left: x }));
  };
  return FloatingUIDOM.autoUpdate(reference, floatingEl, update);
}
