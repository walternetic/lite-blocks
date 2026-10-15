import React from 'react';

interface SelectionOverlayProps {
  rects: DOMRect[];
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({ rects }) => {
  if (!rects || rects.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none w-full h-full z-10 overflow-visible"
      aria-hidden="true"
    >
      {rects.map((r, idx) => (
        <rect
          key={idx}
          x={r.left}
          y={r.top}
          width={r.width}
          height={r.height}
          fill="var(--theme-accent, #2383e2)"
          fillOpacity={0.28}
          rx={2}
        />
      ))}
    </svg>
  );
};
