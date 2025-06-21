import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Bell, 
  Menu, 
  Calendar, 
  User, 
  ChevronDown, 
  LogOut,
  Settings,
  UserRound,
  AlertTriangle
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

const Header = ({ onMobileMenuToggle }) => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

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



  const handleLogoutClick = () => {
    setIsDropdownOpen(false);
    setIsLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = () => {
    setIsLogoutDialogOpen(false);
    logout();
  };

  const handleLogoutCancel = () => {
    setIsLogoutDialogOpen(false);
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
    <header className="h-20 sm:h-24 md:h-28 border-b border-gray-200 bg-white/95 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6 md:px-8 sticky top-0 z-10 transition-all duration-300">
      <div className="flex items-center flex-1 min-w-0">
        {/* Mobile menu button - only visible on small screens */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuToggle}
          className="md:hidden mr-3 sm:mr-4 rounded-lg h-10 w-10 text-maroon-700 hover:bg-maroon-50 transition-colors flex-shrink-0"
        >
          <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* Modern Date & Time Display */}
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex items-center space-x-4 sm:space-x-6">
            {/* Date Section */}
            <div className="flex flex-col">
              <span className="text-sm sm:text-base text-gray-500 font-medium uppercase tracking-wide">
                Today
              </span>
              <span className="text-xl sm:text-2xl md:text-3xl font-bold text-maroon-800 tracking-tight leading-none">
                {currentDate}
              </span>
            </div>
            
            {/* Separator */}
            <div className="h-12 sm:h-14 w-px bg-gray-300"></div>
            
            {/* Time Section */}
            <div className="flex flex-col">
              <span className="text-sm sm:text-base text-gray-500 font-medium uppercase tracking-wide">
                Current Time
              </span>
              <span className="text-xl sm:text-2xl md:text-3xl font-bold text-maroon-700 font-mono tracking-tight leading-none">
                {currentTime}
              </span>
            </div>
            

          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 bg-maroon-800 px-6 py-4 rounded-2xl relative mr-4 sm:mr-6">
        {/* Yellow accent line */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-1 bg-yellow-400 rounded-full"></div>
        {/* Yellow accent dot on right side */}
        <div className="absolute right-2 top-2 w-2 h-2 bg-yellow-400 rounded-full"></div>
        {/* Notifications */}
        <div className="flex-shrink-0">
          <NotificationBell />
        </div>



        {/* User Dropdown - only show if authenticated */}
        {isAuthenticated && currentUser && (
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-xl transition-all duration-300 flex-shrink-0",
                  "bg-white/95 hover:bg-white shadow-sm border border-white/20",
                  "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                  "hover:scale-105 hover:-translate-y-1 hover:shadow-lg",
                  isDropdownOpen && "scale-105 -translate-y-1 shadow-lg"
                )}
              >
                <div className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10 rounded-full bg-maroon-600 flex items-center justify-center text-white shadow-sm border-2 border-white flex-shrink-0">
                  {currentUser.role?.toLowerCase() === 'dj' ? (
                    <span className="text-[10px] sm:text-xs md:text-sm font-bold">DJ</span>
                  ) : currentUser.role?.toLowerCase() === 'admin' ? (
                    <UserRound className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                  ) : (
                    <span className="text-[10px] sm:text-xs md:text-sm font-medium">
                      {getInitials(currentUser)}
                    </span>
                  )}
                </div>
                <div className="hidden sm:hidden md:flex flex-col items-start min-w-0 max-w-[120px] lg:max-w-none">
                  <span className="font-medium text-xs lg:text-sm text-maroon-800 truncate w-full">
                    {getDisplayName(currentUser)}
                  </span>
                  <span className="text-[10px] lg:text-xs text-maroon-500 truncate w-full">
                    {formatRole(currentUser.role)}
                  </span>
                </div>
                <div className="flex items-center flex-shrink-0">
                  <ChevronDown className="h-3 w-3 sm:h-3 sm:w-3 md:h-4 md:w-4 text-maroon-600 flex-shrink-0" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 sm:w-52 md:w-56 mt-1 p-2 border border-gray-200 bg-gray-50 shadow-lg !rounded-none"
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                    {getDisplayName(currentUser)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-600 truncate">
                    {currentUser.email || "user@example.com"}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-600">
                    Role: <span className="px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs bg-yellow-100 text-yellow-800">{formatRole(currentUser.role)}</span>
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-200 my-2" />
              <DropdownMenuItem
                className="cursor-pointer px-3 py-2 text-gray-900 transition-colors !rounded-none
                           hover:bg-yellow-100 hover:text-yellow-800
                           focus:bg-yellow-100 focus:text-yellow-800
                           [&:hover]:!bg-yellow-100 [&:hover]:!text-yellow-800
                           [&:focus]:!bg-yellow-100 [&:focus]:!text-yellow-800
                           [&:hover_svg]:!text-yellow-800 [&:focus_svg]:!text-yellow-800"
                onClick={() => {
                  window.location.href = '/profile';
                }}
              >
                <User className="mr-2 h-4 w-4 transition-colors group-hover:text-maroon-900" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer px-3 py-2 text-gray-900 transition-colors !rounded-none
                           hover:bg-yellow-100 hover:text-yellow-800
                           focus:bg-yellow-100 focus:text-yellow-800
                           [&:hover]:!bg-yellow-100 [&:hover]:!text-yellow-800
                           [&:focus]:!bg-yellow-100 [&:focus]:!text-yellow-800
                           [&:hover_svg]:!text-yellow-800 [&:focus_svg]:!text-yellow-800"
                onClick={() => {
                  window.location.href = '/settings';
                }}
              >
                <Settings className="mr-2 h-4 w-4 transition-colors group-hover:text-maroon-900" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-200 my-2" />
              <DropdownMenuItem
                className="cursor-pointer px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-600 focus:bg-red-100 focus:text-red-600 transition-colors !rounded-none
                           [&:hover]:!text-red-600 [&:focus]:!text-red-600"
                onClick={handleLogoutClick}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <AlertDialogContent className="max-w-md border-maroon-200 bg-white">
          <AlertDialogHeader className="space-y-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-maroon-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-maroon-600" />
            </div>
            <AlertDialogTitle className="text-xl font-semibold text-gray-900 text-center">
              Confirm Logout
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-center">
              Are you sure you want to logout? You will be redirected to the login page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel 
              onClick={handleLogoutCancel}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-800 border-0 outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 transition-colors"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogoutConfirm}
              className="flex-1 bg-maroon-600 hover:bg-maroon-700 text-white border-maroon-600 hover:border-maroon-700 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
};

export default Header; 