"use client"

import { useState } from "react"
import { XCircleIcon } from "@heroicons/react/24/outline"
import { useAuth } from "../context/AuthContext"
import { Link, useNavigate } from "react-router-dom"
import wildcatRadioLogo from "../assets/wildcatradio_logo.png"
import icHide from "../assets/ic_hide.png"
import icUnhide from "../assets/ic_unhide.png"

export default function Register() {
  const { register, loading, error: authError } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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

  // Toggle confirm password visibility
  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword)
  }

  // Handle form submission with backend integration
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    // Validate email is from cit.edu domain
    if (!formData.email.endsWith('@cit.edu')) {
      setError('Only cit.edu email addresses are allowed to register')
      return
    }

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
    <div className="min-h-screen flex items-center justify-center bg-[#E9ECEC] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white shadow-xl rounded-lg overflow-hidden">
        <div className="p-8 flex flex-col items-center">
          <img 
            src={wildcatRadioLogo} 
            alt="WildCat Radio Logo" 
            className="h-28 mb-6"
          />
          
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-1">
            Create an Account
          </h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            Join the WildCats Radio community
          </p>

          <form className="w-full" onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#91403E] focus:border-[#91403E]"
                placeholder="First name"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="lastname" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                id="lastname"
                name="lastname"
                type="text"
                autoComplete="family-name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#91403E] focus:border-[#91403E]"
                placeholder="Last name"
              />
            </div>
            
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
              <p className="mt-1 text-xs text-gray-500">
                Only cit.edu email addresses are allowed
              </p>
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
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#91403E] focus:border-[#91403E]"
                  placeholder="Create a password"
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
            
            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#91403E] focus:border-[#91403E]"
                  placeholder="Confirm your password"
                />
                <button 
                  type="button" 
                  onClick={toggleConfirmPasswordVisibility}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  <img 
                    src={showConfirmPassword ? icHide : icUnhide} 
                    alt={showConfirmPassword ? "Hide password" : "Show password"} 
                    className="h-5 w-5 opacity-70"
                  />
                </button>
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
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <p className="mt-6 text-center text-xs text-gray-600">
              By signing up, you agree to our <a href="#" className="text-[#91403E]">Terms of Service</a> and <a href="#" className="text-[#91403E]">Privacy Policy</a>
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account? <Link to="/login" className="font-medium text-[#91403E] hover:text-[#91403E]/80">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
} 
