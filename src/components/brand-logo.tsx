import logoUrl from "../assets/chiguru-logo.png";

interface BrandLogoProps {
  className?: string;
}

/**
 * Chiguru brand mark — original circular farm badge: rising sun over
 * green hills and plowed field rows, framed by wheat and laurel.
 */
export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src={logoUrl}
      alt="Chiguru"
      className={className}
      style={{ objectFit: "contain" }}
      draggable={false}
    />
  );
}
