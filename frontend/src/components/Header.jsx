import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Bell, 
  Moon, 
  Sun, 
  Menu, 
  Calendar, 
  User, 
  ChevronDown, 
  LogOut,
  Settings,
  UserRound
} from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

const Header = ({ onMobileMenuToggle }) => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const [notifications, setNotifications] = useState(3);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
      setCurrentDate(
        now.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Check if dark mode is enabled
    const isDark = document.documentElement.classList.contains("dark");
    setIsDarkMode(isDark);

    // Add event listener for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class" &&
          mutation.target === document.documentElement
        ) {
          setIsDarkMode(document.documentElement.classList.contains("dark"));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle("dark");
    setIsDarkMode(!isDarkMode);
  };

  const handleLogout = () => {
    logout();
  };

  // Get user initials
  const getInitials = (user) => {
    if (!user) return "AA";
    
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const username = user.username || "";
    const fullName = user.name || user.fullName || "";
    const email = user.email || "";
    
    // Try firstName + lastName first
    if (firstName && lastName) {
      return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }
    
    // Try to split fullName if available
    if (fullName && fullName.includes(" ")) {
      const nameParts = fullName.trim().split(" ");
      if (nameParts.length >= 2) {
        return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
      }
    }
    
    // Try firstName + first letter of username/email
    if (firstName && (username || email)) {
      const secondChar = username ? username.charAt(0) : email.charAt(0);
      return (firstName.charAt(0) + secondChar).toUpperCase();
    }
    
    // Try username if it has multiple characters
    if (username && username.length >= 2) {
      return username.substring(0, 2).toUpperCase();
    }
    
    // Try fullName if it has multiple characters
    if (fullName && fullName.length >= 2) {
      return fullName.substring(0, 2).toUpperCase();
    }
    
    // Try email prefix
    if (email && email.includes("@")) {
      const emailPrefix = email.split("@")[0];
      if (emailPrefix.length >= 2) {
        return emailPrefix.substring(0, 2).toUpperCase();
      }
    }
    
    // Fallback to single character or AA
    if (firstName) {
      return (firstName.charAt(0) + firstName.charAt(0)).toUpperCase();
    }
    if (username) {
      return (username.charAt(0) + username.charAt(0)).toUpperCase();
    }
    
    return "AA";
  };

  // Format display name
  const getDisplayName = (user) => {
    if (!user) return "User";
    
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (user.username) {
      return user.username;
    } else if (user.name) {
      return user.name;
    } else if (user.fullName) {
      return user.fullName;
    }
    
    return "User";
  };

  // Format role display
  const formatRole = (role) => {
    if (!role) return "User";
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  return (
    <header className="h-28 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center">
        {/* Mobile menu button - only visible on small screens */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuToggle}
          className="md:hidden mr-3 rounded-full h-10 w-10 text-maroon-700 dark:text-maroon-300 hover:bg-maroon-100 dark:hover:bg-maroon-800"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        <div className="relative mr-6 whitespace-nowrap">
          <img 
            src="/src/assets/cit-logo.png" 
            alt="CIT Logo" 
            className="h-20 w-auto object-contain"
          />
        </div>

        <div className="hidden lg:flex items-center text-maroon-700 dark:text-maroon-300 text-lg whitespace-nowrap bg-white/80 dark:bg-maroon-800/60 px-4 py-2 rounded-full shadow-sm border border-maroon-200 dark:border-maroon-700">
          <Calendar className="h-5 w-5 mr-2 flex-shrink-0 text-maroon-600 dark:text-maroon-400" />
          <span className="truncate font-medium">{currentDate}</span>
          <div className="mx-2 h-4 w-px bg-maroon-300 dark:bg-maroon-600 flex-shrink-0"></div>
          <span className="truncate">{currentTime}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full h-10 w-10 flex-shrink-0 text-maroon-600 dark:text-maroon-400 bg-maroon-100 dark:bg-maroon-100 hover:bg-maroon-200 dark:hover:bg-maroon-200"
        >
          <Bell className="h-5 w-5" />
          {notifications > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {notifications > 9 ? "9+" : notifications}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>

        {/* Dark/Light Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className={cn(
            "relative rounded-full h-10 w-10 flex-shrink-0 transition-all duration-300",
            isDarkMode
              ? "bg-maroon-800 hover:bg-maroon-700 text-yellow-400"
              : "bg-maroon-100 hover:bg-maroon-200 text-maroon-600",
          )}
        >
          {isDarkMode ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* User Dropdown - only show if authenticated */}
        {isAuthenticated && currentUser && (
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center gap-2 md:gap-3 pl-2 pr-3 md:pl-3 md:pr-4 rounded-full transition-all duration-300 flex-shrink-0",
                  "bg-maroon-100 dark:bg-maroon-800 hover:bg-maroon-200 dark:hover:bg-maroon-700",
                  "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-0 !outline-none !border-none"
                )}
              >
                <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-gradient-to-r from-maroon-600 to-maroon-500 flex items-center justify-center text-white shadow-md ring-2 ring-white dark:ring-gray-900 flex-shrink-0">
                  {currentUser.role?.toLowerCase() === 'dj' ? (
                    <span className="text-xs md:text-sm font-bold">DJ</span>
                  ) : currentUser.role?.toLowerCase() === 'admin' ? (
                    <UserRound className="h-4 w-4 md:h-5 md:w-5" />
                  ) : (
                    <span className="text-xs md:text-sm font-medium">
                      {getInitials(currentUser)}
                    </span>
                  )}
                </div>
                <div className="hidden md:flex flex-col items-start">
                  <span className="font-medium text-xs md:text-sm text-maroon-800 dark:text-maroon-300 whitespace-nowrap">
                    {getDisplayName(currentUser)}
                  </span>
                  <span className="text-[10px] md:text-xs text-maroon-500 dark:text-maroon-400 whitespace-nowrap">
                    {formatRole(currentUser.role)}
                  </span>
                </div>
                <div className="flex items-center">
                  <ChevronDown className="h-3 w-3 md:h-4 md:w-4 text-maroon-600 dark:text-maroon-400 ml-0 md:ml-1 flex-shrink-0" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 mt-1 rounded-xl p-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-50 shadow-lg"
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-gray-900">
                    {getDisplayName(currentUser)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {currentUser.email || "user@example.com"}
                  </p>
                  <p className="text-xs text-gray-600">
                    Role: <span className="px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">{formatRole(currentUser.role)}</span>
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-200 my-2" />
              <DropdownMenuItem
                className="cursor-pointer rounded-lg px-3 py-2 text-gray-900 transition-colors
                           hover:bg-maroon-100 hover:text-maroon-900
                           focus:bg-maroon-100 focus:text-maroon-900
                           [&:hover]:!bg-maroon-100 [&:hover]:!text-maroon-900
                           [&:focus]:!bg-maroon-100 [&:focus]:!text-maroon-900
                           [&:hover_svg]:!text-maroon-900 [&:focus_svg]:!text-maroon-900"
                onClick={() => {
                  window.location.href = '/profile';
                }}
              >
                <User className="mr-2 h-4 w-4 transition-colors group-hover:text-maroon-900" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer rounded-lg px-3 py-2 text-gray-900 transition-colors
                           hover:bg-maroon-100 hover:text-maroon-900
                           focus:bg-maroon-100 focus:text-maroon-900
                           [&:hover]:!bg-maroon-100 [&:hover]:!text-maroon-900
                           [&:focus]:!bg-maroon-100 [&:focus]:!text-maroon-900
                           [&:hover_svg]:!text-maroon-900 [&:focus_svg]:!text-maroon-900"
                onClick={() => {
                  window.location.href = '/settings';
                }}
              >
                <Settings className="mr-2 h-4 w-4 transition-colors group-hover:text-maroon-900" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-200 my-2" />
              <DropdownMenuItem
                className="cursor-pointer rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-600 focus:bg-red-100 focus:text-red-600 transition-colors
                           [&:hover]:!text-red-600 [&:focus]:!text-red-600"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};

export default Header; 