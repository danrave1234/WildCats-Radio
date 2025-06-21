import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "../../lib/utils"

const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-all duration-200 ease-out group",
      orientation === "vertical" &&
        "h-full w-3 border-l border-l-transparent p-[2px] hover:w-4 hover:bg-gray-50/80 dark:hover:bg-gray-800/60 backdrop-blur-sm data-[state=visible]:w-4",
      orientation === "horizontal" &&
        "h-3 flex-col border-t border-t-transparent p-[2px] hover:h-4 hover:bg-gray-50/80 dark:hover:bg-gray-800/60 backdrop-blur-sm data-[state=visible]:h-4",
      className
    )}
    {...props}>
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 !rounded-none bg-gray-400/50 hover:bg-gray-500/70 active:bg-gray-600/80 dark:bg-gray-500/50 dark:hover:bg-gray-400/70 dark:active:bg-gray-300/80 transition-all duration-150 opacity-60 hover:opacity-90 active:opacity-100 shadow-sm cursor-grab active:cursor-grabbing" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
