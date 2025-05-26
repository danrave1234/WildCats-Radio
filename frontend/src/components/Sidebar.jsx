import { useState, useEffect } from 'react';
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
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
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

const removeCookie = (name) => {
  document.cookie = name + '=; Max-Age=-99999999; path=/';
};

const Sidebar = ({ userRole }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [userPreference, setUserPreference] = useState(null);
  const location = useLocation();
  const { currentUser } = useAuth();

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileOpen && !event.target.closest(".profile-dropdown")) {
        setIsProfileOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isProfileOpen])

  // Close dropdown when navigating
  useEffect(() => {
    setIsProfileOpen(false)
  }, [location])

  const getInitials = (name) => {
    if (!name) return "JD";
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Logo Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <Link to="/" className="flex justify-center items-center py-4">
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
              className={`flex items-center p-3 text-base font-medium rounded-lg ${
                location.pathname === '/notifications'
                  ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-600 dark:text-maroon-400'
                  : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <BellIcon className="w-6 h-6 mr-3" />
              <span>Notifications</span>
            </Link>
          </li>

          {(userRole === 'DJ' || userRole === 'ADMIN') && (
            <li>
              <Link
                to="/broadcast-history"
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
        <div className="profile-dropdown relative">
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
  );
};

export default Sidebar; 