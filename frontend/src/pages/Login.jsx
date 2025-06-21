"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Eye, EyeOff, Loader2, KeyRound } from "lucide-react"
import wildcatRadioLogo from "../assets/wildcatradio_logo.png"
import { Separator } from "@/components/ui/separator"

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
    <div className="min-h-screen w-full bg-gradient-to-b from-white via-yellow-50 to-yellow-200">
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 py-8 relative">
        <div className="w-full max-w-md">
          {/* Logo Section */}
          <div className="flex justify-center mb-2">
            <img 
              src={wildcatRadioLogo} 
              alt="WildCat Radio Logo" 
              className="h-40 w-auto"
            />
          </div>

          {/* Title Section */}
          <div className="text-center mb-4 px-4">
            <p className="text-sm text-gray-600 uppercase tracking-wider max-w-sm mx-auto font-semibold">
              Your radio broadcast platform
            </p>
          </div>

          <Card className="border-0 shadow-2xl bg-white backdrop-blur-xl overflow-hidden !rounded-none">
            <div className="h-3 bg-gradient-to-r from-wildcats-maroon to-wildcats-maroon/70" />
            <CardHeader className="flex flex-row items-start justify-between px-6 pt-6 pb-3">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800">Sign in to your account</CardTitle>
                <CardDescription className="text-sm text-gray-500 mt-1">
                  Enter your email below to sign in to your account
                </CardDescription>
              </div>
              <div className="bg-wildcats-maroon/10 p-3 !rounded-none">
                <KeyRound className="h-6 w-6 text-wildcats-maroon" />
              </div>
            </CardHeader>
            <div className="px-6">
              <Separator className="bg-gray-200" />
            </div>
            <CardContent className="px-6 py-6 pt-3">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-gray-700">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email address"
                    className="h-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 !rounded-none shadow-sm"
                  />
                </div>
                
                {/* Password Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      className="h-10 bg-white border-gray-200 pr-10 text-gray-900 placeholder:text-gray-400 !rounded-none shadow-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="group absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 !rounded-none focus:outline-none hover:bg-transparent"
                      onClick={togglePasswordVisibility}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500 transition-colors group-hover:text-black" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500 transition-colors group-hover:text-black" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember-me"
                      checked={rememberMe}
                      onCheckedChange={setRememberMe}
                      className="border-wildcats-maroon data-[state=checked]:bg-wildcats-maroon data-[state=checked]:text-white data-[state=checked]:border-wildcats-maroon focus:outline-none focus-visible:ring-0 !rounded-none h-4 w-4 data-[state=unchecked]:hover:bg-wildcats-maroon/10 data-[state=unchecked]:hover:before:content-['✓'] data-[state=unchecked]:hover:before:absolute data-[state=unchecked]:hover:before:text-wildcats-maroon data-[state=unchecked]:hover:before:opacity-30 data-[state=unchecked]:hover:before:text-xs data-[state=unchecked]:hover:before:flex data-[state=unchecked]:hover:before:items-center data-[state=unchecked]:hover:before:justify-center data-[state=unchecked]:hover:before:inset-0 relative"
                    />
                    <Label 
                      htmlFor="remember-me" 
                      className="text-xs text-gray-600 cursor-pointer font-medium"
                    >
                      Remember me
                    </Label>
                  </div>

                  <Link 
                    to="#" 
                    className="text-xs font-semibold text-wildcats-maroon hover:text-wildcats-maroon/80 transition-colors focus:outline-none"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Error Message */}
                {(error || authError) && (
                  <div className="!rounded-none bg-red-50 border border-red-200 p-3">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs font-medium text-red-800">{error || authError}</p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-wildcats-yellow to-wildcats-yellow/90 hover:from-wildcats-yellow/90 hover:to-wildcats-yellow/80 text-black font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:transform-none disabled:opacity-70 !rounded-none mt-4 focus:outline-none focus-visible:ring-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              {/* Sign Up Link */}
              <div className="text-center pt-3">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link 
                    to="/register" 
                    className="font-semibold text-wildcats-maroon hover:text-wildcats-maroon/80 transition-colors focus:outline-none"
                  >
                    Create account
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 
