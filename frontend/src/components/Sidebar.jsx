import React from 'react';
import { motion } from 'framer-motion';
import { 
  Home, 
  BarChart3, 
  Calendar, 
  Music, 
  Users, 
  Settings, 
  Radio, 
  PanelRight,
  Inbox as InboxIcon,
  History as HistoryIcon,
  LogIn as LogInIcon,
  UserPlus as UserPlusIcon,
  X,
  Megaphone,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { SidebarBody, SidebarLink, useSidebar } from "./ui/sidebar";
import wildcatradioLogo from "../assets/wildcatradio_logo.png";

// Navigation structure organized by sections
const navigationSections = {
  LISTENER: [
    {
      title: "MAIN",
      items: [
        {
          label: "Listen",
          href: "/dashboard",
          icon: <Music className="h-5 w-5" />,
        },
        {
          label: "Schedule",
          href: "/schedule",
          icon: <Calendar className="h-5 w-5" />,
        },
        {
          label: "Announcements",
          href: "/announcements",
          icon: <Megaphone className="h-5 w-5" />,
        },
      ]
    },
    {
      title: "PERSONAL",
      items: [
        {
          label: "Inbox",
          href: "/notifications",
          icon: <InboxIcon className="h-5 w-5" />,
        },
      ]
    }
  ],
  DJ: [
    {
      title: "MAIN",
      items: [
        {
          label: "DJ Dashboard",
          href: "/dj-dashboard",
          icon: <Radio className="h-5 w-5" />,
        },
        {
          label: "Broadcast History",
          href: "/broadcast-history",
          icon: <HistoryIcon className="h-5 w-5" />,
        },
        {
          label: "Analytics",
          href: "/analytics",
          icon: <BarChart3 className="h-5 w-5" />,
        },
        {
          label: "Schedule",
          href: "/schedule",
          icon: <Calendar className="h-5 w-5" />,
        },
        {
          label: "Announcements",
          href: "/announcements",
          icon: <Megaphone className="h-5 w-5" />,
        },
      ]
    },
    {
      title: "PERSONAL",
      items: [
        {
          label: "Inbox",
          href: "/notifications",
          icon: <InboxIcon className="h-5 w-5" />,
        },
      ]
    }
  ],
  ADMIN: [
    {
      title: "MAIN",
      items: [
        {
          label: "Admin Dashboard",
          href: "/admin",
          icon: <Users className="h-5 w-5" />,
        },
        {
          label: "Broadcast History",
          href: "/broadcast-history",
          icon: <HistoryIcon className="h-5 w-5" />,
        },
        {
          label: "Analytics",
          href: "/analytics",
          icon: <BarChart3 className="h-5 w-5" />,
        },
        {
          label: "Schedule",
          href: "/schedule",
          icon: <Calendar className="h-5 w-5" />,
        },
        {
          label: "Announcements",
          href: "/announcements",
          icon: <Megaphone className="h-5 w-5" />,
        },
      ]
    },
    {
      title: "PERSONAL",
      items: [
        {
          label: "Inbox",
          href: "/notifications",
          icon: <InboxIcon className="h-5 w-5" />,
        },
      ]
    }
  ],
  MODERATOR: [
    {
      title: "MAIN",
      items: [
        {
          label: "Mod Dashboard",
          href: "/moderator",
          icon: <Users className="h-5 w-5" />,
        },
        {
          label: "Broadcast History",
          href: "/broadcast-history",
          icon: <HistoryIcon className="h-5 w-5" />,
        },
        {
          label: "Analytics",
          href: "/analytics",
          icon: <BarChart3 className="h-5 w-5" />,
        },
        {
          label: "Schedule",
          href: "/schedule",
          icon: <Calendar className="h-5 w-5" />,
        },
        {
          label: "Listen",
          href: "/dashboard",
          icon: <Music className="h-5 w-5" />,
        },
        {
          label: "Announcements",
          href: "/announcements",
          icon: <Megaphone className="h-5 w-5" />,
        },
      ]
    },
    {
      title: "PERSONAL",
      items: [
        {
          label: "Inbox",
          href: "/notifications",
          icon: <InboxIcon className="h-5 w-5" />,
        },
      ]
    }
  ],
  PUBLIC: [
    {
      title: "MAIN",
      items: [
        {
          label: "Listen",
          href: "/dashboard",
          icon: <Music className="h-5 w-5" />,
        },
        // Schedule hidden for unauthenticated users (no account context)
        {
          label: "Announcements",
          href: "/announcements",
          icon: <Megaphone className="h-5 w-5" />,
        }
      ]
    },
    {
      title: "AUTH",
      items: [
        {
          label: "Login",
          href: "/login",
          icon: <LogInIcon className="h-5 w-5" />,
        },
        {
          label: "Register",
          href: "/register",
          icon: <UserPlusIcon className="h-5 w-5" />,
        }
      ]
    }
  ]
};

// Mobile close button component
const MobileCloseButton = () => {
  const { setOpen } = useSidebar();
  
  return (
    <div className="absolute right-4 top-4 z-50 md:hidden">
      <button
        onClick={() => setOpen(false)}
        className="text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

// Section header component
const SectionHeader = ({ title }) => {
  const { open } = useSidebar();

  return (
    <div className="mt-4 first:mt-0">
      <motion.div
        className="px-3 py-2"
        animate={{
          height: "auto",
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Text that fades out when minimizing */}
        <motion.h3
          className="text-xs font-semibold text-yellow-400 uppercase tracking-wider"
          animate={{
            opacity: open ? 1 : 0,
          }}
          transition={{ 
            duration: 0.15,
            delay: open ? 0.1 : 0 // Delay fade in when opening, immediate fade out when closing
          }}
        >
          {title}
        </motion.h3>

        {/* Separator that appears when minimized */}
        <motion.div
          className="h-1 bg-yellow-400 w-full rounded"
          animate={{
            opacity: open ? 0 : 1,
            scaleX: open ? 0 : 1,
          }}
          transition={{ 
            duration: 0.15,
            delay: open ? 0 : 0.1 // Delay appearance when minimizing, immediate hide when opening
          }}
        />
      </motion.div>
    </div>
  );
};

const NewSidebar = ({ userRole }) => {
  const { isAuthenticated, currentUser, logout } = useAuth();
  const { open, animate } = useSidebar();

  // Get the appropriate navigation sections based on authentication and role
  const getNavigationSections = () => {
    if (!isAuthenticated) {
      return navigationSections.PUBLIC;
    }

    // Use currentUser.role directly for reliability, fallback to prop
    const role = currentUser?.role || userRole;
    const roleKey = (role || 'LISTENER').toUpperCase();
    
    // Ensure role key exists in navigationSections
    return navigationSections[roleKey] || navigationSections.LISTENER;
  };

  const sections = getNavigationSections();

  return (
    <SidebarBody>
      <div className="flex flex-col h-full">
        {/* Logo section follows theme */}
        <div className="bg-card text-card-foreground border-b border-border relative">
          <MobileCloseButton />
          
          {/* Premium background effect for mobile */}
          <div className="absolute inset-0 md:hidden pointer-events-none"></div>
          
          <div className="relative flex items-center justify-center h-48 md:h-28 overflow-hidden py-4 md:py-0">
            {/* Show panel-right icon when closed with fade animation */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={false}
              animate={{
                opacity: !open ? 1 : 0,
                x: !open ? 0 : -30,
                scale: !open ? 1 : 0.8,
              }}
              transition={{ 
                duration: 0.4,
                ease: [0.25, 0.46, 0.45, 0.94],
                opacity: { 
                  duration: 0.3,
                  ease: "easeOut",
                  delay: !open ? 0.1 : 0
                },
                x: { 
                  duration: 0.4,
                  ease: [0.34, 1.26, 0.64, 1],
                  delay: !open ? 0.05 : 0
                },
                scale: { 
                  duration: 0.3,
                  ease: "easeOut",
                  delay: !open ? 0.08 : 0
                }
              }}
              style={{ 
                pointerEvents: !open ? 'auto' : 'none'
              }}
            >
              <PanelRight 
                className="w-6 h-6"
                style={{ color: '#800000' }}
              />
            </motion.div>

            {/* Show bigger logo when open with fade in from left animation */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={false}
              animate={{
                opacity: open ? 1 : 0,
                x: open ? 0 : -40,
                scale: open ? 1 : 0.7,
                rotateY: open ? 0 : -15,
              }}
              transition={{ 
                duration: 0.5,
                ease: [0.25, 0.46, 0.45, 0.94],
                opacity: { 
                  duration: 0.4,
                  ease: "easeOut",
                  delay: open ? 0.15 : 0
                },
                x: { 
                  duration: 0.5,
                  ease: [0.34, 1.26, 0.64, 1], // Smooth bounce effect
                  delay: open ? 0.1 : 0
                },
                scale: { 
                  duration: 0.4,
                  ease: "easeOut",
                  delay: open ? 0.12 : 0
                },
                rotateY: {
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                  delay: open ? 0.08 : 0
                }
              }}
              style={{ 
                transformOrigin: "center center",
                perspective: "1000px",
                pointerEvents: open ? 'auto' : 'none'
              }}
            >
              <motion.img 
                src={wildcatradioLogo} 
                alt="WildCats Radio Logo" 
                className="w-32 h-32 md:w-24 md:h-24 flex-shrink-0"
                animate={{
                  y: open ? 0 : 10,
                  filter: open ? "brightness(1)" : "brightness(0.8)"
                }}
                transition={{ 
                  duration: 0.3,
                  ease: "easeOut",
                  delay: open ? 0.2 : 0,
                  filter: {
                    duration: 0.3,
                    delay: open ? 0.15 : 0
                  }
                }}
              />
            </motion.div>
          </div>
          

        </div>

        {/* Main content area */}
        <div className="flex flex-col h-full">
          <div className={cn(
            "flex-1 mt-6 space-y-1 py-2 px-4 md:px-2",
            {
              "md:px-0": !open, // No horizontal padding when collapsed on desktop (full width highlight)
              "md:px-2": open,  // Add horizontal padding when expanded on desktop (maroon margins)
            }
          )}>
            {sections.map((section, sectionIndex) => (
              <div key={section.title}>
                <SectionHeader title={section.title} />
                <div className="space-y-1">
                  {section.items.map((link) => (
                    <SidebarLink 
                      key={link.label} 
                      link={link} 
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Spacer to push footer to bottom */}
          <div className="flex-grow"></div>

          {/* Footer */}
          <div className={cn(
            "py-2 pb-4 px-4 md:px-2",
            {
              "md:px-0": !open, // No horizontal padding when collapsed on desktop
              "md:px-2": open,  // Add horizontal padding when expanded on desktop
            }
          )}>
            {/* Expanded Footer */}
            <motion.div 
              className="border-t border-maroon-600/30"
              initial={false}
              animate={{
                opacity: open ? 1 : 0,
                y: open ? 0 : 25,
                scale: open ? 1 : 0.92,
              }}
              transition={{ 
                duration: 0.5,
                ease: [0.25, 0.46, 0.45, 0.94], // Custom cubic-bezier for smooth motion
                opacity: { 
                  duration: open ? 0.4 : 0.2,
                  ease: "easeOut",
                  delay: open ? 0.1 : 0
                },
                y: { 
                  duration: 0.5,
                  ease: [0.34, 1.56, 0.64, 1], // Slight bounce for natural feel
                  delay: open ? 0.05 : 0
                },
                scale: { 
                  duration: 0.4,
                  ease: "easeOut",
                  delay: open ? 0.08 : 0
                }
              }}
              style={{ 
                transformOrigin: "bottom center",
                display: open ? "block" : "none"
              }}
            >
              <motion.div 
                className="pt-5 pb-4 px-4"
                animate={{
                  y: open ? 0 : 15,
                  opacity: open ? 1 : 0.7,
                }}
                transition={{ 
                  duration: 0.45,
                  ease: [0.16, 1, 0.3, 1], // Smooth easing curve
                  delay: open ? 0.15 : 0,
                  opacity: {
                    duration: 0.3,
                    delay: open ? 0.2 : 0
                  }
                }}
              >
                {/* Brand Section */}
                <div className="mb-4">
                  <h4 className="text-yellow-400 font-semibold text-sm mb-1">
                    WildCats Radio
                  </h4>
                  <p className="text-white/60 text-xs">
                    © 2025 All Rights Reserved
                  </p>
                </div>

                {/* Links Section */}
                <div className="space-y-2.5 mb-4">
                  <a 
                    href="/privacy-policy" 
                    className="block text-white/70 hover:text-yellow-300 text-xs transition-colors duration-200 hover:translate-x-0.5 transform"
                  >
                    Privacy Policy
                  </a>
                  <a 
                    href="/terms-of-service" 
                    className="block text-white/70 hover:text-yellow-300 text-xs transition-colors duration-200 hover:translate-x-0.5 transform"
                  >
                    Terms of Service
                  </a>
                  <a 
                    href="/contact" 
                    className="block text-white/70 hover:text-yellow-300 text-xs transition-colors duration-200 hover:translate-x-0.5 transform"
                  >
                    Contact
                  </a>
                </div>

                {/* Simple Divider */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent mb-3"></div>

                {/* Tagline */}
                <div className="text-center">
                  <p className="text-white/50 text-xs">
                    Broadcasting Excellence
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* Minimized Footer - Version */}
            <motion.div 
              className="absolute bottom-0 left-0 right-0 flex justify-center items-center"
              initial={false}
              animate={{
                opacity: open ? 0 : 1,
                y: open ? 30 : 0,
                scale: open ? 0.75 : 1,
              }}
              transition={{ 
                duration: 0.5,
                ease: [0.25, 0.46, 0.45, 0.94], // Matching the expanded footer curve
                opacity: { 
                  duration: open ? 0.2 : 0.4,
                  ease: "easeOut",
                  delay: open ? 0 : 0.1
                },
                y: { 
                  duration: 0.5,
                  ease: [0.34, 1.26, 0.64, 1], // Subtle bounce
                  delay: open ? 0 : 0.08
                },
                scale: { 
                  duration: 0.4,
                  ease: "easeOut",
                  delay: open ? 0 : 0.12
                }
              }}
              style={{ 
                transformOrigin: "center",
                display: open ? "none" : "flex"
              }}
            >
              <motion.div
                className="bg-yellow-400 text-black w-full py-1 text-xs font-bold tracking-tight uppercase select-none shadow-sm hover:bg-yellow-300 hover:shadow-md transition-all duration-200 text-center"
                whileHover={{ 
                  scale: 1.02,
                  y: -1
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 20 
                }}
              >
                v1.0
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </SidebarBody>
  );
};

export default NewSidebar; 

// Bare-bones note: Sidebar component kept as-is for stability.
