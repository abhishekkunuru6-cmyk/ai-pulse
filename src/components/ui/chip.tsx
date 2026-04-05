"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const chipVariants = cva(
  "inline-flex items-center rounded-full text-xs px-3 py-1.5 transition-all cursor-pointer select-none flex-shrink-0 font-medium",
  {
    variants: {
      variant: {
        default: "bg-surface-2 text-zinc-400 hover:text-zinc-200",
        selected: "bg-brand-600 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipVariants> {
  readonly children: React.ReactNode;
}

export function Chip({
  variant,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button className={clsx(chipVariants({ variant }), className)} {...props}>
      {children}
    </button>
  );
}
