"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "glass-transition inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,box-shadow,background-color,border-color,opacity] duration-150 ease-[cubic-bezier(0.25,0.1,0.25,1)] active:translate-y-px active:opacity-90 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-[#e1a730] text-[#1a1a1a] font-semibold hover:bg-[#cf962a] shadow-[0_8px_24px_-18px_rgba(225,167,48,0.6)]",
        green: "bg-[#2b4d24] text-[#FFFEF9] hover:bg-[#23401e] shadow-[0_8px_24px_-18px_rgba(43,77,36,0.45)]",
        destructive:
          "bg-red-500 text-white hover:bg-red-600",
        outline:
          "glass-subtle border border-[#2b4d24]/30 text-[#2b4d24] hover:bg-[#2b4d24] hover:text-[#FFFEF9]",
        secondary:
          "glass-inset text-[#1a1a1a] hover:bg-white/60",
        ghost:
          "hover:bg-white/60 hover:text-[#1a1a1a]",
        link: "text-[#2b4d24] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md gap-1.5 px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
