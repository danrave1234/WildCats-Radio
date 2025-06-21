import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const spinnerVariants = cva(
  "relative inline-block transform-gpu",
  {
    variants: {
      variant: {
        default: "[&>div]:bg-foreground",
        primary: "[&>div]:bg-maroon-600 dark:[&>div]:bg-maroon-400",
        secondary: "[&>div]:bg-blue-500 dark:[&>div]:bg-blue-400",
        destructive: "[&>div]:bg-destructive",
        muted: "[&>div]:bg-muted-foreground",
      },
      size: {
        sm: "w-4 h-4",
        default: "w-5 h-5",
        lg: "w-8 h-8",
        xl: "w-12 h-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export const Spinner = React.forwardRef(({ 
  className, 
  variant, 
  size, 
  ...props 
}, ref) => {
  return (
    <div
      ref={ref}
      role="status"
      aria-label="Loading"
      className={cn(spinnerVariants({ variant, size }), className)}
      {...props}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="animate-spinner absolute left-[46.5%] top-[4.4%] h-[24%] w-[7%] 
                     origin-[center_190%] rounded-full opacity-[0.1] will-change-transform"
          style={{
            transform: `rotate(${i * 30}deg)`,
            animationDelay: `${(i * 0.083).toFixed(3)}s`,
          }}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  )
})

Spinner.displayName = "Spinner"

export { spinnerVariants } 