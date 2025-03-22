"use client"

import { useState, useEffect } from "react"
import {
  CalendarDaysIcon,
  ViewColumnsIcon,
  ClockIcon,
  UserIcon,
  MicrophoneIcon,
  CalendarIcon,
  InformationCircleIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline"

export default function Schedule() {
  const [viewType, setViewType] = useState("calendar") // 'calendar' or 'list'
  const [userRole, setUserRole] = useState("LISTENER") // In a real app, this would come from auth state
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [selectedBroadcast, setSelectedBroadcast] = useState(null)
  const [showBroadcastDetails, setShowBroadcastDetails] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Mock data for upcoming broadcasts
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState([
    {
      id: 1,
      title: "Morning Show with DJ Smith",
      description: "Wake up with the latest hits and campus news!",
      dj: "Alex Smith",
      date: "2025-03-05",
      startTime: "10:00 AM",
      endTime: "12:00 PM",
      details: "Will be playing top 40 hits and taking requests. Special segment on campus events at 11:00 AM.",
    },
    {
      id: 2,
      title: "Afternoon Chill",
      description: "Relax with smooth beats and minimal talk.",
      dj: "Jamie Chen",
      date: "2025-03-05",
      startTime: "2:00 PM",
      endTime: "4:00 PM",
      details: "Lo-fi and chill beats. Will feature a 30-minute deep focus mix at 3:00 PM.",
    },
    {
      id: 3,
      title: "Evening Sports Talk",
      description: "Discussing the latest in college sports.",
      dj: "Chris Johnson",
      date: "2025-03-06",
      startTime: "6:00 PM",
      endTime: "8:00 PM",
      details: "Covering the basketball tournament and taking calls from listeners about predictions.",
    },
    {
      id: 4,
      title: "Late Night Study Beats",
      description: "Focus music to help you study through the night.",
      dj: "Taylor Wong",
      date: "2025-03-07",
      startTime: "10:00 PM",
      endTime: "1:00 AM",
      details: "Three hours of uninterrupted instrumental music. Perfect for late-night study sessions.",
    },
  ])

  // Broadcast details form state
  const [broadcastDetails, setBroadcastDetails] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    details: "",
  })

  // Check user role (in a real app, this would be from authentication)
  useEffect(() => {
    // Mock check - in a real app, this would come from your auth system
    const checkUserRole = async () => {
      // Simulate API call
      setTimeout(() => {
        // Get role from localStorage (set during login)
        const role = localStorage.getItem("userRole") || "LISTENER"
        setUserRole(role)
      }, 500)
    }

    checkUserRole()
  }, [])

  // Check if user can schedule broadcasts (admin or DJ)
  const canScheduleBroadcasts = userRole === "ADMIN" || userRole === "DJ"

  // Group broadcasts by date for calendar view
  const broadcastsByDate = upcomingBroadcasts.reduce((acc, broadcast) => {
    if (!acc[broadcast.date]) {
      acc[broadcast.date] = []
    }
    acc[broadcast.date].push(broadcast)
    return acc
  }, {})

  // Handle form changes
  const handleBroadcastDetailsChange = (e) => {
    const { name, value } = e.target
    setBroadcastDetails((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  // Handle broadcast details submission
  const handleBroadcastScheduleSubmit = (e) => {
    e.preventDefault()

    // Create a new broadcast with a unique ID
    const newBroadcast = {
      ...broadcastDetails,
      id: Date.now(), // Use timestamp as a simple unique ID
      dj: userRole === "DJ" ? "You (DJ)" : "Admin", // In a real app, this would be the current user's name
    }

    // Add to the list of broadcasts
    setUpcomingBroadcasts([...upcomingBroadcasts, newBroadcast])

    // Reset the form
    setBroadcastDetails({
      title: "",
      description: "",
      date: "",
      startTime: "",
      endTime: "",
      details: "",
    })

    // Close the form
    setShowScheduleForm(false)

    // In a real app, you would send this to your backend
    console.log("Scheduled broadcast:", newBroadcast)
    alert("Broadcast scheduled successfully!")
  }

  // Handle viewing broadcast details
  const handleViewBroadcastDetails = (broadcast) => {
    setSelectedBroadcast(broadcast)
    setShowBroadcastDetails(true)
  }

  // Calendar navigation functions
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    // Get first day of month and last day of month
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    // Get day of week for first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDayOfMonth.getDay()

    // Calculate days from previous month to show
    const daysFromPrevMonth = firstDayOfWeek

    // Calculate total days to show (including days from prev/next month)
    const totalDays = 42 // 6 rows of 7 days

    // Generate array of day objects
    const days = []

    // Add days from previous month
    const prevMonth = new Date(year, month, 0)
    const prevMonthDays = prevMonth.getDate()

    for (let i = prevMonthDays - daysFromPrevMonth + 1; i <= prevMonthDays; i++) {
      days.push({
        date: new Date(year, month - 1, i),
        isCurrentMonth: false,
        broadcasts: [],
      })
    }

    // Add days from current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const date = new Date(year, month, i)
      const dateString = date.toISOString().split("T")[0]

      days.push({
        date,
        isCurrentMonth: true,
        broadcasts: broadcastsByDate[dateString] || [],
      })
    }

    // Add days from next month to fill the grid
    const remainingDays = totalDays - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        broadcasts: [],
      })
    }

    return days
  }

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })
  }

  // Check if a date is today
  const isToday = (date) => {
    const today = new Date()
    return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    )
  }

  // Get calendar days
  const calendarDays = generateCalendarDays()

  return (
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Broadcast Schedule</h1>

            <div className="flex items-center space-x-4">
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                    type="button"
                    onClick={() => setViewType("calendar")}
                    className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                        viewType === "calendar"
                            ? "bg-maroon-700 text-white border-maroon-700"
                            : "bg-white text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    }`}
                >
                  <CalendarDaysIcon className="h-5 w-5 inline mr-1" />
                  Calendar
                </button>
                <button
                    type="button"
                    onClick={() => setViewType("list")}
                    className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${
                        viewType === "list"
                            ? "bg-maroon-700 text-white border-maroon-700"
                            : "bg-white text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    }`}
                >
                  <ViewColumnsIcon className="h-5 w-5 inline mr-1" />
                  List
                </button>
              </div>

              {canScheduleBroadcasts && (
                  <button
                      onClick={() => setShowScheduleForm(!showScheduleForm)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center"
                  >
                    <CalendarIcon className="h-5 w-5 mr-1" />
                    {showScheduleForm ? "Cancel" : "Schedule Broadcast"}
                  </button>
              )}
            </div>
          </div>

          {/* DJ/Admin Broadcast Scheduling Form */}
          {canScheduleBroadcasts && showScheduleForm && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                    Schedule New Broadcast
                  </h2>

                  <form onSubmit={handleBroadcastScheduleSubmit}>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Broadcast Title
                        </label>
                        <input
                            type="text"
                            name="title"
                            id="title"
                            value={broadcastDetails.title}
                            onChange={handleBroadcastDetailsChange}
                            required
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label
                            htmlFor="description"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Description
                        </label>
                        <textarea
                            name="description"
                            id="description"
                            rows="3"
                            value={broadcastDetails.description}
                            onChange={handleBroadcastDetailsChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                        ></textarea>
                      </div>
                      <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Date
                        </label>
                        <input
                            type="date"
                            name="date"
                            id="date"
                            value={broadcastDetails.date}
                            onChange={handleBroadcastDetailsChange}
                            required
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                        />
                      </div>
                      <div>
                        <label
                            htmlFor="startTime"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Start Time
                        </label>
                        <input
                            type="time"
                            name="startTime"
                            id="startTime"
                            value={broadcastDetails.startTime}
                            onChange={handleBroadcastDetailsChange}
                            required
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                        />
                      </div>
                      <div>
                        <label
                            htmlFor="endTime"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          End Time
                        </label>
                        <input
                            type="time"
                            name="endTime"
                            id="endTime"
                            value={broadcastDetails.endTime}
                            onChange={handleBroadcastDetailsChange}
                            required
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label
                            htmlFor="details"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Broadcast Details (Only visible to DJs and Admins)
                        </label>
                        <textarea
                            name="details"
                            id="details"
                            rows="3"
                            value={broadcastDetails.details}
                            onChange={handleBroadcastDetailsChange}
                            placeholder="Add any additional details about the broadcast that only DJs and admins should see"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                        ></textarea>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                          type="submit"
                          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-maroon-700 hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600"
                      >
                        <CalendarIcon className="h-5 w-5 mr-1" />
                        Schedule Broadcast
                      </button>
                    </div>
                  </form>
                </div>
              </div>
          )}

          {/* Broadcast Details Modal */}
          {showBroadcastDetails && selectedBroadcast && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{selectedBroadcast.title}</h2>
                      <button
                          onClick={() => setShowBroadcastDetails(false)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <p className="text-gray-700 dark:text-gray-300">{selectedBroadcast.description}</p>

                      <div className="flex flex-wrap text-sm text-gray-600 dark:text-gray-300">
                        <div className="mr-4 mb-2 flex items-center">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {selectedBroadcast.startTime} - {selectedBroadcast.endTime}
                        </div>
                        <div className="mr-4 mb-2 flex items-center">
                          <UserIcon className="h-4 w-4 mr-1" />
                          {selectedBroadcast.dj}
                        </div>
                        <div className="mr-4 mb-2 flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          {new Date(selectedBroadcast.date).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>
                      </div>

                      {/* DJ/Admin-only details */}
                      {canScheduleBroadcasts && selectedBroadcast.details && (
                          <div className="mt-4 p-4 bg-maroon-50 dark:bg-maroon-900/30 rounded-lg">
                            <h3 className="text-md font-medium text-maroon-800 dark:text-yellow-400 flex items-center mb-2">
                              <InformationCircleIcon className="h-5 w-5 mr-1" />
                              Broadcast Details (Staff Only)
                            </h3>
                            <p className="text-maroon-700 dark:text-yellow-300">{selectedBroadcast.details}</p>
                          </div>
                      )}
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                          onClick={() => setShowBroadcastDetails(false)}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {viewType === "calendar" ? (
              // Calendar View - Redesigned
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                {/* Calendar Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{formatDate(currentMonth)}</h2>
                  <div className="flex space-x-2">
                    <button
                        onClick={goToPreviousMonth}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <svg
                          className="h-5 w-5 text-gray-600 dark:text-gray-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                        onClick={goToToday}
                        className="px-3 py-1 text-sm bg-maroon-100 text-maroon-700 rounded-md hover:bg-maroon-200 dark:bg-maroon-900/30 dark:text-yellow-400 dark:hover:bg-maroon-900/50"
                    >
                      Today
                    </button>
                    <button onClick={goToNextMonth} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                      <svg
                          className="h-5 w-5 text-gray-600 dark:text-gray-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="p-4">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                          {day}
                        </div>
                    ))}
                  </div>

                  {/* Calendar days */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => (
                        <div
                            key={index}
                            className={`min-h-[100px] border rounded-md p-1 ${
                                day.isCurrentMonth
                                    ? isToday(day.date)
                                        ? "bg-maroon-50 border-maroon-200 dark:bg-maroon-900/30 dark:border-maroon-800"
                                        : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                                    : "bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-900/30 dark:border-gray-800 dark:text-gray-600"
                            }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                      <span
                          className={`text-sm font-medium ${
                              isToday(day.date)
                                  ? "text-maroon-700 dark:text-yellow-400"
                                  : day.isCurrentMonth
                                      ? "text-gray-900 dark:text-white"
                                      : "text-gray-400 dark:text-gray-600"
                          }`}
                      >
                        {day.date.getDate()}
                      </span>
                            {canScheduleBroadcasts && day.isCurrentMonth && (
                                <button
                                    onClick={() => {
                                      const dateStr = day.date.toISOString().split("T")[0]
                                      setBroadcastDetails((prev) => ({
                                        ...prev,
                                        date: dateStr,
                                      }))
                                      setShowScheduleForm(true)
                                    }}
                                    className="text-maroon-600 hover:text-maroon-800 dark:text-yellow-400 dark:hover:text-yellow-300"
                                    title="Schedule broadcast"
                                >
                                  <PlusCircleIcon className="h-4 w-4" />
                                </button>
                            )}
                          </div>

                          {/* Broadcasts for this day */}
                          <div className="space-y-1 overflow-y-auto max-h-[80px]">
                            {day.broadcasts.map((broadcast) => (
                                <div
                                    key={broadcast.id}
                                    onClick={() => handleViewBroadcastDetails(broadcast)}
                                    className="text-xs p-1 rounded bg-maroon-100 text-maroon-800 dark:bg-maroon-900/50 dark:text-yellow-300 cursor-pointer hover:bg-maroon-200 dark:hover:bg-maroon-900/70 truncate"
                                    title={broadcast.title}
                                >
                                  <div className="font-medium truncate">{broadcast.title}</div>
                                  <div className="text-xs text-maroon-700 dark:text-yellow-400">{broadcast.startTime}</div>
                                </div>
                            ))}
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              </div>
          ) : (
              // List View - Keep as is
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {upcomingBroadcasts.map((broadcast) => (
                      <li
                          key={broadcast.id}
                          className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => handleViewBroadcastDetails(broadcast)}
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0 pt-1">
                            <MicrophoneIcon className="h-6 w-6 text-maroon-600 dark:text-yellow-400" />
                          </div>
                          <div className="ml-4 flex-1">
                            <div className="flex justify-between">
                              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{broadcast.title}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(broadcast.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{broadcast.description}</p>
                            <div className="mt-2 flex items-center text-sm text-gray-600 dark:text-gray-300">
                              <ClockIcon className="h-4 w-4 mr-1" />
                              <span>
                          {broadcast.startTime} - {broadcast.endTime}
                        </span>
                              <span className="mx-2">•</span>
                              <UserIcon className="h-4 w-4 mr-1" />
                              <span>{broadcast.dj}</span>
                              {canScheduleBroadcasts && broadcast.details && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-maroon-100 text-maroon-800 dark:bg-maroon-900/50 dark:text-yellow-300">
                              <InformationCircleIcon className="h-3 w-3 mr-1" />
                              Staff Details
                            </span>
                                  </>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                  ))}
                </ul>
              </div>
          )}
        </div>
      </div>
  )
}

