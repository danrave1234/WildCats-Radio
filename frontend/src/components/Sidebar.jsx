import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
  RadioIcon,
  HomeIcon,
  CalendarIcon,
  BellIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import wildcatRadioLogo from '../assets/wildcatradio_logo.png';

// Cookie helper functions
const setCookie = (name, value, days = 7) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Strict';
};

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
};

const Sidebar = ({ userRole }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [_userPreference, setUserPreference] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { currentUser } = useAuth();
  const { unreadCount } = useNotifications();
  
  // Refs for click outside detection
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);
  const profileDropdownRef = useRef(null);

  // Check if system prefers dark mode
  const systemPrefersDark = () => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Apply dark mode to document
  const applyDarkMode = (isDark) => {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    setUserPreference(newDarkMode)
    applyDarkMode(newDarkMode)
    setCookie("darkMode", newDarkMode)
    setCookie("userPreference", "true")
  }

  // Check for saved theme preference on mount
  useEffect(() => {
    const hasUserPreference = getCookie("userPreference") === "true"
    const savedDarkMode = getCookie("darkMode") === "true"

    if (hasUserPreference) {
      setUserPreference(savedDarkMode)
      setDarkMode(savedDarkMode)
      applyDarkMode(savedDarkMode)
    } else {
      const systemDark = systemPrefersDark()
      setUserPreference(null)
      setDarkMode(systemDark)
      applyDarkMode(systemDark)
    }

    // Set up listener for system preference changes
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemPreferenceChange = (e) => {
      if (!getCookie("userPreference")) {
        const systemDark = e.matches
        setDarkMode(systemDark)
        applyDarkMode(systemDark)
      }
    }

    if (darkModeMediaQuery.addEventListener) {
      darkModeMediaQuery.addEventListener('change', handleSystemPreferenceChange)
    } else if (darkModeMediaQuery.addListener) {
      darkModeMediaQuery.addListener(handleSystemPreferenceChange)
    }

    return () => {
      if (darkModeMediaQuery.removeEventListener) {
        darkModeMediaQuery.removeEventListener('change', handleSystemPreferenceChange)
      } else if (darkModeMediaQuery.removeListener) {
        darkModeMediaQuery.removeListener(handleSystemPreferenceChange)
      }
    }
  }, [])

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileOpen && profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isProfileOpen])

  // Close dropdown and mobile menu when navigating
  useEffect(() => {
    setIsProfileOpen(false)
    setIsMobileMenuOpen(false)
  }, [location])

  // Improved click outside detection for mobile menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobileMenuOpen) {
        // Check if click is outside both the sidebar and the menu button
        const isClickOnSidebar = sidebarRef.current && sidebarRef.current.contains(event.target);
        const isClickOnMenuButton = menuButtonRef.current && menuButtonRef.current.contains(event.target);
        
        if (!isClickOnSidebar && !isClickOnMenuButton) {
          setIsMobileMenuOpen(false);
        }
      }
    }

    // Use capture phase to ensure we catch the event before other handlers
    document.addEventListener("mousedown", handleClickOutside, true)
    document.addEventListener("touchstart", handleClickOutside, true)
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true)
      document.removeEventListener("touchstart", handleClickOutside, true)
    }
  }, [isMobileMenuOpen])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const getInitials = (name) => {
    if (!name) return "JD";
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile menu button - Always visible and accessible */}
      <button
        ref={menuButtonRef}
        onClick={toggleMobileMenu}
        className="mobile-menu-button fixed top-4 left-4 z-[60] p-2 rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 md:hidden hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-label="Toggle menu"
        aria-expanded={isMobileMenuOpen}
      >
        {isMobileMenuOpen ? (
          <XMarkIcon className="h-6 w-6 text-gray-900 dark:text-white" />
        ) : (
          <Bars3Icon className="h-6 w-6 text-gray-900 dark:text-white" />
        )}
      </button>

      {/* Mobile overlay - Click to close */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden transition-opacity duration-300"
          onClick={closeMobileMenu}
          onTouchStart={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        ref={sidebarRef}
        className={`mobile-sidebar fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:relative md:z-auto`}
        aria-hidden={!isMobileMenuOpen}
      >
      {/* Logo Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <Link to="/" className="flex justify-center items-center py-4" onClick={closeMobileMenu}>
          <img src={wildcatRadioLogo} alt="WildCats Radio" className="h-40 w-auto" />
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-6 px-4">
        <ul className="space-y-2">
          {userRole === 'LISTENER' && (
            <li>
              <Link
                to="/dashboard"
                onClick={closeMobileMenu}
                className={`flex items-center p-3 text-base font-medium rounded-lg ${
                  location.pathname === '/dashboard'
                    ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-600 dark:text-maroon-400'
                    : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <HomeIcon className="w-6 h-6 mr-3" />
                <span>Dashboard</span>
              </Link>
            </li>
          )}

          {userRole === 'DJ' && (
            <li>
              <Link
                to="/dj-dashboard"
                onClick={closeMobileMenu}
                className={`flex items-center p-3 text-base font-medium rounded-lg ${
                  location.pathname === '/dj-dashboard'
                    ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-600 dark:text-maroon-400'
                    : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <RadioIcon className="w-6 h-6 mr-3" />
                <span>DJ Dashboard</span>
              </Link>
            </li>
          )}

          {userRole === 'ADMIN' && (
            <li>
              <Link
                to="/admin"
                onClick={closeMobileMenu}
                className={`flex items-center p-3 text-base font-medium rounded-lg ${
                  location.pathname === '/admin'
                    ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-600 dark:text-maroon-400'
                    : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <ShieldCheckIcon className="w-6 h-6 mr-3" />
                <span>Admin</span>
              </Link>
            </li>
          )}

          <li>
            <Link
              to="/notifications"
              onClick={closeMobileMenu}
              className={`flex items-center p-3 text-base font-medium rounded-lg relative ${
                location.pathname === '/notifications'
                  ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-600 dark:text-maroon-400'
                  : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <BellIcon className="w-6 h-6 mr-3" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-auto bg-maroon-600 text-white text-xs font-medium px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          </li>

          {(userRole === 'DJ' || userRole === 'ADMIN') && (
            <li>
              <Link
                to="/broadcast-history"
                onClick={closeMobileMenu}
                className={`flex items-center p-3 text-base font-medium rounded-lg ${
                  location.pathname === '/broadcast-history'
                    ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-600 dark:text-maroon-400'
                    : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <RadioIcon className="w-6 h-6 mr-3" />
                <span>Broadcast History</span>
              </Link>
            </li>
          )}

          {(userRole === 'DJ' || userRole === 'ADMIN') && (
            <li>
              <Link
                to="/analytics"
                onClick={closeMobileMenu}
                className={`flex items-center p-3 text-base font-medium rounded-lg ${
                  location.pathname === '/analytics'
                    ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-600 dark:text-maroon-400'
                    : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <ChartBarIcon className="w-6 h-6 mr-3" />
                <span>Analytics</span>
              </Link>
            </li>
          )}

          <li>
            <Link
              to="/schedule"
              onClick={closeMobileMenu}
              className={`flex items-center p-3 text-base font-medium rounded-lg ${
                location.pathname === '/schedule'
                  ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-600 dark:text-maroon-400'
                  : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <CalendarIcon className="w-6 h-6 mr-3" />
              <span>Schedule</span>
            </Link>
          </li>
        </ul>

        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={toggleDarkMode}
            className="flex items-center p-3 w-full text-base font-medium text-gray-900 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {darkMode ? (
              <>
                <SunIcon className="w-6 h-6 mr-3" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <MoonIcon className="w-6 h-6 mr-3" />
                <span>Dark Mode</span>
              </>
            )}
          </button>

          <Link
            to="/settings"
            onClick={closeMobileMenu}
            className={`flex items-center p-3 text-base font-medium rounded-lg ${
              location.pathname === '/settings'
                ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-600 dark:text-maroon-400'
                : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Cog6ToothIcon className="w-6 h-6 mr-3" />
            <span>Settings</span>
          </Link>
        </div>
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="profile-dropdown relative" ref={profileDropdownRef}>
          <div
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <div className="h-10 w-10 rounded-full bg-gold-500 flex items-center justify-center text-black font-medium">
              {getInitials(currentUser?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {currentUser?.name || 'John Doe'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {userRole || 'Listener'}
              </p>
            </div>
          </div>

          {isProfileOpen && (
            <div
              className="absolute bottom-full left-0 mb-2 w-56 rounded-xl shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-gray-200 dark:border-gray-700"
              role="menu"
            >
              <Link
                to="/profile"
                onClick={closeMobileMenu}
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                role="menuitem"
              >
                <div className="flex items-center">
                  <UserCircleIcon className="mr-2 h-5 w-5" />
                  Your Profile
                </div>
              </Link>

              <div className="border-t border-gray-200 dark:border-gray-700">
                <Link
                  to="/logout"
                  onClick={closeMobileMenu}
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  role="menuitem"
                >
                  <div className="flex items-center">
                    <ArrowRightOnRectangleIcon className="mr-2 h-5 w-5" />
                    Sign Out
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar; 