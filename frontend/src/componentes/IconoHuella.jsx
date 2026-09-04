/**
 * Icono de huella dactilar en SVG (no emoji): el emoji de huella (🫆) es de
 * 2023 y Windows 10 nunca recibio la fuente que lo dibuja, se ve como un
 * cuadro vacio. Este SVG se ve igual en cualquier sistema operativo.
 */
export default function IconoHuella({ size = "1em", style, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: size, height: size, display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0, ...style }}
      {...props}
    >
      <path d="M12 11c-.5 1.5-.5 3 0 5" />
      <path d="M8.5 9.5c-1 2.5-1 6 .5 9.5" />
      <path d="M15.5 9.5c1 2.2 1.3 4.6.8 7" />
      <path d="M5.5 8c-1.8 3.5-1.8 8.5.5 13" />
      <path d="M18.5 8c1.5 3 2 6.8 1 10.5" />
      <path d="M12 6.2a5.8 5.8 0 0 1 5.8 5.8" />
      <path d="M12 6.2A5.8 5.8 0 0 0 6.2 12" />
      <path d="M9.5 4.5A8.5 8.5 0 0 1 20.5 12.5" />
      <path d="M12 3a9 9 0 0 0-8.8 7" />
    </svg>
  );
}
