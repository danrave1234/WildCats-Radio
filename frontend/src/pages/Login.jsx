"use client"

import { useState } from "react"
import { RadioIcon } from "@heroicons/react/24/outline"

// Add default props at the beginning of the component
export default function Login({
                                onLogin = () => {},
                                testCredentials = {
                                  admin: { email: "admin@example.com", password: "admin123" },
                                  dj: { email: "dj@example.com", password: "dj123" },
                                  listener: { email: "listener@example.com", password: "listener123" },
                                },
                              }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  // Add safety checks in the handleSubmit function
  const handleSubmit = (e) => {
    e.preventDefault()
    setError("")

    // In a real app, you would validate credentials against your backend
    // For demo purposes, we'll use hardcoded credentials
    if (
        testCredentials &&
        testCredentials.admin &&
        formData.email === testCredentials.admin.email &&
        formData.password === testCredentials.admin.password
    ) {
      onLogin("ADMIN")
    } else if (
        testCredentials &&
        testCredentials.dj &&
        formData.email === testCredentials.dj.email &&
        formData.password === testCredentials.dj.password
    ) {
      onLogin("DJ")
    } else if (
        testCredentials &&
        testCredentials.listener &&
        formData.email === testCredentials.listener.email &&
        formData.password === testCredentials.listener.password
    ) {
      onLogin("LISTENER")
    } else {
      setError("Invalid email or password")
    }
  }

  // Update the fillTestCredentials function to safely handle missing testCredentials
  const fillTestCredentials = (role) => {
    if (testCredentials && testCredentials[role]) {
      setFormData({
        email: testCredentials[role].email || "",
        password: testCredentials[role].password || "",
      })
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

            {error && (
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
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">{error}</h3>
                    </div>
                  </div>
                </div>
            )}

            <div>
              <button
                  type="submit"
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-maroon-700 hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600"
              >
                Sign in
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">Test Accounts</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              {testCredentials && testCredentials.admin && (
                  <button
                      type="button"
                      onClick={() => fillTestCredentials("admin")}
                      className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-yellow-50 dark:hover:bg-maroon-900/50"
                  >
                    <span>Admin: {testCredentials.admin.email}</span>
                  </button>
              )}
              {testCredentials && testCredentials.dj && (
                  <button
                      type="button"
                      onClick={() => fillTestCredentials("dj")}
                      className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-yellow-50 dark:hover:bg-maroon-900/50"
                  >
                    <span>DJ: {testCredentials.dj.email}</span>
                  </button>
              )}
              {testCredentials && testCredentials.listener && (
                  <button
                      type="button"
                      onClick={() => fillTestCredentials("listener")}
                      className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-yellow-50 dark:hover:bg-maroon-900/50"
                  >
                    <span>Listener: {testCredentials.listener.email}</span>
                  </button>
              )}
            </div>

            <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
              <p>Click on a test account to auto-fill credentials</p>
              <p className="mt-1">Password will be auto-filled when you click a test account</p>
            </div>
          </div>
        </div>
      </div>
  )
}

