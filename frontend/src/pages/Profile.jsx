"use client"

import { useState, useEffect } from "react"
import { UserCircleIcon, Cog6ToothIcon, CheckCircleIcon, XCircleIcon, PencilIcon } from "@heroicons/react/24/outline"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Profile() {
  const { currentUser, updateProfile } = useAuth()
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    gender: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  // Initialize form data with current user info when it's available
  useEffect(() => {
    if (currentUser) {
      setFormData({
        firstname: currentUser.firstname || "",
        lastname: currentUser.lastname || "",
        email: currentUser.email || "",
        gender: currentUser.gender || "",
      })
    }
  }, [currentUser])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage({ type: '', text: '' })
    
    try {
      // Only update if we have a currentUser and an ID
      if (currentUser && currentUser.id) {
        await updateProfile(currentUser.id, {
          firstname: formData.firstname,
          lastname: formData.lastname,
          gender: formData.gender || null,
        })
        setMessage({ type: 'success', text: 'Profile updated successfully!' })
      } else {
        setMessage({ type: 'error', text: 'User information not available. Please try again later.' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Your Profile</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your personal information and account settings</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-8 border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div className="flex items-center">
                <div className="h-20 w-20 bg-maroon-100 dark:bg-maroon-900/30 rounded-full flex items-center justify-center">
                  <UserCircleIcon className="h-14 w-14 text-maroon-600 dark:text-maroon-400" />
                </div>
                <div className="ml-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {formData.firstname} {formData.lastname}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">{formData.email}</p>
                  {currentUser && (
                    <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-300">
                      {currentUser.role}
                    </span>
                  )}
                </div>
              </div>
              <Link
                to="/settings"
                className="btn-outline flex items-center justify-center space-x-2 md:self-start"
              >
                <Cog6ToothIcon className="h-5 w-5" />
                <span>Settings</span>
              </Link>
            </div>

            {message.text && (
              <div className={`mb-6 p-4 rounded-lg flex items-start space-x-3 ${
                message.type === 'success' 
                  ? 'bg-green-50 border-l-4 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-200' 
                  : 'bg-red-50 border-l-4 border-red-500 text-red-800 dark:bg-red-900/30 dark:text-red-200'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <p>{message.text}</p>
              </div>
            )}

            <form onSubmit={handleProfileSubmit}>
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <PencilIcon className="h-5 w-5 mr-2 text-maroon-600 dark:text-maroon-400" />
                  Personal Information
                </h3>
                <div className="h-px bg-gradient-to-r from-maroon-100 via-maroon-300 to-gold-200 dark:from-maroon-900/50 dark:via-maroon-800/50 dark:to-gold-900/30 mb-6"></div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="firstname"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      First Name
                    </label>
                    <input
                      type="text"
                      name="firstname"
                      id="firstname"
                      value={formData.firstname}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastname"
                      id="lastname"
                      value={formData.lastname}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender (optional)</label>
                    <select
                      name="gender"
                      id="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="form-input"
                    >
                      <option value="">Prefer not to say</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="form-input bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                      disabled
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Email cannot be changed. Contact support if you need to update your email.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className={`btn-primary ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Cog6ToothIcon className="h-5 w-5 mr-2 text-maroon-600 dark:text-maroon-400" />
              Account Management
            </h3>
            <div className="h-px bg-gradient-to-r from-maroon-100 via-maroon-300 to-gold-200 dark:from-maroon-900/50 dark:via-maroon-800/50 dark:to-gold-900/30 mb-6"></div>
            
            <div className="bg-wildcats-accent dark:bg-gray-700/30 rounded-lg p-6 text-center mb-6">
              <p className="text-gray-800 dark:text-gray-200 mb-4">
                Need to change your password or update notification preferences? Visit the settings page.
              </p>
              <Link
                to="/settings"
                className="btn-secondary inline-flex items-center"
              >
                <Cog6ToothIcon className="h-5 w-5 mr-2" />
                Go to Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

