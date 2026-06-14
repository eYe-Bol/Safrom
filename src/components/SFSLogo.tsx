import Image from 'next/image';
import Link from 'next/link';

interface SFSLogoProps {
  size?: number;
  href?: string;
  className?: string;
}

export function SFSLogo({ size = 40, href, className = '' }: SFSLogoProps) {
  const img = (
    <Image
      src="/logo.png"
      alt="Sales From Scratch Logo"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      priority
    />
  );
  if (href) {
    return <Link href={href} className="shrink-0 block">{img}</Link>;
  }
  return <span className="shrink-0 block">{img}</span>;
}
