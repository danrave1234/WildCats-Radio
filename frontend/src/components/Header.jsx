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
  AlertTriangle,
  Sparkles
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
import { useStreaming } from "../context/StreamingContext";

const Header = ({ onMobileMenuToggle }) => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { isLive } = useStreaming();
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
    
    const firstName = user.firstName || user.firstname || "";
    const lastName = user.lastName || user.lastname || "";
    const username = user.username || "";
    const fullName = user.name || user.fullName || "";
    const email = user.email || "";
    
    // Priority 1: firstName + lastName initials
    if (firstName && lastName) {
      return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }
    
    // Priority 2: Split fullName if it contains spaces
    if (fullName && fullName.includes(" ")) {
      const nameParts = fullName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
      }
    }
    
    // Priority 3: firstName + first letter of lastName (if lastName is missing but firstName exists)
    if (firstName && (username || email)) {
      const secondChar = username ? username.charAt(0) : email.charAt(0);
      return (firstName.charAt(0) + secondChar).toUpperCase();
    }
    
    // Priority 4: lastName + first letter of username/email (if firstName is missing)
    if (lastName && (username || email)) {
      const secondChar = username ? username.charAt(0) : email.charAt(0);
      return (lastName.charAt(0) + secondChar).toUpperCase();
    }
    
    // Priority 5: Use username if it has multiple characters
    if (username && username.length >= 2) {
      return username.substring(0, 2).toUpperCase();
    }
    
    // Priority 6: Use fullName if it has multiple characters
    if (fullName && fullName.length >= 2) {
      return fullName.substring(0, 2).toUpperCase();
    }
    
    // Priority 7: Use email prefix
    if (email && email.includes("@")) {
      const emailPrefix = email.split("@")[0];
      if (emailPrefix.length >= 2) {
        return emailPrefix.substring(0, 2).toUpperCase();
      }
    }
    
    // Fallback to single character repeated or AA
    if (firstName) {
      return (firstName.charAt(0) + firstName.charAt(0)).toUpperCase();
    }
    if (lastName) {
      return (lastName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }
    if (username) {
      return (username.charAt(0) + username.charAt(0)).toUpperCase();
    }
    
    return "AA";
  };

  // Format display name
  const getDisplayName = (user) => {
    if (!user) return "User";
    
    const firstName = user.firstName || user.firstname || "";
    const lastName = user.lastName || user.lastname || "";
    const username = user.username || "";
    const fullName = user.name || user.fullName || "";
    
    // Priority 1: firstName + lastName combination
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    
    // Priority 2: Use fullName if it exists and contains spaces
    if (fullName && fullName.includes(" ")) {
      return fullName;
    }
    
    // Priority 3: Use firstName only
    if (firstName) {
      return firstName;
    }
    
    // Priority 4: Use lastName only
    if (lastName) {
      return lastName;
    }
    
    // Priority 5: Use fullName (single word)
    if (fullName) {
      return fullName;
    }
    
    // Priority 6: Use username
    if (username) {
      return username;
    }
    
    // Fallback
    return "User";
  };

  // Format role display
  const formatRole = (role) => {
    if (!role) return "User";
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative bg-white border-b border-slate-200/40 shadow-sm overflow-hidden"
    >

      
              <div className="relative w-full z-10">
          <div className="flex items-center h-16">
          {/* Left Section - Mobile Menu Button + Desktop Time Display */}
          <div className="flex-1 flex items-center space-x-4 px-2 sm:px-4 lg:px-6 py-3 h-full">
            {/* Mobile Sidebar Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="sm:hidden p-2 rounded-xl hover:bg-white/10 text-white transition-all duration-300 hover:scale-105 active:scale-95"
              onClick={onMobileMenuToggle}
            >
              <Menu className="h-5 w-5" />
            </Button>

                        {/* Desktop Time Display */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="hidden sm:flex items-center space-x-4"
            >


              {/* Time & Date */}
              <div className="flex flex-col">
                <span className="text-base font-medium text-slate-600 leading-tight">
                  {currentDate}
                </span>
                <motion.span 
                  className="text-2xl font-bold text-slate-900 tabular-nums leading-tight"
                  key={currentTime}
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentTime}
                </motion.span>
              </div>
            </motion.div>
          </div>

          {/* Right Section - Notifications + User Menu */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Ultra Premium Maroon Background Container */}
            <div className="w-96 bg-wildcats-maroon sm:bg-gradient-to-br sm:from-wildcats-maroon sm:via-red-800 sm:to-red-900 px-4 py-3 flex items-center justify-center space-x-4 h-16 relative shadow-2xl shadow-wildcats-maroon/30 overflow-hidden">
              {/* Luxury animated accent line - desktop only */}
              <motion.div 
                className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-b from-wildcats-yellow via-yellow-400 to-amber-400 shadow-xl shadow-yellow-400/40 sm:block hidden"
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: 0.6, duration: 1, ease: "easeOut" }}
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white/10"
                  animate={{ 
                    opacity: [0.3, 0.7, 0.3]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                ></motion.div>
              </motion.div>
              
              {/* Premium inner effects - desktop only */}
              <div className="absolute inset-0 sm:bg-gradient-to-r sm:from-white/10 sm:via-transparent sm:to-white/5 pointer-events-none"></div>
              <div className="absolute inset-0 sm:bg-gradient-to-b sm:from-red-700/20 sm:via-transparent sm:to-red-900/30 pointer-events-none"></div>
              
              {/* Floating particles effect - desktop only */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-white/20 rounded-full hidden sm:block"
                  animate={{
                    x: [0, Math.random() * 100 - 50],
                    y: [0, Math.random() * 60 - 30],
                    opacity: [0, 0.6, 0],
                    scale: [0, 1, 0]
                  }}
                  transition={{
                    duration: 4 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                    ease: "easeInOut"
                  }}
                  style={{
                    left: `${20 + Math.random() * 60}%`,
                    top: `${20 + Math.random() * 60}%`,
                  }}
                />
              ))}
              
              {/* Notifications with enhanced styling */}
              <motion.div 
                className="relative z-20"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <NotificationBell />
              </motion.div>

              {/* User Dropdown - only show if authenticated */}
              {isAuthenticated && currentUser && (
                <motion.div 
                  className="relative z-20"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "transition-all duration-500",
                          // Desktop styling - full button with text and arrow
                          "sm:flex sm:items-center sm:space-x-3 sm:px-5 sm:py-3",
                          "sm:bg-gradient-to-br sm:from-white/95 sm:via-white sm:to-slate-50/90 sm:backdrop-blur-xl sm:text-wildcats-maroon",
                          "sm:hover:from-white sm:hover:via-white sm:hover:to-white sm:hover:shadow-2xl sm:hover:shadow-black/20",
                          "sm:border sm:border-white/40 sm:shadow-xl sm:shadow-black/10 sm:rounded-2xl",
                          // Mobile styling - just avatar circle
                          "flex items-center justify-center p-0 bg-transparent border-none shadow-none rounded-full",
                          "hover:bg-white/10",
                          "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                          "hover:scale-[1.05] active:scale-[0.95]",
                          "relative overflow-hidden group",
                          isDropdownOpen && "scale-[1.05] sm:scale-[1.03] sm:from-white sm:via-white sm:to-white sm:border-white/60 sm:shadow-2xl sm:shadow-black/15"
                        )}
                      >
                        <div className="h-9 w-9 rounded-full sm:bg-gradient-to-br sm:from-wildcats-maroon sm:via-wildcats-maroon sm:to-red-900 bg-white flex items-center justify-center sm:text-white text-wildcats-maroon shadow-sm sm:ring-2 sm:ring-white/20">
                          {currentUser.role?.toLowerCase() === 'admin' || currentUser.role?.toLowerCase() === 'dj' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <span className="text-xs font-bold tracking-wide">
                              {getInitials(currentUser)}
                            </span>
                          )}
                        </div>
                        <div className="hidden sm:flex flex-col items-start text-left min-w-0 ml-3">
                          <span className="font-semibold text-sm text-slate-900 leading-tight truncate max-w-[120px]">
                            {getDisplayName(currentUser)}
                          </span>
                          <span className="text-xs text-slate-500 leading-tight mt-0.5 font-medium">
                            {formatRole(currentUser.role)}
                          </span>
                        </div>
                        <ChevronDown className={cn(
                          "hidden sm:block h-4 w-4 text-slate-400 transition-all duration-300 ease-out flex-shrink-0 ml-3",
                          isDropdownOpen && "rotate-180 text-slate-600"
                        )} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={13}
                      className="w-72 p-0 border border-slate-200/60 bg-white shadow-xl backdrop-blur-xl !rounded-none overflow-hidden"
                    >
                      {/* User Profile Header */}
                      <div className="px-4 py-4 bg-gradient-to-br from-slate-50 to-slate-100/50 border-b border-slate-100">
                        <div className="flex items-center space-x-3">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-wildcats-maroon via-wildcats-maroon to-red-900 flex items-center justify-center text-white shadow-lg ring-2 ring-white/30">
                            {currentUser.role?.toLowerCase() === 'admin' || currentUser.role?.toLowerCase() === 'dj' ? (
                              <User className="h-5 w-5" />
                            ) : (
                              <span className="text-sm font-bold tracking-wide">
                                {getInitials(currentUser)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-slate-900 truncate leading-tight">
                              {getDisplayName(currentUser)}
                            </h3>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {currentUser.email || "user@example.com"}
                            </p>
                            <div className="mt-1.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-wildcats-yellow/20 text-amber-700 border border-wildcats-yellow/30">
                                {formatRole(currentUser.role)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="p-2">
                        <DropdownMenuItem
                          className="flex items-center space-x-3 px-3 py-3 cursor-pointer transition-all duration-200 !rounded-none group
                                     hover:bg-slate-50 focus:bg-slate-50
                                     [&:hover]:!bg-slate-50 [&:focus]:!bg-slate-50"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            window.location.href = '/profile';
                          }}
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                            <User className="h-4 w-4 text-slate-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">Profile</p>
                            <p className="text-xs text-slate-500">Manage your account</p>
                          </div>
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem 
                          className="flex items-center space-x-3 px-3 py-3 cursor-pointer transition-all duration-200 !rounded-none group
                                     hover:bg-slate-50 focus:bg-slate-50
                                     [&:hover]:!bg-slate-50 [&:focus]:!bg-slate-50"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            window.location.href = '/settings';
                          }}
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                            <Settings className="h-4 w-4 text-slate-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">Settings</p>
                            <p className="text-xs text-slate-500">Preferences & privacy</p>
                          </div>
                        </DropdownMenuItem>
                      </div>

                      {/* Logout Section */}
                      <div className="border-t border-slate-100 p-2">
                        <DropdownMenuItem
                          className="flex items-center space-x-3 px-3 py-3 cursor-pointer transition-all duration-200 !rounded-none group
                                     hover:bg-red-50 focus:bg-red-50
                                     [&:hover]:!bg-red-50 [&:focus]:!bg-red-50"
                          onClick={handleLogoutClick}
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                            <LogOut className="h-4 w-4 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-700">Logout</p>
                            <p className="text-xs text-red-500">Sign out of your account</p>
                          </div>
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out of your account. You will need to sign in again to access your dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleLogoutCancel} className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogoutConfirm}
              className="bg-wildcats-maroon hover:bg-red-800 text-white rounded-none"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.nav>
  );
};

export default Header; 