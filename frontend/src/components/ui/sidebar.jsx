"use client";;
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";
import React, { useState, createContext, useContext } from "react";
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
  
  return (
    <motion.div
      className={cn(
        "h-screen hidden md:flex md:flex-col flex-shrink-0 sticky top-0 border-r border-gray-200 bg-maroon-700",
        className
      )}
      animate={{
        width: animate ? (open ? "240px" : "48px") : "48px",
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
  
  return (
    <motion.div
      whileHover={{ 
        scale: 1.02,
        y: -2,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 17
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
                x: open ? 0 : -10
              }}
              transition={{ duration: 0.2 }}
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
                      duration: 0.4, 
                      ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for smooth animation
                      opacity: { duration: 0.2 }
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
                    duration: 0.25, 
                    ease: [0.25, 0.46, 0.45, 0.94]
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
                x: isActive && open ? 0 : 10
              }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="absolute right-3 w-2 h-2 bg-maroon-600 rounded-full"
            />
          </div>
          

        </>
      )}
      </NavLink>
    </motion.div>
  );
};
