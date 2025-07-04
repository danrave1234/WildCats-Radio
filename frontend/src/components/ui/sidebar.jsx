"use client";;
import { cn } from "@/lib/utils";
import { NavLink, useLocation } from "react-router-dom";
import React, { useState, createContext, useContext, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

const SidebarContext = createContext(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  animate = true
}) => {
  // Internal state for uncontrolled usage - respects defaultOpen but defaults to false
  const [openState, setOpenState] = useState(defaultOpen);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const location = useLocation();

  // Use controlled props if provided, otherwise use internal state
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = onOpenChangeProp !== undefined ? onOpenChangeProp : setOpenState;

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    const isMobile = () => window.innerWidth < 768; // md breakpoint
    
    if (isMobile() && open && !isTransitioning) {
      setIsTransitioning(true);
      // Use a small delay to prevent rapid state changes
      const timeoutId = setTimeout(() => {
        setOpen(false);
        setIsTransitioning(false);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        setIsTransitioning(false);
      };
    }
  }, [location.pathname]); // Remove open and setOpen from dependencies to prevent loops

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate, isTransitioning }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  onOpenChange,
  animate
}) => {
  return (
    <SidebarProvider open={open} onOpenChange={onOpenChange} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileOverlaySidebar {...(props)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}) => {
  const { open, setOpen, animate } = useSidebar();
  
  return (
    <motion.div
      className={cn(
        "h-screen hidden md:flex md:flex-col flex-shrink-0 sticky top-0 border-r border-gray-200 relative overflow-hidden",
        "bg-gradient-to-br from-wildcats-maroon via-red-800 to-red-900 backdrop-blur-xl",
        className
      )}
      animate={{
        width: animate ? (open ? "240px" : "44px") : "44px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(e) => {
        // Check if we're moving to a dropdown menu or if dropdown is open
        const dropdownElement = document.querySelector('[data-radix-popper-content-wrapper]');
        const dropdownTrigger = document.querySelector('[data-radix-dropdown-menu-trigger]');
        
        if (dropdownElement && (dropdownElement.contains(e.relatedTarget) || e.relatedTarget === dropdownElement)) {
          return; // Don't close sidebar if moving to dropdown content
        }
        
        if (dropdownTrigger && dropdownTrigger.getAttribute('data-state') === 'open') {
          return; // Don't close sidebar if dropdown is open
        }
        
        setOpen(false);
      }}
      {...props}>
      {/* Premium gradient overlays to match header */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/10 pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-red-700/20 via-transparent to-red-900/30 pointer-events-none"></div>
      
      {/* Content with relative positioning */}
      <div className="relative z-10 h-full">
        {children}
      </div>
    </motion.div>
  );
};

export const MobileOverlaySidebar = ({
  className,
  children,
  ...props
}) => {
  const { open, setOpen } = useSidebar();
  
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop overlay with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm supports-[backdrop-filter]:bg-black/30 z-40 md:hidden"
            onClick={() => setOpen(false)}
          />
          
          {/* Mobile sidebar overlay */}
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
            }}
            className={cn(
              "fixed left-0 top-0 h-full w-80 max-w-[85vw] z-50 md:hidden flex flex-col relative overflow-hidden",
              "bg-gradient-to-br from-wildcats-maroon via-red-800 to-red-900",
              className
            )}
            {...props}
          >
            {/* Premium gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/10 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-red-700/20 via-transparent to-red-900/30 pointer-events-none"></div>
            

            
            {/* Content with relative positioning and proper padding */}
            <div className="relative z-10 h-full flex flex-col">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}) => {
  const { open, animate } = useSidebar();
  
  return (
    <motion.div
      whileHover={{ 
        scale: 1.01,
        y: -1,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
        duration: 0.15
      }}
    >
    <NavLink
      to={link.href}
      className={({ isActive }) => cn(
        "relative flex items-center h-12 group",
        className,
        {
            "text-maroon-600 font-bold": isActive && open,
            "bg-white": isActive, // Show white background when active (both collapsed and expanded)
          "text-white hover:bg-white/10": !isActive,
        }
      )}
      {...props}>
      {({ isActive }) => (
        <>

          
          {/* Main content area with enhanced styling for active state */}
          <div className={cn(
            "relative flex items-center w-full h-full"
          )}>
            <div className={cn(
              "absolute left-2.5 w-6 h-6 flex items-center justify-center",
              {
                // When active: maroon text
                "text-maroon-600": isActive,
                // When not active: white text
                "text-white": !isActive,
              }
            )}>
              {link.icon}
            </div>
            
            <motion.span
              animate={{
                opacity: open ? 1 : 0,
                x: open ? 0 : -5
              }}
              transition={{ 
                duration: 0.15,
                ease: "easeOut"
              }}
              className="font-medium whitespace-pre ml-12 pl-3 relative">
              {link.label}
              
              {/* Active underline with grow animation - only when expanded */}
              <AnimatePresence>
                {isActive && open && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-maroon-600 shadow-sm"
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ 
                      scaleX: 1, 
                      opacity: 1,
                    }}
                    exit={{ 
                      scaleX: 0, 
                      opacity: 0,
                    }}
                    transition={{ 
                      duration: 0.2, 
                      ease: "easeOut"
                    }}
                    style={{
                      transformOrigin: "left"
                    }}
                  />
                )}
              </AnimatePresence>
              
              {/* Hover underline for non-active items - only when expanded */}
              {!isActive && open && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/60"
                  initial={{ scaleX: 0 }}
                  whileHover={{ 
                    scaleX: 1,
                    opacity: 1
                  }}
                  transition={{ 
                    duration: 0.15, 
                    ease: "easeOut"
                  }}
                  style={{
                    transformOrigin: "left"
                  }}
                />
              )}
            </motion.span>
            
            {/* Right decorative accent when expanded and active */}
            <motion.div
              animate={{
                opacity: isActive && open ? 1 : 0,
                x: isActive && open ? 0 : 5
              }}
              transition={{ 
                duration: 0.15, 
                ease: "easeOut"
              }}
              className="absolute right-3 w-2 h-2 bg-maroon-600 rounded-full"
            />
          </div>
          

        </>
      )}
    </NavLink>
    </motion.div>
  );
};
