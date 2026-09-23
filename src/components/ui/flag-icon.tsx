import { cn } from "@/lib/utils";

interface FlagIconProps {
  countryCode: string;
  className?: string;
}

export function FlagIcon({ countryCode, className }: FlagIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "fi inline-block shrink-0 rounded-sm shadow-sm",
        countryCode ? `fi-${countryCode.toLowerCase()}` : "fi-xx",
        className,
      )}
    />
  );
}
