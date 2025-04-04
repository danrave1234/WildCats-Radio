"use client"

import { useState, useEffect } from "react"
import { UserCircleIcon, Cog6ToothIcon } from "@heroicons/react/24/solid"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Profile() {
  const { currentUser, updateProfile } = useAuth()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  // Initialize form data with current user info when it's available
  useEffect(() => {
    if (currentUser) {
      setFormData({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        email: currentUser.email || "",
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
          firstName: formData.firstName,
          lastName: formData.lastName
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
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Your Profile</h1>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <UserCircleIcon className="h-16 w-16 text-gray-400 dark:text-gray-300" />
                  <div className="ml-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {formData.firstName} {formData.lastName}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">{formData.email}</p>
                    {currentUser && <p className="text-xs text-maroon-600 dark:text-maroon-400 mt-1">Role: {currentUser.role}</p>}
                  </div>
                </div>
                <Link
                    to="/settings"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-maroon-700 bg-maroon-100 hover:bg-maroon-200 dark:bg-maroon-900/30 dark:text-yellow-400 dark:hover:bg-maroon-900/50"
                >
                  <Cog6ToothIcon className="h-5 w-5 mr-2" />
                  Settings
                </Link>
              </div>

              {message.text && (
                <div className={`mb-4 p-3 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'}`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleProfileSubmit}>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-6">
                  <div>
                    <label
                        htmlFor="firstName"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      First Name
                    </label>
                    <input
                        type="text"
                        name="firstName"
                        id="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name
                    </label>
                    <input
                        type="text"
                        name="lastName"
                        id="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    />
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
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                        disabled
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Email cannot be changed. Contact support if you need to update your email.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                      type="submit"
                      className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-maroon-700 hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                      disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                Account Management
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Need to change your password or update notification preferences? Visit the settings page.
              </p>
              <div className="flex justify-center">
                <Link
                    to="/settings"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-maroon-700 hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600"
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

