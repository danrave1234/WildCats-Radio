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
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { DesktopSidebar, SidebarLink, useSidebar } from "./ui/sidebar";

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
        },
      ]
    }
  ]
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
          className="text-xs font-semibold text-yellow-300 uppercase tracking-wider"
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
          className="h-1 bg-yellow-300 w-full rounded"
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
    
    return navigationSections[userRole] || [];
  };

  const sections = getNavigationSections();

  return (
    <DesktopSidebar>
      <div className="flex flex-col h-full">
        {/* Logo section with white background */}
        <div className="bg-white border-b border-gray-200">
          <div className="relative flex items-center justify-center h-28">
            {/* Show panel-right icon when closed, bigger logo when open */}
            {!open ? (
              <PanelRight 
                className="w-6 h-6"
                style={{ color: '#800000' }}
              />
            ) : (
              <img 
                src="/src/assets/wildcatradio_logo.png" 
                alt="WildCats Radio Logo" 
                className="w-24 h-24 flex-shrink-0"
              />
            )}
          </div>
        </div>
        
        {/* Main content area */}
        <div className="flex flex-col h-full p-2">
          <div className="flex-1 mt-6 space-y-1">
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
        </div>
      </div>
    </DesktopSidebar>
  );
};

export default NewSidebar; 