import * as React from "react"
import { ScrollArea, ScrollBar } from "./scroll-area"
import { cn } from "../../lib/utils"

const EnhancedScrollArea = React.forwardRef(({ 
  className, 
  children, 
  orientation = "vertical",
  autoHide = true,
  ...props 
}, ref) => {
  const scrollAreaRef = React.useRef(null)
  const viewportRef = React.useRef(null)
  const timeoutRef = React.useRef(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isScrollbarVisible, setIsScrollbarVisible] = React.useState(!autoHide)

  // Handle scroll visibility with auto-hide
  const showScrollbar = React.useCallback(() => {
    if (!autoHide) return
    setIsScrollbarVisible(true)
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Set new timeout to hide scrollbar after scroll inactivity
    timeoutRef.current = setTimeout(() => {
      if (!isDragging) {
        setIsScrollbarVisible(false)
      }
    }, 1000) // Hide after 1 second of no scrolling
  }, [autoHide, isDragging])

  const hideScrollbar = React.useCallback(() => {
    if (!autoHide) return
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (!isDragging) {
      setIsScrollbarVisible(false)
    }
  }, [autoHide, isDragging])

  React.useEffect(() => {
    if (!autoHide) {
      setIsScrollbarVisible(true)
    }
  }, [autoHide])

  React.useEffect(() => {
    if (!autoHide) {
      return
    }

    const scrollArea = scrollAreaRef.current
    const viewport = viewportRef.current
    if (!scrollArea || !viewport) return

    const handleMouseDown = (e) => {
      // Check if the mousedown is on the scrollbar thumb
      const thumb = e.target.closest('[data-radix-scroll-area-thumb]')
      if (thumb) {
        setIsDragging(true)
        setIsScrollbarVisible(true)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        // Start fade out timer after drag ends
        showScrollbar()
      }
    }

    const handleMouseMove = (e) => {
      if (isDragging) {
        // Prevent text selection while dragging
        e.preventDefault()
      }
    }

    const handleScroll = () => {
      showScrollbar()
    }

    const handleMouseEnter = () => {
      // Only show on hover if not already visible or dragging
      if (!isScrollbarVisible && !isDragging) {
        setIsScrollbarVisible(true)
      }
    }

    const handleMouseLeave = () => {
      // Immediately hide when mouse leaves (unless dragging or scrolling)
      if (!isDragging) {
        hideScrollbar()
      }
    }

    // Add event listeners
    scrollArea.addEventListener('mousedown', handleMouseDown)
    scrollArea.addEventListener('mouseenter', handleMouseEnter)
    scrollArea.addEventListener('mouseleave', handleMouseLeave)
    viewport.addEventListener('scroll', handleScroll)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      scrollArea?.removeEventListener('mousedown', handleMouseDown)
      scrollArea?.removeEventListener('mouseenter', handleMouseEnter)
      scrollArea?.removeEventListener('mouseleave', handleMouseLeave)
      viewport?.removeEventListener('scroll', handleScroll)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousemove', handleMouseMove)
      
      // Clean up timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Clean up body styles
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [autoHide, isDragging, showScrollbar, hideScrollbar])

  return (
    <ScrollArea 
      ref={(node) => {
        scrollAreaRef.current = node
        let forwardedNode = node
        // Also get reference to the viewport
        if (node) {
          const viewport = node.querySelector('[data-radix-scroll-area-viewport]')
          viewportRef.current = viewport
          if (viewport) {
            forwardedNode = viewport
          }
        }
        if (ref) {
          if (typeof ref === 'function') {
            ref(forwardedNode)
          } else {
            ref.current = forwardedNode
          }
        }
      }}
      className={cn(
        "relative",
        isDragging && "select-none",
        className
      )} 
      {...props}
    >
      {children}
      <ScrollBar 
        orientation={orientation}
        className={cn(
          "transition-all duration-250 ease-out",
          autoHide
            ? isScrollbarVisible || isDragging 
              ? "opacity-100" 
              : "opacity-0 pointer-events-none"
            : "opacity-100",
          isDragging && "scale-110"
        )}
      />
    </ScrollArea>
  )
})

EnhancedScrollArea.displayName = "EnhancedScrollArea"

export { EnhancedScrollArea } 