import React from 'react';

export function StatCard({ label, value, sub, accent }: { label: string, value: string | number, sub: string, accent?: string }) {
  return (
    <div style={{
      background: "var(--color-canvas)", borderRadius: 14, padding: "18px",
      border: `1px solid var(--color-line-lt)`, boxShadow: "0 1px 4px rgba(10,92,107,0.06)"
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase",
        letterSpacing: "0.08em", marginBottom: 10
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700, color: "var(--color-ink)",
        letterSpacing: "-0.02em", marginBottom: 4
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: accent || "var(--color-muted)", fontWeight: 600 }}>
        {sub}
      </div>
    </div>
  );
}
