"use client"

import { useState, useEffect } from "react"
import { RadioIcon } from "@heroicons/react/24/outline"
import { useAuth } from "../context/AuthContext"
import { Link } from "react-router-dom"

// Cookie helper functions
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
};

export default function Login() {
  const { login, loading, error: authError } = useAuth()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")

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

  // Check for saved theme preference on component mount and set up system preference listener
  useEffect(() => {
    const hasUserPreference = getCookie("userPreference") === "true"
    const savedDarkMode = getCookie("darkMode") === "true"

    if (hasUserPreference) {
      // User has set a preference, use it
      applyDarkMode(savedDarkMode)
    } else {
      // No user preference, follow system preference
      const systemDark = systemPrefersDark()
      applyDarkMode(systemDark)
    }

    // Set up listener for system preference changes
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemPreferenceChange = (e) => {
      // Only update if user hasn't set a preference
      if (!getCookie("userPreference")) {
        const systemDark = e.matches
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  // Handle form submission with backend integration
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    try {
      // Call the login function from AuthContext
      await login(formData)
      // No need to call onLogin as the AuthContext will handle the authentication state
    } catch (err) {
      // Error handling is done by AuthContext, but we can add additional handling here if needed
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    }
  }


  return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="flex justify-center">
              <RadioIcon className="h-16 w-16 text-yellow-500 dark:text-yellow-400" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">WildCats Radio</h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">Sign in to access your account</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600 rounded-t-md focus:outline-none focus:ring-maroon-600 focus:border-maroon-600 focus:z-10 sm:text-sm"
                    placeholder="Email address"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600 rounded-b-md focus:outline-none focus:ring-maroon-600 focus:border-maroon-600 focus:z-10 sm:text-sm"
                    placeholder="Password"
                />
              </div>
            </div>

            {(error || authError) && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                          className="h-5 w-5 text-red-400"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                      >
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">{error || authError}</h3>
                    </div>
                  </div>
                </div>
            )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading ? 'bg-maroon-400 cursor-not-allowed' : 'bg-maroon-700 hover:bg-maroon-800'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500`}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-maroon-600 hover:text-maroon-500">
                Sign up
              </Link>
            </p>
          </div>
        </form>

      </div>
    </div>
  );
} 
