import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
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
  Sparkles,
  UserPlus,
  LogIn,
  Moon,
  Sun
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
import { useTheme } from "../context/ThemeContext.jsx";

const Header = ({ onMobileMenuToggle }) => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { isLive, recovering, healthBroadcastLive, healthy } = useStreaming();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [showRecovering, setShowRecovering] = useState(false);
  const [recoveringTimer, setRecoveringTimer] = useState(null);

  // Debounce the recovering banner so it only shows if recovery lasts > 4s
  useEffect(() => {
    try {
      if (recovering) {
        if (!recoveringTimer) {
          const t = setTimeout(() => setShowRecovering(true), 4000);
          setRecoveringTimer(t);
        }
      } else {
        setShowRecovering(false);
        if (recoveringTimer) {
          clearTimeout(recoveringTimer);
          setRecoveringTimer(null);
        }
      }
    } catch (_) { /* no-op */ }
    return () => {
      if (recoveringTimer) {
        clearTimeout(recoveringTimer);
      }
    };
  }, [recovering]);

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
      className="relative bg-card text-card-foreground border-b border-border overflow-hidden"
    >
      {/* Theme-friendly overlays */}
      <div className="absolute inset-0 pointer-events-none"></div>

      {/* Floating orbs for premium effect - desktop only */}
      <motion.div 
        className="absolute -top-20 -left-20 w-40 h-40 bg-gradient-to-br from-wildcats-yellow/20 to-amber-300/10 rounded-full blur-3xl hidden sm:block"
        animate={{ 
          x: [0, 30, 0],
          y: [0, -20, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          duration: 20,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut"
        }}
      ></motion.div>

      <motion.div 
        className="absolute -top-16 -right-16 w-32 h-32 bg-gradient-to-br from-wildcats-maroon/15 to-red-400/10 rounded-full blur-2xl hidden sm:block"
        animate={{ 
          x: [0, -25, 0],
          y: [0, 15, 0],
          scale: [1, 0.9, 1]
        }}
        transition={{ 
          duration: 15,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
          delay: 2
        }}
      ></motion.div>

              {/* Temporarily disabled "Reconnecting to stream..." banner
                  TODO: Investigate why this shows even when Liquidsoap/Icecast are running properly
                  The banner appears when recovering=true && healthBroadcastLive=true && healthy=false
                  but the health monitoring may be too sensitive or have timing issues
                  Re-enable once the health check logic is refined for BUTT workflow
              */}
              {false && showRecovering && healthBroadcastLive && !healthy && (
                <div className="w-full bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-sm py-2 px-4 flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                    <span>Reconnecting to stream…</span>
                  </div>
                </div>
              )}
              <div className="relative w-full z-10">
          <div className="flex items-center justify-between h-16">
          {/* Left Section - Mobile Menu Button + Desktop Time Display */}
          <div className="flex items-center space-x-4 px-2 sm:px-4 lg:px-6 py-3 h-full">
            {/* Mobile Sidebar Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="sm:hidden p-2 rounded-xl hover:bg-muted text-foreground transition-all duration-300 hover:scale-105 active:scale-95"
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
              {/* Live Indicator */}
              <div className="flex items-center space-x-3">
                <motion.div 
                  className="relative w-3 h-3"
                  animate={isLive ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className={`absolute inset-0 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                  {isLive && (
                    <motion.div 
                      className="absolute inset-0 bg-emerald-400 rounded-full"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    ></motion.div>
                  )}
                </motion.div>
                <span className={`text-sm font-semibold uppercase tracking-wider ${isLive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {isLive ? 'Live' : 'Not Live'}
                </span>
              </div>

              {/* Separator */}
              <div className="w-px h-8 bg-border"></div>

              {/* Time & Date */}
              <div className="flex flex-col">
                <span className="text-base font-medium text-muted-foreground leading-tight">
                  {currentDate}
                </span>
                <motion.span 
                  className="text-2xl font-bold text-foreground tabular-nums leading-tight"
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
            className="relative ml-auto"
          >
            {/* Ultra Premium Maroon Background Container */}
            <div className="bg-transparent px-4 py-3 flex items-center justify-end space-x-4 h-16 relative overflow-hidden">
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

              {/* Theme-friendly inner effects */}
              <div className="absolute inset-0 pointer-events-none"></div>

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

              {/* Theme toggle */}
              <motion.div
                className="relative z-20"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button
                  variant="ghost"
                  className={cn(
                    "transition-colors duration-200",
                    "flex items-center p-2 rounded-md",
                    "bg-transparent text-foreground",
                    "hover:bg-muted"
                  )}
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </motion.div>

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
                          "sm:flex sm:items-center sm:space-x-3 sm:px-5 sm:py-3",
                          "sm:bg-muted sm:text-foreground",
                          "sm:hover:bg-muted/70",
                          "sm:border sm:border-border sm:rounded-2xl",
                          "flex items-center justify-center p-0 bg-transparent border-none shadow-none rounded-full",
                          "hover:bg-muted",
                          "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                          "hover:scale-[1.05] active:scale-[0.95]",
                          "relative overflow-hidden group",
                          isDropdownOpen && "sm:ring-1 sm:ring-border"
                        )}
                      >
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-foreground shadow-sm">
                          {currentUser.role?.toLowerCase() === 'admin' || currentUser.role?.toLowerCase() === 'dj' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <span className="text-xs font-bold tracking-wide">
                              {getInitials(currentUser)}
                            </span>
                          )}
                        </div>
                        <div className="hidden sm:flex flex-col items-start text-left min-w-0 ml-3">
                          <span className="font-semibold text-sm text-foreground leading-tight truncate max-w-[120px]">
                            {getDisplayName(currentUser)}
                          </span>
                          <span className="text-xs text-muted-foreground leading-tight mt-0.5 font-medium">
                            {formatRole(currentUser.role)}
                          </span>
                        </div>
                        <ChevronDown className={cn(
                          "hidden sm:block h-4 w-4 text-muted-foreground transition-all duration-300 ease-out flex-shrink-0 ml-3",
                          isDropdownOpen && "rotate-180 text-foreground"
                        )} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={13}
                      className="w-72 p-0 border border-border bg-card text-card-foreground shadow-xl backdrop-blur-xl !rounded-none overflow-hidden"
                    >
                      {/* User Profile Header */}
                      <div className="px-4 py-4 bg-muted border-b border-border">
                        <div className="flex items-center space-x-3">
                          <div className="h-12 w-12 rounded-full bg-wildcats-maroon text-white flex items-center justify-center shadow-lg">
                            {currentUser.role?.toLowerCase() === 'admin' || currentUser.role?.toLowerCase() === 'dj' ? (
                              <User className="h-5 w-5" />
                            ) : (
                              <span className="text-sm font-bold tracking-wide">
                                {getInitials(currentUser)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground truncate leading-tight">
                              {getDisplayName(currentUser)}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
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
                                     hover:bg-muted focus:bg-muted"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            window.location.href = '/profile';
                          }}
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-colors">
                            <User className="h-4 w-4 text-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Profile</p>
                            <p className="text-xs text-muted-foreground">Manage your account</p>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuItem 
                          className="flex items-center space-x-3 px-3 py-3 cursor-pointer transition-all duration-200 !rounded-none group
                                     hover:bg-muted focus:bg-muted"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            window.location.href = '/settings';
                          }}
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-colors">
                            <Settings className="h-4 w-4 text-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Settings</p>
                            <p className="text-xs text-muted-foreground">Preferences & privacy</p>
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

              {/* Login/Sign Up Buttons - only show if not authenticated */}
              {!isAuthenticated && (
                <motion.div 
                  className="relative z-20 flex items-center space-x-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Login Button */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <Button
                      onClick={() => navigate('/login')}
                      variant="ghost"
                      className={cn(
                        "transition-all duration-300",
                        // Desktop styling
                        "sm:flex sm:items-center sm:space-x-2 sm:px-4 sm:py-2",
                        "sm:bg-gradient-to-br sm:from-white/95 sm:via-white sm:to-slate-50/90 sm:backdrop-blur-xl sm:text-wildcats-maroon",
                        "sm:hover:from-white sm:hover:via-white sm:hover:to-white sm:hover:shadow-xl sm:hover:shadow-black/10",
                        "sm:border sm:border-white/40 sm:shadow-lg sm:shadow-black/5 sm:rounded-xl",
                        // Mobile styling
                        "flex items-center justify-center p-2 bg-white/10 border border-white/20 rounded-lg",
                        "hover:bg-white/20 text-white sm:text-wildcats-maroon",
                        "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                      )}
                    >
                      <LogIn className="h-4 w-4" />
                      <span className="hidden sm:inline text-sm font-medium">Login</span>
                    </Button>
                  </motion.div>

                  {/* Sign Up Button */}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <Button
                      onClick={() => navigate('/register')}
                      className={cn(
                        "transition-all duration-300",
                        // Desktop styling
                        "sm:flex sm:items-center sm:space-x-2 sm:px-4 sm:py-2",
                        "sm:bg-gradient-to-br sm:from-wildcats-yellow sm:via-yellow-400 sm:to-amber-400 sm:text-black",
                        "sm:hover:from-yellow-300 sm:hover:via-yellow-400 sm:hover:to-amber-500 sm:hover:shadow-xl sm:hover:shadow-yellow-400/20",
                        "sm:border sm:border-yellow-300/40 sm:shadow-lg sm:shadow-yellow-400/10 sm:rounded-xl",
                        // Mobile styling
                        "flex items-center justify-center p-2 bg-wildcats-yellow border border-yellow-300/40 rounded-lg",
                        "hover:bg-yellow-300 text-black",
                        "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                      )}
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="hidden sm:inline text-sm font-medium">Sign Up</span>
                    </Button>
                  </motion.div>
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
