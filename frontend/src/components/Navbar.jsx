import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  UserCircleIcon, 
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

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

const Navbar = ({ userRole }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [userPreference, setUserPreference] = useState(null); // null = follow system, true/false = user preference
  const location = useLocation();

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
    setUserPreference(newDarkMode) // Set user preference

    // Apply dark mode to document
    applyDarkMode(newDarkMode)

    // Save preference to cookies
    setCookie("darkMode", newDarkMode)
    setCookie("userPreference", "true") // Indicate user has set a preference
  }

  // Check for saved theme preference on component mount and set up system preference listener
  useEffect(() => {
    const hasUserPreference = getCookie("userPreference") === "true"
    const savedDarkMode = getCookie("darkMode") === "true"

    if (hasUserPreference) {
      // User has set a preference, use it
      setUserPreference(savedDarkMode)
      setDarkMode(savedDarkMode)
      applyDarkMode(savedDarkMode)
    } else {
      // No user preference, follow system preference
      const systemDark = systemPrefersDark()
      setUserPreference(null)
      setDarkMode(systemDark)
      applyDarkMode(systemDark)
    }

    // Set up listener for system preference changes
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemPreferenceChange = (e) => {
      // Only update if user hasn't set a preference
      if (!getCookie("userPreference")) {
        const systemDark = e.matches
        setDarkMode(systemDark)
        applyDarkMode(systemDark)
      }
    }

    // Add listener for system preference changes
    if (darkModeMediaQuery.addEventListener) {
      darkModeMediaQuery.addEventListener('change', handleSystemPreferenceChange)
    } else if (darkModeMediaQuery.addListener) {
      // For older browsers
      darkModeMediaQuery.addListener(handleSystemPreferenceChange)
    }

    // Clean up
    return () => {
      if (darkModeMediaQuery.removeEventListener) {
        darkModeMediaQuery.removeEventListener('change', handleSystemPreferenceChange)
      } else if (darkModeMediaQuery.removeListener) {
        // For older browsers
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

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-maroon-700 dark:text-maroon-400 text-xl font-bold">WildCats Radio</span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {/* Show navigation links based on user role */}
              {userRole === 'LISTENER' && (
                  <Link
                to="/dashboard"
                className={`${
                  location.pathname === '/dashboard'
                    ? 'border-maroon-500 text-gray-900 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
              >
                Dashboard
              </Link>
                  )}
              {userRole === 'DJ' && (
                  <Link
                      to="/dj-dashboard"
                      className={`${
                          location.pathname === '/dj-dashboard'
                              ? 'border-maroon-500 text-gray-900 dark:text-white'
                              : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200'
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    DJ Dashboard
                  </Link>
              )}

              {userRole === 'ADMIN' && (
                  <Link
                      to="/admin"
                      className={`${
                          location.pathname === '/admin'
                              ? 'border-maroon-500 text-gray-900 dark:text-white'
                              : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200'
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Admin
                  </Link>
              )}
              <Link
                to="/schedule"
                className={`${
                  location.pathname === '/schedule'
                    ? 'border-maroon-500 text-gray-900 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
              >
                Schedule
              </Link>


            </div>
          </div>

          {/* Profile dropdown */}
          <div className="flex items-center profile-dropdown">
            <div className="ml-3 relative">
              <div>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500"
                  id="user-menu"
                  aria-expanded="false"
                  aria-haspopup="true"
                >
                  <span className="sr-only">Open user menu</span>
                  <UserCircleIcon className="h-8 w-8 text-gray-600 dark:text-gray-300" />
                </button>
              </div>

              {isProfileOpen && (
                <div
                  className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu"
                >
                  <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">
                    <p className="font-medium">Signed in as</p>
                    <p className="truncate">{userRole}</p>
                  </div>

                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    role="menuitem"
                  >
                    <div className="flex items-center">
                      <UserCircleIcon className="mr-2 h-5 w-5" />
                      Your Profile
                    </div>
                  </Link>

                  <button
                    onClick={toggleDarkMode}
                    className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    role="menuitem"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {darkMode ? (
                          <SunIcon className="mr-2 h-5 w-5" />
                        ) : (
                          <MoonIcon className="mr-2 h-5 w-5" />
                        )}
                        {darkMode ? 'Light Mode' : 'Dark Mode'}
                        {userPreference !== null && <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(Manual)</span>}
                      </div>
                    </div>
                  </button>

                  {userPreference !== null && (
                    <button
                      onClick={() => {
                        // Reset to system preference
                        removeCookie("userPreference");
                        removeCookie("darkMode");

                        // Apply system preference
                        const systemDark = systemPrefersDark();
                        setUserPreference(null);
                        setDarkMode(systemDark);
                        applyDarkMode(systemDark);
                      }}
                      className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                      role="menuitem"
                    >
                      <div className="flex items-center">
                        <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
                        </svg>
                        Use System Setting
                      </div>
                    </button>
                  )}

                  <Link
                    to="/settings"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    role="menuitem"
                  >
                    <div className="flex items-center">
                      <Cog6ToothIcon className="mr-2 h-5 w-5" />
                      Settings
                    </div>
                  </Link>

                  <div className="border-t border-gray-200 dark:border-gray-600">
                    <Link
                      to="/logout"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                      role="menuitem"
                    >
                      <div className="flex items-center text-red-600 dark:text-red-400">
                        <ArrowRightOnRectangleIcon className="mr-2 h-5 w-5" />
                        Sign out
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
