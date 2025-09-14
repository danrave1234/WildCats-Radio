"use client"

import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"
import wildcatRadioLogo from "../assets/wildcatradio_logo.png"
import { Separator } from "@/components/ui/separator"

// (Removed page-specific theme logic; global ThemeProvider controls theme)

export default function Login() {
  const { login, loading, error: authError } = useAuth()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Theme is managed globally; no page-specific listeners

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
      // Show API-provided error message if available (text or JSON)
      let message = 'Login failed. Please try again.'
      if (err?.response) {
        const status = err.response.status
        // Try JSON first
        if (typeof err.response.data === 'string') {
          message = err.response.data
        } else if (err.response.data?.message) {
          message = err.response.data.message
        } else if (status === 429) {
          message = 'Too many failed attempts. Please wait and try again.'
        } else if (status === 401) {
          message = 'Invalid email or password.'
        }
      }
      setError(message)
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-muted/40 to-muted text-foreground dark:from-slate-800 dark:via-slate-700/60 dark:to-slate-600 overflow-y-auto">
      <div className="w-full flex flex-col items-center justify-start min-h-screen p-4 py-8 relative">
        <div className="w-full max-w-md my-auto">
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

          <Card className="border border-border shadow bg-white dark:bg-slate-700 text-card-foreground overflow-hidden !rounded-none animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ease-out">
            <div className="h-3 bg-wildcats-maroon" />
            <CardHeader className="px-6 pt-6 pb-3">
              <div>
                <CardTitle className="text-xl font-bold">Sign in to your account</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Enter your email below to sign in to your account
                </CardDescription>
              </div>
            </CardHeader>
            <div className="px-6">
              <Separator className="bg-border" />
            </div>
            <CardContent className="px-6 py-6 pt-3">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
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
                    className="h-10 !rounded-none"
                  />
                </div>
                
                {/* Password Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground">
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
                      className="h-10 pr-10 !rounded-none"
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
                        <EyeOff className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
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
                      className="border-wildcats-maroon data-[state=checked]:bg-wildcats-maroon data-[state=checked]:text-white data-[state=checked]:border-wildcats-maroon focus:outline-none focus-visible:ring-0 !rounded-none h-3 w-3 data-[state=unchecked]:hover:bg-wildcats-maroon/10 data-[state=unchecked]:hover:before:content-['✓'] data-[state=unchecked]:hover:before:absolute data-[state=unchecked]:hover:before:text-wildcats-maroon data-[state=unchecked]:hover:before:opacity-30 data-[state=unchecked]:hover:before:text-xs data-[state=unchecked]:hover:before:flex data-[state=unchecked]:hover:before:items-center data-[state=unchecked]:hover:before:justify-center data-[state=unchecked]:hover:before:inset-0 relative"
                    />
                    <Label 
                      htmlFor="remember-me" 
                      className="text-xs text-muted-foreground cursor-pointer font-medium"
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
                  <div className="!rounded-none bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs font-medium text-red-800 dark:text-red-300">{error || authError}</p>
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
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Link 
                    to="/register" 
                    className="font-semibold text-wildcats-maroon focus:outline-none inline-block relative transition-transform duration-150 hover:-translate-y-0.5 hover:underline hover:underline-offset-2"
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
