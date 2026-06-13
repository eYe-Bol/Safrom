export function SFSMark({ size = 36, light = false }: { size?: number, light?: boolean }) {
  const w = size;
  const h = Math.round(size * 1.32);
  const goldTop    = light ? "#FFE49A" : "var(--color-gold-pale)";
  const goldMid    = light ? "#E8C060" : "var(--color-gold)";
  const goldBottom = light ? "#C8A030" : "var(--color-gold-lt)";
  const gradId = light ? "sfsGL" : "sfsGD";
  
  return (
    <svg width={w} height={h} viewBox="0 0 120 158"
      style={{ display:"block", flexShrink:0, overflow:"visible" }}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="25%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%"   stopColor={goldTop}/>
          <stop offset="45%"  stopColor={goldMid}/>
          <stop offset="100%" stopColor={goldBottom}/>
        </linearGradient>
      </defs>

      <path fill={`url(#${gradId})`} d="
        M 72,6
        C 88,2 108,10 106,28
        C 104,44 86,52 68,62
        C 52,70 36,76 30,90
        C 24,104 32,118 48,124
        C 36,130 22,136 18,148
        C 14,158 22,165 32,162

        L 38,148
        C 28,152 24,144 30,136
        C 36,128 54,122 68,114
        C 84,106 100,96 106,80
        C 112,64 104,46 88,38
        C 76,32 62,34 52,40
        L 58,28
        C 66,22 80,18 86,10
        Z
      "/>

      <path fill={`url(#${gradId})`} d="
        M 72,4
        L 96,0
        L 106,22
        L 90,14
        L 82,28
        L 68,18
        Z
      "/>

      <ellipse cx="76" cy="32" rx="14" ry="11"
        fill={light ? "var(--color-teal-dk)" : "var(--color-canvas)"} opacity="0.92"/>
      <ellipse cx="46" cy="108" rx="14" ry="11"
        fill={light ? "var(--color-teal-dk)" : "var(--color-canvas)"} opacity="0.92"/>

      <g transform="translate(36,132) rotate(-44)">
        <rect x="-9" y="-14" width="18" height="16" rx="2"
          fill={`url(#${gradId})`}/>
        <rect x="-9" y="2"  width="18" height="3.5" rx="0"
          fill={light ? "var(--color-teal-dk)" : "var(--color-teal-dk)"} opacity="0.55"/>
        <rect x="-9" y="7"  width="18" height="3.5" rx="0"
          fill={light ? "var(--color-teal-dk)" : "var(--color-teal-dk)"} opacity="0.55"/>
        <path d="M -9,10 L 9,10 L 3,38 L -3,38 Z"
          fill={`url(#${gradId})`}/>
        <path d="M -9,10 L -22,28 L -5,20 Z"
          fill={`url(#${gradId})`}/>
        <path d="M 9,10 L 22,28 L 5,20 Z"
          fill={`url(#${gradId})`}/>
        <line x1="0" y1="11" x2="0" y2="36"
          stroke={light ? "var(--color-teal-dk)" : "var(--color-teal-dk)"} strokeWidth="1.8" opacity="0.5"/>
        <circle cx="0" cy="33" r="2"
          fill={light ? "var(--color-teal-dk)" : "var(--color-teal-dk)"} opacity="0.5"/>
        <polygon points="-3,38 3,38 0,48"
          fill={`url(#${gradId})`}/>
      </g>
    </svg>
  );
}

export function SFSBadge({ size = 40 }: { size?: number }) {
  const markW = Math.round(size * 0.58);
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: Math.round(size * 0.22),
      background: "var(--color-teal-dk)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 10px rgba(13,61,71,0.4)",
    }}>
      <SFSMark size={markW} light={true} />
    </div>
  );
}
