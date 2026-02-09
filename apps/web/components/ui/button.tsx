import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-brand text-sm font-medium transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default:
          "bg-accent-600 text-white hover:bg-accent-700 shadow-soft hover:shadow-med",
        brand:
          "bg-brand-gradient text-brand-foreground shadow-soft hover:shadow-med hover:opacity-95",
        brandOutline:
          "border-2 border-brand bg-transparent text-brand hover:bg-brand/10",
        glass:
          "border border-white/20 bg-white/70 text-foreground backdrop-blur-sm hover:bg-white/90 hover:border-white/30",
        danger:
          "bg-destructive text-white hover:opacity-90",
        secondary:
          "bg-surface-2 text-foreground hover:bg-surface-3 border border-border",
        outline:
          "border border-border bg-background hover:border-brand/50 hover:bg-brand-gradient-subtle hover:text-foreground",
        ghost:
          "hover:bg-surface-2 hover:text-foreground",
        link:
          "text-brand underline-offset-4 hover:opacity-90 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        lg: "h-10 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? "span" : "button";
    const mergedClassName = cn(buttonVariants({ variant, size, className }));
    if (asChild && React.isValidElement(props.children)) {
      return React.cloneElement(props.children as React.ReactElement<{ className?: string }>, {
        className: cn(mergedClassName, (props.children as React.ReactElement<{ className?: string }>).props?.className),
      });
    }
    return (
      <button
        ref={ref}
        className={mergedClassName}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
