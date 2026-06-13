import React from 'react';

export function Chip({ label, color, bg }: { label: string, color: string, bg: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color, background: bg, padding: "2px 9px",
      borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.07em"
    }}>
      {label}
    </span>
  );
}

export function StatusChip({ s }: { s: string }) {
  if (s === "out") return <Chip label="Out of Stock" color="var(--color-red)" bg="var(--color-red-bg)" />;
  if (s === "low") return <Chip label="Low Stock" color="var(--color-amber)" bg="var(--color-amber-bg)" />;
  if (s === "expiring") return <Chip label="Expiring Soon" color="var(--color-purple)" bg="var(--color-purple-bg)" />;
  return null;
}
