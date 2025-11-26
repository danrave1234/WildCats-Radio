"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
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
import AuthBackground from "@/components/AuthBackground"

export default function Register() {
  const { register, loading, error: authError } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    confirmPassword: "",
    birthdate: "",
    gender: "",
  })
  const [error, setError] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  // Toggle password visibility
  const togglePasswordsVisibility = () => {
    setShowPasswords(!showPasswords)
  }

  // Handle form submission with backend integration
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")


    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    // Validate birthdate (must be at least 13 years old)
    if (formData.birthdate) {
      const birthDate = new Date(formData.birthdate)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }

      if (age < 13) {
        setError('You must be at least 13 years old to register')
        return
      }
    } else {
      setError('Please enter your date of birth')
      return
    }

    try {
      // Remove confirmPassword before sending to backend
      const { confirmPassword, ...registerData } = formData

      // Call the register function from AuthContext
      await register(registerData)

      // Redirect to login page after successful registration
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    }
  }

  return (
    <AuthBackground contentClassName="px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full flex flex-col items-center justify-center relative">
        <div className="w-full max-w-sm sm:max-w-md lg:max-w-xl">
          {/* Back to Home */}
          <div className="w-full mb-2">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-wildcats-yellow hover:text-wildcats-yellow/90 transition-colors">
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
          <div className="text-center mb-3 sm:mb-4 px-4">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-200/90 max-w-sm mx-auto font-semibold">
              Join the WildCat Radio community
            </p>
          </div>

          <Card className="border border-white/20 dark:border-white/10 shadow-2xl bg-white/95 dark:bg-slate-800/90 backdrop-blur-xl text-card-foreground overflow-hidden !rounded-none animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ease-out">
            <div className="h-3 bg-wildcats-maroon" />
            <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 sm:pb-3">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold">Create your account</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Enter your details below to create your account
                </CardDescription>
              </div>
            </CardHeader>
            <div className="px-4 sm:px-6">
              <Separator className="bg-border" />
            </div>
            <CardContent className="px-4 sm:px-6 py-4 sm:py-6 pt-3">
              {/* OAuth Register Buttons */}
              <div className="mb-4">
                <Button
                  type="button"
                  onClick={() => {
                    // In local dev, use relative URL so Vite proxy handles it (cookies work across ports)
                    // In production, use full backend URL
                    const oauthUrl = config.isLocal 
                      ? '/oauth2/authorization/google' 
                      : `${config.apiBaseUrl || window.location.origin}/oauth2/authorization/google`;
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
                  Sign up with Google
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

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Name Fields Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstname" className="text-xs font-semibold text-muted-foreground">
                      First Name
                    </Label>
                    <Input
                      id="firstname"
                      name="firstname"
                      type="text"
                      autoComplete="given-name"
                      required
                      value={formData.firstname}
                      onChange={handleChange}
                      placeholder="First name"
                      className="h-10 !rounded-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lastname" className="text-xs font-semibold text-muted-foreground">
                      Last Name
                    </Label>
                    <Input
                      id="lastname"
                      name="lastname"
                      type="text"
                      autoComplete="family-name"
                      required
                      value={formData.lastname}
                      onChange={handleChange}
                      placeholder="Last name"
                      className="h-10 !rounded-none"
                    />
                  </div>
                </div>

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
                    placeholder="your.email@example.com"
                    className="h-10 !rounded-none"
                  />
                </div>

                {/* Birthdate Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="birthdate" className="text-xs font-semibold text-muted-foreground">
                    Date of Birth
                  </Label>
                  <Input
                    id="birthdate"
                    name="birthdate"
                    type="date"
                    required
                    value={formData.birthdate}
                    onChange={handleChange}
                    className="h-10 !rounded-none"
                  />
                  <p className="text-xs text-muted-foreground pt-1">
                    Used for analytics and age-appropriate content
                  </p>
                </div>

                {/* Gender Field (optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-xs font-semibold text-muted-foreground">
                    Gender (optional)
                  </Label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="h-10 !rounded-none w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <p className="text-xs text-muted-foreground pt-1">
                    Helps us improve demographics analytics
                  </p>
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
                      type={showPasswords ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a secure password"
                      className="h-10 pr-10 !rounded-none"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="group absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 !rounded-none focus:outline-none hover:bg-transparent"
                      onClick={togglePasswordsVisibility}
                      tabIndex={-1}
                    >
                      {showPasswords ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold text-muted-foreground">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPasswords ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm your password"
                      className="h-10 pr-10 !rounded-none"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="group absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 !rounded-none focus:outline-none hover:bg-transparent"
                      onClick={togglePasswordsVisibility}
                      tabIndex={-1}
                    >
                      {showPasswords ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                      )}
                    </Button>
                  </div>
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

                {/* Terms & Conditions Checkbox */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-2.5 pt-1">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={setAgreedToTerms}
                    className="border-wildcats-maroon data-[state=checked]:bg-wildcats-maroon data-[state=checked]:text-white data-[state=checked]:border-wildcats-maroon focus:outline-none focus-visible:ring-0 mt-0.5 !rounded-none h-3 w-3 data-[state=unchecked]:hover:bg-wildcats-maroon/10 data-[state=unchecked]:hover:before:content-['✓'] data-[state=unchecked]:hover:before:absolute data-[state=unchecked]:hover:before:text-wildcats-maroon data-[state=unchecked]:hover:before:opacity-30 data-[state=unchecked]:hover:before:text-xs data-[state=unchecked]:hover:before:flex data-[state=unchecked]:hover:before:items-center data-[state=unchecked]:hover:before:justify-center data-[state=unchecked]:hover:before:inset-0 relative"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="terms"
                      className="text-xs text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      By creating an account, you agree to our{' '}
                      <Link to="#" className="text-wildcats-maroon hover:text-wildcats-maroon/80 font-medium underline underline-offset-2 focus:outline-none">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="#" className="text-wildcats-maroon hover:text-wildcats-maroon/80 font-medium underline underline-offset-2 focus:outline-none">
                        Privacy Policy
                      </Link>
                      .
                    </label>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading || !agreedToTerms}
                  className="w-full h-11 bg-gradient-to-r from-wildcats-yellow to-wildcats-yellow/90 hover:from-wildcats-yellow/90 hover:to-wildcats-yellow/80 text-black font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:transform-none disabled:opacity-70 !rounded-none mt-4 focus:outline-none focus-visible:ring-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Account
                    </>
                  )}
                </Button>
              </form>

              {/* Sign In Link */}
              <div className="text-center pt-3">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link 
                    to="/login" 
                    className="font-semibold text-wildcats-maroon focus:outline-none inline-block relative transition-transform duration-150 hover:-translate-y-0.5 hover:underline hover:underline-offset-2"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthBackground>
  );
} 
