"use client";;
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";
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

  // Use controlled props if provided, otherwise use internal state
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = onOpenChangeProp !== undefined ? onOpenChangeProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
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
      <MobileSidebar {...(props)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}) => {
  const { open, setOpen, animate } = useSidebar();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // Mark as initialized after first render to prevent immediate hover effects
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 500); // Longer delay to ensure all animations are complete
    
    return () => clearTimeout(timer);
  }, []);

  // Additional check for page load completion  
  useEffect(() => {
    const loadTimer = setTimeout(() => {
      setHasLoaded(true);
    }, 100); // Reduce delay for smoother experience while still preventing initial flash
    
    return () => clearTimeout(loadTimer);
  }, []);
  
  return (
    <motion.div
      className={cn(
        "h-screen hidden md:flex md:flex-col flex-shrink-0 sticky top-0 border-r border-gray-200 bg-maroon-700",
        !hasLoaded && "sidebar-loading sidebar-initial-load", // Add loading classes during initial load
        className
      )}
      style={{
        width: hasLoaded ? undefined : "60px" // Force initial width to 60px until fully loaded
      }}
      animate={{
        width: animate ? (open ? "300px" : "60px") : "60px", // Default to 60px instead of 300px
      }}
      onMouseEnter={() => {
        // Only allow hover expansion after full initialization and load
        if (isInitialized && hasLoaded) {
          setOpen(true);
        }
      }}
      onMouseLeave={(e) => {
        // Only allow hover collapse after full initialization and load
        if (!isInitialized || !hasLoaded) return;
        
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
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between w-full bg-maroon-700"
        )}
        {...props}>
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-white cursor-pointer"
            onClick={() => setOpen(!open)} />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 p-10 z-[100] flex flex-col justify-between bg-maroon-700",
                className
              )}>
              <div
                className="absolute right-10 top-10 z-50 text-white cursor-pointer"
                onClick={() => setOpen(!open)}>
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}) => {
  const { open, animate } = useSidebar();
  const [isReady, setIsReady] = useState(false);
  
  // Prevent any text visibility during initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100); // Sync with sidebar loading timing
    
    return () => clearTimeout(timer);
  }, []);
  return (
    <NavLink
      to={link.href}
      className={({ isActive }) => cn(
        "relative flex items-center rounded-lg h-12 group",
        className,
        {
          "text-yellow-400 font-bold": isActive,
          "text-white hover:bg-white/10": !isActive,
        }
      )}
      {...props}>
      {({ isActive }) => (
        <>
          {/* Left decorative line for active state when expanded */}
          <motion.div
            animate={{
              opacity: isActive && open ? 1 : 0,
              scaleY: isActive && open ? 1 : 0,
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="absolute left-0 w-1 h-8 bg-gradient-to-b from-yellow-300 to-yellow-500 rounded-r-full"
          />
          
          {/* Main content area with enhanced styling for active state */}
          <div className={cn(
            "relative flex items-center w-full h-full rounded-lg",
            {
              "border-2 border-yellow-400 bg-gradient-to-r from-yellow-400/10 to-transparent": isActive,
            }
          )}>
            <div className="absolute left-2 w-6 h-6 flex items-center justify-center">
              {link.icon}
            </div>
            
            <motion.span
              animate={{
                opacity: (open && isReady) ? 1 : 0,
                x: (open && isReady) ? 0 : -10
              }}
              transition={{ duration: isReady ? 0.2 : 0 }}
              className={cn(
                "font-medium whitespace-pre ml-12 pl-3 relative sidebar-text",
                !isReady && "opacity-0"
              )}
              style={{ 
                visibility: isReady ? 'visible' : 'hidden' // Force hide until ready
              }}>
              {link.label}
              
              {/* Hover underline for non-active items */}
              {!isActive && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400 origin-center"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ 
                    duration: 0.3, 
                    ease: "easeInOut" 
                  }}
                />
              )}
            </motion.span>
            
            {/* Right decorative accent when expanded and active */}
            <motion.div
              animate={{
                opacity: isActive && open ? 1 : 0,
                x: isActive && open ? 0 : 10
              }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="absolute right-3 w-2 h-2 bg-yellow-400 rounded-full"
            />
          </div>
          
          {/* Top and bottom accent lines when expanded and active */}
          <motion.div
            animate={{
              opacity: isActive && open ? 0.6 : 0,
              scaleX: isActive && open ? 1 : 0,
            }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute top-0 left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent"
          />
          
          <motion.div
            animate={{
              opacity: isActive && open ? 0.6 : 0,
              scaleX: isActive && open ? 1 : 0,
            }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeInOut" }}
            className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent"
          />
        </>
      )}
    </NavLink>
  );
};
