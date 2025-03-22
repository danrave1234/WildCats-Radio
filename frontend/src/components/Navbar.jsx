"use client"

import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline"

const Navbar = ({ userRole }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const location = useLocation()

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)

    // Apply dark mode to document
    if (newDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }

    // Save preference to localStorage
    localStorage.setItem("darkMode", newDarkMode)
  }

  // Check for saved theme preference on component mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true"
    setDarkMode(savedDarkMode)

    if (savedDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
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
                <span className="text-maroon-700 dark:text-yellow-500 text-xl font-bold">WildCats Radio</span>
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {/* Show navigation links based on user role */}
                {userRole === "LISTENER" && (
                    <Link
                        to="/dashboard"
                        className={`${
                            location.pathname === "/dashboard"
                                ? "border-maroon-700 text-gray-900 dark:text-white"
                                : "border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
                        } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    >
                      Dashboard
                    </Link>
                )}
                {userRole === "DJ" && (
                    <Link
                        to="/dj-dashboard"
                        className={`${
                            location.pathname === "/dj-dashboard"
                                ? "border-maroon-700 text-gray-900 dark:text-white"
                                : "border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
                        } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    >
                      DJ Dashboard
                    </Link>
                )}

                {userRole === "ADMIN" && (
                    <Link
                        to="/admin"
                        className={`${
                            location.pathname === "/admin"
                                ? "border-maroon-700 text-gray-900 dark:text-white"
                                : "border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
                        } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    >
                      Admin
                    </Link>
                )}
                <Link
                    to="/schedule"
                    className={`${
                        location.pathname === "/schedule"
                            ? "border-maroon-700 text-gray-900 dark:text-white"
                            : "border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
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
                      className="flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600"
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
                            {darkMode ? <SunIcon className="mr-2 h-5 w-5" /> : <MoonIcon className="mr-2 h-5 w-5" />}
                            {darkMode ? "Light Mode" : "Dark Mode"}
                          </div>
                        </div>
                      </button>

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
                          <div className="flex items-center text-maroon-700 dark:text-yellow-500">
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
  )
}

export default Navbar

