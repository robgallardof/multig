import "./globals.css";

/**
 * Root layout.
 *
 * @since 2026-01-23
 */
export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{props.children}</body>
    </html>
  );
}
