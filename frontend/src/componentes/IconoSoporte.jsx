/**
 * Icono de soporte (salvavidas) en SVG: el emoji 🛟 es de 2021 y tampoco
 * lo dibuja la fuente de emojis de Windows 10 (mismo problema que la huella).
 */
export default function IconoSoporte({ size = "1em", style, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ width: size, height: size, display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0, ...style }}
      {...props}
    >
      <circle cx="12" cy="12" r="9" fill="#fff" stroke="#e2574c" strokeWidth="3" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="#e2574c" strokeWidth="1.6" />
      <line x1="12" y1="3" x2="12" y2="8" stroke="#e2574c" strokeWidth="3" />
      <line x1="12" y1="16" x2="12" y2="21" stroke="#e2574c" strokeWidth="3" />
      <line x1="3" y1="12" x2="8" y2="12" stroke="#e2574c" strokeWidth="3" />
      <line x1="16" y1="12" x2="21" y2="12" stroke="#e2574c" strokeWidth="3" />
    </svg>
  );
}
