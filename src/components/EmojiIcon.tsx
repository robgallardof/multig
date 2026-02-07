type EmojiIconProps = {
  symbol: string;
  label?: string;
  size?: number;
  className?: string;
};

export function EmojiIcon({ symbol, label, size = 16, className }: EmojiIconProps) {
  return (
    <span
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ fontSize: size, lineHeight: 1, display: "inline-flex", alignItems: "center" }}
    >
      {symbol}
    </span>
  );
}
