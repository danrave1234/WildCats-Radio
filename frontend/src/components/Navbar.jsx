import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  RadioIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import NotificationBell from './NotificationBell';

const Navbar = ({ userRole }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

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
    setIsMobileMenuOpen(false)
  }, [location])

  return (
      <nav className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {/* Mobile menu button */}
              <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="inline-flex items-center justify-center md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700 focus:outline-none"
              >
                {isMobileMenuOpen ? (
                    <XMarkIcon className="h-6 w-6" />
                ) : (
                    <Bars3Icon className="h-6 w-6" />
                )}
              </button>

              {/* Logo */}
              <Link to="/" className="flex-shrink-0 flex items-center ml-0 md:ml-0">
                <RadioIcon className="h-8 w-8 text-gold-500 dark:text-gold-400" />
                <span className="ml-2 text-maroon-700 dark:text-maroon-400 text-xl font-bold">WildCats Radio</span>
              </Link>

              {/* Desktop Navigation Links */}
              <div className="hidden md:ml-8 md:flex md:space-x-6">
                {/* Show navigation links based on user role */}
                {userRole === 'LISTENER' && (
                    <Link
                        to="/dashboard"
                        className={`${
                            location.pathname === '/dashboard'
                                ? 'text-maroon-700 dark:text-maroon-400 font-medium'
                                : 'text-gray-600 dark:text-gray-300 hover:text-maroon-700 dark:hover:text-maroon-400'
                        } inline-flex items-center px-1 pt-1 text-sm`}
                    >
                      Dashboard
                    </Link>
                )}
                {userRole === 'DJ' && (
                    <Link
                        to="/dj-dashboard"
                        className={`${
                            location.pathname === '/dj-dashboard'
                                ? 'text-maroon-700 dark:text-maroon-400 font-medium'
                                : 'text-gray-600 dark:text-gray-300 hover:text-maroon-700 dark:hover:text-maroon-400'
                        } inline-flex items-center px-1 pt-1 text-sm`}
                    >
                      DJ Dashboard
                    </Link>
                )}

                {userRole === 'ADMIN' && (
                    <Link
                        to="/admin"
                        className={`${
                            location.pathname === '/admin'
                                ? 'text-maroon-700 dark:text-maroon-400 font-medium'
                                : 'text-gray-600 dark:text-gray-300 hover:text-maroon-700 dark:hover:text-maroon-400'
                        } inline-flex items-center px-1 pt-1 text-sm`}
                    >
                      Admin
                    </Link>
                )}
                <Link
                    to="/schedule"
                    className={`${
                        location.pathname === '/schedule'
                            ? 'text-maroon-700 dark:text-maroon-400 font-medium'
                            : 'text-gray-600 dark:text-gray-300 hover:text-maroon-700 dark:hover:text-maroon-400'
                    } inline-flex items-center px-1 pt-1 text-sm`}
                >
                  Schedule
                </Link>
                
                {/* Analytics link for DJ and Admin users */}
                {(userRole === 'DJ' || userRole === 'ADMIN') && (
                    <Link
                        to="/analytics"
                        className={`${
                            location.pathname === '/analytics'
                                ? 'text-maroon-700 dark:text-maroon-400 font-medium'
                                : 'text-gray-600 dark:text-gray-300 hover:text-maroon-700 dark:hover:text-maroon-400'
                        } inline-flex items-center px-1 pt-1 text-sm`}
                    >
                      Analytics
                    </Link>
                )}
              </div>
            </div>

            {/* User Menu and Notifications */}
            <div className="flex items-center space-x-4">
              <NotificationBell />



              {/* Profile dropdown */}
              <div className="profile-dropdown relative">
                <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500 p-1"
                    id="user-menu"
                    aria-expanded={isProfileOpen}
                    aria-haspopup="true"
                >
                  <span className="sr-only">Open user menu</span>
                  <UserCircleIcon className="h-7 w-7 text-gray-600 dark:text-gray-300" />
                </button>

                {isProfileOpen && (
                    <div
                        className="origin-top-right absolute right-0 mt-2 w-56 rounded-xl shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-gray-200 dark:border-gray-700"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="user-menu"
                    >
                      <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                        <p className="font-medium">Signed in as</p>
                        <p className="truncate">{userRole}</p>
                      </div>

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

                      <Link
                          to="/settings"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          role="menuitem"
                      >
                        <div className="flex items-center">
                          <Cog6ToothIcon className="mr-2 h-5 w-5" />
                          Settings
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
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700`}>
          <div className="px-2 pt-2 pb-3 space-y-1">
            {userRole === 'LISTENER' && (
                <Link
                    to="/dashboard"
                    className={`${
                        location.pathname === '/dashboard'
                            ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-400'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    } block px-3 py-2 rounded-md text-base font-medium`}
                >
                  Dashboard
                </Link>
            )}
            {userRole === 'DJ' && (
                <Link
                    to="/dj-dashboard"
                    className={`${
                        location.pathname === '/dj-dashboard'
                            ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-400'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    } block px-3 py-2 rounded-md text-base font-medium`}
                >
                  DJ Dashboard
                </Link>
            )}
            {userRole === 'ADMIN' && (
                <Link
                    to="/admin"
                    className={`${
                        location.pathname === '/admin'
                            ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-400'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    } block px-3 py-2 rounded-md text-base font-medium`}
                >
                  Admin
                </Link>
            )}
            <Link
                to="/schedule"
                className={`${
                    location.pathname === '/schedule'
                        ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                } block px-3 py-2 rounded-md text-base font-medium`}
            >
              Schedule
            </Link>
            
            {/* Analytics link for DJ and Admin users */}
            {(userRole === 'DJ' || userRole === 'ADMIN') && (
                <Link
                    to="/analytics"
                    className={`${
                        location.pathname === '/analytics'
                            ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-400'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    } block px-3 py-2 rounded-md text-base font-medium`}
                >
                  Analytics
                </Link>
            )}
            <Link
                to="/profile"
                className={`${
                    location.pathname === '/profile'
                        ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                } block px-3 py-2 rounded-md text-base font-medium`}
            >
              Profile
            </Link>
            <Link
                to="/settings"
                className={`${
                    location.pathname === '/settings'
                        ? 'bg-maroon-50 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                } block px-3 py-2 rounded-md text-base font-medium`}
            >
              Settings
            </Link>
          </div>
        </div>
      </nav>
  );
};

export default Navbar;