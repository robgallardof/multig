type EmojiIconProps = {
  symbol: string;
  label?: string;
  size?: number;
  className?: string;
};

function iconFor(symbol: string) {
  switch (symbol) {
    case "🔄":
      return { d: "M20 11a8 8 0 1 0 2.2 5.5M20 11V4m0 7h-7", color: "#60a5fa" };
    case "⚙️":
      return { d: "M12 3l2 1 2-1 2 2-1 2 1 2-1 2 1 2-2 2-2-1-2 1-2-2 1-2-1-2 1-2-1-2 2-2 2 1 2-1z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0", color: "#c084fc" };
    case "🧩":
      return { d: "M9 3h6v3a2 2 0 1 1 4 0v3h-3a2 2 0 1 0 0 4h3v3h-3a2 2 0 1 1-4 0v-3H9a2 2 0 1 0 0-4h3V6a2 2 0 1 1-4 0V3z", color: "#34d399" };
    case "🛠️":
      return { d: "M4 20l6-6m2-2l8-8m-2 0h4v4M3 10l4-4 7 7-4 4-7-7z", color: "#f59e0b" };
    case "▶️":
      return { d: "M8 6l10 6-10 6z", color: "#22c55e" };
    case "🎨":
      return { d: "M12 3a9 9 0 1 0 0 18h1a3 3 0 0 0 0-6h-1a2 2 0 0 1 0-4h1a4 4 0 0 0 0-8h-1z M8 8h.01M6 12h.01M8 16h.01", color: "#f97316" };
    case "📋":
      return { d: "M9 3h6l1 2h3v16H5V5h3l1-2z M9 11h6M9 15h6", color: "#38bdf8" };
    case "🖼️":
      return { d: "M4 5h16v14H4z M8 11l2 2 3-3 5 5", color: "#fb7185" };
    case "✅":
      return { d: "M4 12l5 5 11-11", color: "#22c55e" };
    case "🔓":
      return { d: "M8 11V8a4 4 0 1 1 8 0M6 11h12v10H6z", color: "#f59e0b" };
    case "🧹":
      return { d: "M4 20l6-6m5-9l4 4-8 8-4-4 8-8z", color: "#a78bfa" };
    case "➕":
      return { d: "M12 5v14M5 12h14", color: "#60a5fa" };
    case "✏️":
      return { d: "M4 20l4-1 10-10-3-3L5 16l-1 4zM14 5l3 3", color: "#f59e0b" };
    case "🔀":
      return { d: "M4 7h5l3 3 3-3h5M4 17h5l3-3 3 3h5", color: "#22d3ee" };
    case "🗑️":
      return { d: "M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6", color: "#f87171" };
    case "📥":
      return { d: "M12 4v10M8 10l4 4 4-4M5 18h14", color: "#34d399" };
    case "📤":
      return { d: "M12 20V10M8 14l4-4 4 4M5 6h14", color: "#60a5fa" };
    case "📦":
      return { d: "M3 8l9-5 9 5-9 5-9-5zM3 8v8l9 5 9-5V8M12 13v8", color: "#fbbf24" };
    case "🕒":
      return { d: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM12 8v5l3 2", color: "#94a3b8" };
    default:
      return { d: "M12 5v14M5 12h14", color: "#94a3b8" };
  }
}

export function EmojiIcon({ symbol, label, size = 16, className }: EmojiIconProps) {
  const icon = iconFor(symbol);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={icon.color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      <path d={icon.d} />
    </svg>
  );
}
