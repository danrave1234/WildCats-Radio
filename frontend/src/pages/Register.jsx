"use client"

import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"
import wildcatRadioLogo from "../assets/wildcatradio_logo.png"
import { Separator } from "@/components/ui/separator"

export default function Register() {
  const { register, loading, error: authError } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    confirmPassword: "",
    birthdate: "",
  })
  const [error, setError] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

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
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-muted/40 to-muted text-foreground dark:from-slate-800 dark:via-slate-700/60 dark:to-slate-600 overflow-y-auto">
      <div className="w-full flex flex-col items-center justify-start min-h-screen p-4 py-6 sm:py-8 relative">
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
          <div className="text-center mb-3 sm:mb-4 px-4">
            <p className="text-sm text-gray-600 uppercase tracking-wider max-w-sm mx-auto font-semibold">
              Join the WildCat Radio community
            </p>
          </div>

          <Card className="border border-border shadow bg-white dark:bg-slate-700 text-card-foreground overflow-hidden !rounded-none animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ease-out">
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
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Name Fields Row */}
                <div className="grid grid-cols-2 gap-3">
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
                <div className="flex items-start space-x-2.5 pt-1">
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
    </div>
  );
} 
