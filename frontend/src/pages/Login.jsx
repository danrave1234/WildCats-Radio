"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { Link, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"
import wildcatRadioLogo from "../assets/wildcatradio_logo.png"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft } from "lucide-react"
import { config } from "../config"

// (Removed page-specific theme logic; global ThemeProvider controls theme)

export default function Login() {
  const { login, loading, error: authError } = useAuth()
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Check for OAuth errors in URL params
  useEffect(() => {
    const oauthError = searchParams.get('oauth_error')
    const errorReason = searchParams.get('reason')
    
    if (oauthError) {
      const errorMessage = errorReason 
        ? decodeURIComponent(errorReason)
        : decodeURIComponent(oauthError)
      setError(errorMessage)
      
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('oauth_error')
      newUrl.searchParams.delete('reason')
      window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search)
    }
  }, [searchParams])

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
          {/* Back to Home */}
          <div className="w-full mb-2">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-wildcats-maroon hover:text-wildcats-maroon/80">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
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
              {/* OAuth Login Buttons */}
              <div className="mb-4">
                <Button
                  type="button"
                  onClick={() => {
                    // In local dev, use relative URL so Vite proxy handles it (cookies work across ports)
                    // In production, use backend URL directly - cookies are set with root domain (.wildcat-radio.live)
                    // so they work across both wildcat-radio.live and api.wildcat-radio.live subdomains
                    const oauthUrl = config.isLocal 
                      ? '/oauth2/authorization/google' 
                      : `${config.backendBaseUrl || config.apiBaseUrl || 'https://api.wildcat-radio.live'}/oauth2/authorization/google`;
                    window.location.href = oauthUrl;
                  }}
                  className="w-full h-11 bg-white dark:bg-slate-600 hover:bg-gray-50 dark:hover:bg-slate-500 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-500 font-semibold shadow-sm hover:shadow-md transition-all duration-300 !rounded-none focus:outline-none focus-visible:ring-0"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-slate-700 px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>

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
