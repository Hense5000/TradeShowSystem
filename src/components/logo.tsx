import Image from "next/image";

/** The Trade Show System logo. Use `variant="white"` on the blue brand background. */
export function Logo({ variant = "blue", className = "h-8 w-auto" }: { variant?: "blue" | "white"; className?: string }) {
  return (
    <Image
      src={`/brand/logo-${variant}.png`}
      alt="Trade Show System"
      width={782}
      height={156}
      className={className}
      priority
    />
  );
}
