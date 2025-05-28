"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { Link } from "react-router-dom"
import { XCircleIcon } from "@heroicons/react/24/outline"
import wildcatRadioLogo from "../assets/wildcatradio_logo.png"
import icHide from "../assets/ic_hide.png"
import icUnhide from "../assets/ic_unhide.png"

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
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
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
    <div className="min-h-screen flex items-center justify-center bg-[#E9ECEC] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white shadow-xl rounded-lg overflow-hidden">
        <div className="p-8 flex flex-col items-center">
          <img 
            src={wildcatRadioLogo} 
            alt="WildCat Radio Logo" 
            className="h-28 mb-6"
          />
          
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-1">
            Welcome
          </h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            Sign in to continue to WildCats Radio
          </p>

          <form className="w-full" onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#91403E] focus:border-[#91403E]"
                placeholder="Enter your email"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#91403E] focus:border-[#91403E]"
                  placeholder="Enter your password"
                />
                <button 
                  type="button" 
                  onClick={togglePasswordVisibility}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  <img 
                    src={showPassword ? icHide : icUnhide} 
                    alt={showPassword ? "Hide password" : "Show password"} 
                    className="h-5 w-5 opacity-70"
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                  className="h-4 w-4 text-[#91403E] focus:ring-[#91403E] border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-[#91403E] hover:text-[#91403E]/80">
                  Forgot password?
                </a>
              </div>
            </div>

            {(error || authError) && (
              <div className="rounded-md bg-red-50 p-3 mb-4 border border-red-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error || authError}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 text-white font-medium rounded-md bg-[#F4BE03] hover:bg-[#F4BE03]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F4BE03] transition-colors ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account? <Link to="/register" className="font-medium text-[#91403E] hover:text-[#91403E]/80">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
} 
