import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Kagu mark — the brand ribbon-bird. Served from an optimized 64px PNG
 * (~0.4KB, downscaled from the 1254px source in /brand) with its black
 * plate rounded so it reads as a tidy app tile on our dark surface.
 */
export function Logo({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/kagu-mark.png"
      alt="Kagu"
      width={size}
      height={size}
      priority
      className={cn("rounded-[5px]", className)}
    />
  );
}
