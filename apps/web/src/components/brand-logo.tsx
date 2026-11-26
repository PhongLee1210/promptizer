import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";

interface BrandLogoProps {
  href?: string;
  className?: string;
  onNavigate?: () => void;
}

const LOGO_SIZE_PX = 28;

export function BrandLogo({ href = "/prompts", className, onNavigate }: BrandLogoProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md text-base font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <Image src="/logo.png" alt="" width={LOGO_SIZE_PX} height={LOGO_SIZE_PX} priority />
      <span>Promptizer</span>
    </Link>
  );
}
