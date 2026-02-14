import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-brand text-sm font-medium transition-all duration-normal ease-premium-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "btn-primary shadow-premium-sm hover:shadow-premium-md",
        secondary: "btn-secondary shadow-premium-sm",
        destructive: "bg-destructive text-white shadow-premium-sm hover:bg-destructive/90",
        danger: "bg-destructive text-white shadow-premium-sm hover:bg-destructive/90",
        outline: "border border-border bg-transparent text-foreground hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        brand: "btn-primary shadow-premium-sm hover:shadow-premium-md",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3.5 text-[13px]",
        lg: "h-11 px-6 text-base",
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
