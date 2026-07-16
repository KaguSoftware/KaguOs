import Link from "next/link";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/lib/utils";

export function LinkButton({
  href,
  variant = "primary",
  size = "sm",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
