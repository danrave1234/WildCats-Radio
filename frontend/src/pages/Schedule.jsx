"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import SEO from '../components/SEO';
import {
  CalendarDaysIcon,
  ViewColumnsIcon,
  ClockIcon,
  UserIcon,
  MicrophoneIcon,
  CalendarIcon,
  InformationCircleIcon,
  PlusCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { broadcastService } from "../services/api/index.js" // Import the broadcast service
import { useAuth } from "../context/AuthContext";
import Toast from "../components/Toast" // Import Toast component
import { DateSelector, TimeSelector } from "../components/DateTimeSelector" // Import our custom date/time selectors
import { createLogger } from '../services/logger';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';

const logger = createLogger('Schedule');

// Helper to parse backend timestamp (treat backend LocalDateTime as local time)
const parseBackendTimestamp = (timestamp) => {
  if (!timestamp) return null;
  return parseISO(timestamp);
};

// Format a HH:mm string to 12-hour display (e.g., 09:30 PM)
const formatTimeTo12h = (timeString) => {
  if (!timeString || !/^(\d{2}):(\d{2})$/.test(timeString)) return timeString || '';
  const [hourStr, minuteStr] = timeString.split(':');
  const dateObj = new Date(2000, 0, 1, Number(hourStr), Number(minuteStr), 0);
  return format(dateObj, 'hh:mm a');
};

// Parse 12-hour format (e.g., "09:30 AM") back to 24-hour format (e.g., "09:30")
const parse12hTo24h = (time12h) => {
  if (!time12h) return '';

  // If already in 24-hour format (HH:mm), return as-is
  if (/^(\d{2}):(\d{2})$/.test(time12h)) return time12h;

  // If in 12-hour format (hh:mm a), convert to 24-hour
  if (/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i.test(time12h)) {
    const [time, period] = time12h.split(/\s+/);
    let [hours, minutes] = time.split(':').map(Number);

    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return time12h; // Return as-is if format not recognized
};

export default function Schedule() {
  const [viewType, setViewType] = useState("calendar") // 'calendar' or 'list'
  const location = useLocation()
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [selectedBroadcast, setSelectedBroadcast] = useState(null)
  const [showBroadcastDetails, setShowBroadcastDetails] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false) // Loading state for API calls
  const [isEditMode, setIsEditMode] = useState(false) // Whether we're editing or creating
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false) // Confirmation modal for delete
  const [showReviewStep, setShowReviewStep] = useState(false) // Review step in modal
  const { currentUser } = useAuth()

  // Toast notification state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' })

  // Broadcasts data - fetched from API
  const [upcomingBroadcasts, setUpcomingBroadcasts] = useState([])

  // Broadcast details form state
  const [broadcastDetails, setBroadcastDetails] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    details: "",
  })

  // Function to enter edit mode with a selected broadcast
  const handleEditBroadcast = (broadcast) => {
    // Populate form with the broadcast details
    // Convert 12-hour display format back to 24-hour form format
    setBroadcastDetails({
      id: broadcast.id,
      title: broadcast.title,
      description: broadcast.description,
      date: broadcast.date,
      startTime: parse12hTo24h(broadcast.startTime),
      endTime: parse12hTo24h(broadcast.endTime),
      details: broadcast.details || '',
    })

    // Set edit mode and show form
    setIsEditMode(true)
    setShowScheduleForm(true)
    setShowBroadcastDetails(false)
  }

  // Function to handle deletion of a broadcast
  const handleDeleteBroadcast = (broadcast) => {
    setSelectedBroadcast(broadcast)
    setIsDeleteConfirmOpen(true)
    setShowBroadcastDetails(false)
  }

  // Function to reset form to creation mode
  const resetToCreateMode = () => {
    setBroadcastDetails({
      title: "",
      description: "",
      date: "",
      startTime: "",
      endTime: "",
      details: "",
    })
    setIsEditMode(false)
  }

  // Function to handle cancel of form
  const handleCancelForm = () => {
    setShowScheduleForm(false)
    resetToCreateMode()
  }

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type })
  }

  // Helper function to format local date/time as ISO string without timezone conversion
  const formatLocalTimeAsISO = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`
  }

// no-op: role is derived from AuthContext

  // Helper function to get minimum allowed date (today) - using local date components to avoid timezone issues
  const getMinDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Helper function to get minimum allowed time for today
  const getMinTime = () => {
    const now = new Date()
    // If the selected date is today, minimum time is current time + 2 minutes
    if (broadcastDetails.date === getMinDate()) {
      const minTime = new Date(now.getTime() + 2 * 60 * 1000) // 2 minutes from now
      return minTime.toTimeString().slice(0, 5) // HH:MM format
    }
    return "00:00" // If future date, any time is allowed
  }

  // Helper function to validate time input in real-time
  const validateTimeInput = (time, fieldName) => {
    if (!broadcastDetails.date || !time) return true

    // Use proper date construction to avoid timezone issues
    const [year, month, day] = broadcastDetails.date.split('-').map(Number)
    const [hour, minute] = time.split(':').map(Number)
    const selectedDateTime = new Date(year, month - 1, day, hour, minute, 0)
    
    const now = new Date()
    const minAllowedTime = new Date(now.getTime() + 60 * 1000) // 1 minute buffer

    if (selectedDateTime < minAllowedTime) {
      return false
    }
    return true
  }

  // Check if selected date is in the past
  const isSelectedDateInPast = () => {
    if (!broadcastDetails.date) return false
    const todayStr = getMinDate()
    return broadcastDetails.date < todayStr
  }

  // Helper function to check if end time is after start time
  const isEndTimeAfterStartTime = () => {
    if (!broadcastDetails.date || !broadcastDetails.startTime || !broadcastDetails.endTime) {
      return true // Don't show error if any field is empty
    }
    
    const [year, month, day] = broadcastDetails.date.split('-').map(Number)
    const [startHour, startMinute] = broadcastDetails.startTime.split(':').map(Number)
    const [endHour, endMinute] = broadcastDetails.endTime.split(':').map(Number)
    
    const startTime = new Date(year, month - 1, day, startHour, startMinute, 0)
    const endTime = new Date(year, month - 1, day, endHour, endMinute, 0)
    
    return endTime > startTime
  }

  // Helper to get minimum end time (1 hour after start time if start time is set)
  const getMinEndTimeForStartTime = () => {
    if (!broadcastDetails.startTime) {
      // If no start time, use same logic as start time min
      return broadcastDetails.date && !isSelectedDateInPast() ? getMinStartTimeForSelectedDate() : undefined
    }
    
    // Calculate 1 hour after start time
    const [startHour, startMinute] = broadcastDetails.startTime.split(':').map(Number)
    let newHour = startHour + 1
    const newMinute = startMinute
    
    if (newHour >= 24) return ALLOWED_END // Can't exceed 24 hours, use max allowed
    
    const oneHourAfter = `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`
    
    // If 1 hour after exceeds allowed end, use allowed end
    if (compareTimes(oneHourAfter, ALLOWED_END) > 0) {
      return ALLOWED_END
    }
    
    return oneHourAfter
  }

  // Allowed scheduling window: 07:00 - 22:00 (server-enforced)
  const ALLOWED_START = "07:00"
  const ALLOWED_END = "22:00"

  const compareTimes = (a, b) => {
    // a, b in HH:MM
    const [ah, am] = (a || '00:00').split(':').map(Number)
    const [bh, bm] = (b || '00:00').split(':').map(Number)
    const aMin = ah * 60 + am
    const bMin = bh * 60 + bm
    return aMin - bMin // >0 means a>b
  }

  const isWithinAllowedHours = () => {
    const s = broadcastDetails.startTime
    const e = broadcastDetails.endTime
    if (!s || !e) return false
    if (compareTimes(s, ALLOWED_START) < 0) return false
    if (compareTimes(e, ALLOWED_END) > 0) return false
    return true
  }

  // Dynamic min for start time considering today buffer vs 06:00
  const getMinStartTimeForSelectedDate = () => {
    const todayStr = getMinDate()
    let minCandidate = ALLOWED_START
    if (broadcastDetails.date === todayStr) {
      const minNow = getMinTime() // e.g., 13:07
      minCandidate = compareTimes(minNow, ALLOWED_START) > 0 ? minNow : ALLOWED_START
    }
    // Guard: never let min exceed ALLOWED_END to avoid empty dropdown
    if (compareTimes(minCandidate, ALLOWED_END) > 0) return ALLOWED_END
    return minCandidate
  }

  // Convenience helpers for review summary
  const calculateDuration = () => {
    if (!broadcastDetails.startTime || !broadcastDetails.endTime) return ""
    const [sh, sm] = broadcastDetails.startTime.split(':').map(Number)
    const [eh, em] = broadcastDetails.endTime.split(':').map(Number)
    const diff = (eh * 60 + em) - (sh * 60 + sm)
    if (diff <= 0) return ""
    const h = Math.floor(diff / 60)
    const m = diff % 60
    if (h === 0) return `${m} minute${m !== 1 ? 's' : ''}`
    if (m === 0) return `${h} hour${h !== 1 ? 's' : ''}`
    return `${h} hour${h !== 1 ? 's' : ''} ${m} minute${m !== 1 ? 's' : ''}`
  }

  const formatDateWithDay = (dateStr) => {
    if (!dateStr) return ""
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const isFormValid = () => {
    if (!broadcastDetails.title?.trim()) return false
    if (!broadcastDetails.description?.trim()) return false
    if (!broadcastDetails.date || !broadcastDetails.startTime || !broadcastDetails.endTime) return false
    if (isSelectedDateInPast()) return false // Prevent submission for past dates
    if (!isEndTimeAfterStartTime()) return false
    if (!validateTimeInput(broadcastDetails.startTime, 'startTime')) return false
    if (!isWithinAllowedHours()) return false
    // Duration constraints: 15 minutes to 8 hours
    const [sh, sm] = broadcastDetails.startTime.split(':').map(Number)
    const [eh, em] = broadcastDetails.endTime.split(':').map(Number)
    const diff = (eh * 60 + em) - (sh * 60 + sm)
    if (diff < 15) return false
    if (diff > 8 * 60) return false
    return true
  }

  const handleReviewStep = () => {
    if (!isFormValid()) {
      if (isSelectedDateInPast()) {
        showToast("Cannot schedule broadcasts for past dates. Please select today or a future date.", "error")
      } else {
        showToast("Please complete all required fields and ensure time is valid (6:00 AM to 10:00 PM)", "error")
      }
      return
    }
    setShowReviewStep(true)
  }

  const handleBackToEdit = () => {
    setShowReviewStep(false)
  }

  // Fetch upcoming broadcasts
  useEffect(() => {
    const fetchUpcomingBroadcasts = async () => {
      try {
        setIsLoading(true)
        const response = await broadcastService.getUpcoming()

        // Transform the data to match our expected format
        const broadcasts = response.data.map(broadcast => {
          // Parse the ISO datetime strings from backend - these are in UTC
          const startDateTime = parseBackendTimestamp(broadcast.scheduledStart)
          const endDateTime = parseBackendTimestamp(broadcast.scheduledEnd)

          // For display purposes, extract the local time components
          // This preserves the intended time in the user's timezone
          const dateStr = broadcast.scheduledStart.split('T')[0]
          
          // Format times in local timezone for display (12-hour format)
          const startTime = startDateTime ? formatInTimeZone(startDateTime, 'Asia/Manila', 'hh:mm a') : ''
          const endTime = endDateTime ? formatInTimeZone(endDateTime, 'Asia/Manila', 'hh:mm a') : ''

          const createdBy = broadcast.createdBy || {};
          const createdByFullName = [createdBy.firstname, createdBy.lastname].filter(Boolean).join(' ').trim();

          return {
            id: broadcast.id,
            title: broadcast.title,
            description: broadcast.description,
            date: dateStr,
            startTime: startTime,
            endTime: endTime,
            dj: (broadcast.createdByName || createdBy.name || createdByFullName || '').trim() || 'Unknown DJ',
            details: broadcast.details || ''
          }
        })

        setUpcomingBroadcasts(broadcasts)
      } catch (error) {
        logger.error("Error fetching upcoming broadcasts:", error)
        showToast("Failed to load broadcasts", "error")
      } finally {
        setIsLoading(false)
      }
    }

    fetchUpcomingBroadcasts()
    // No auto-polling; user can refresh page or navigate
    return () => {}
  }, [])

// Check if user can schedule broadcasts (DJ, Moderator, or Admin)
const canScheduleBroadcasts = !!currentUser && (
  currentUser.role === "ADMIN" ||
  currentUser.role === "DJ" ||
  currentUser.role === "MODERATOR"
)

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
  const handleBroadcastScheduleSubmit = async (e) => {
    try { if (e && typeof e.preventDefault === 'function') e.preventDefault() } catch (_) {}

    try {
      setIsLoading(true)

      // Validate that the selected date/time is not in the past
      const now = new Date()
      
      // Use the same date construction method as for the API to ensure consistency
      const [validateYear, validateMonth, validateDay] = broadcastDetails.date.split('-').map(Number)
      const [validateStartHour, validateStartMinute] = broadcastDetails.startTime.split(':').map(Number)
      const [validateEndHour, validateEndMinute] = broadcastDetails.endTime.split(':').map(Number)
      
      const selectedStart = new Date(validateYear, validateMonth - 1, validateDay, validateStartHour, validateStartMinute, 0)
      const selectedEnd = new Date(validateYear, validateMonth - 1, validateDay, validateEndHour, validateEndMinute, 0)

      // Check if start time is in the past (with 1 minute buffer)
      const minAllowedTime = new Date(now.getTime() + 60 * 1000) // 1 minute from now
      if (selectedStart < minAllowedTime) {
        showToast("Start time cannot be in the past. Please select a future time.", "error")
        return
      }

      // Check if end time is before start time
      if (selectedEnd <= selectedStart) {
        showToast("End time must be after start time.", "error")
        return
      }

      // Check if the duration is reasonable (at least 15 minutes, max 8 hours)
      const durationMs = selectedEnd - selectedStart
      const durationMinutes = durationMs / (1000 * 60)
      if (durationMinutes < 15) {
        showToast("Broadcast duration must be at least 15 minutes.", "error")
        return
      }
      if (durationMinutes > 8 * 60) {
        showToast("Broadcast duration cannot exceed 8 hours.", "error")
        return
      }

      // Format the date and time for the API
      const date = broadcastDetails.date

      // Fix timezone issue: Instead of using template literals which cause timezone conversion,
      // construct dates using the Date constructor with explicit values to avoid UTC conversion
      const [year, month, day] = date.split('-').map(Number)
      const [startHour, startMinute] = broadcastDetails.startTime.split(':').map(Number)
      const [endHour, endMinute] = broadcastDetails.endTime.split(':').map(Number)

      // Create date objects in local timezone
      const startDateTime = new Date(year, month - 1, day, startHour, startMinute, 0)
      const endDateTime = new Date(year, month - 1, day, endHour, endMinute, 0)

      // Create the request payload - use local time instead of UTC
      const broadcastData = {
        title: broadcastDetails.title,
        description: broadcastDetails.description,
        scheduledStart: formatLocalTimeAsISO(startDateTime),
        scheduledEnd: formatLocalTimeAsISO(endDateTime),
        details: broadcastDetails.details
      }

      logger.info("Schedule: Creating broadcast with Philippines local time:", {
        userSelectedDate: broadcastDetails.date,
        userSelectedStart: broadcastDetails.startTime,
        userSelectedEnd: broadcastDetails.endTime,
        localStart: startDateTime.toLocaleString('en-PH'),
        localEnd: endDateTime.toLocaleString('en-PH'),
        sentStart: broadcastData.scheduledStart,
        sentEnd: broadcastData.scheduledEnd
      })

      if (isEditMode) {
        await broadcastService.update(broadcastDetails.id, broadcastData)
      } else {
        await broadcastService.create(broadcastData)
      }

      // Refresh upcoming broadcasts from server to avoid stale data
      try {
        const refreshed = await broadcastService.getUpcoming()
        const broadcasts = refreshed.data.map(b => {
          const startDateTime = parseBackendTimestamp(b.scheduledStart)
          const endDateTime = parseBackendTimestamp(b.scheduledEnd)
          const dateStr = b.scheduledStart.split('T')[0]
          const startTime = startDateTime ? formatInTimeZone(startDateTime, 'Asia/Manila', 'hh:mm a') : ''
          const endTime = endDateTime ? formatInTimeZone(endDateTime, 'Asia/Manila', 'hh:mm a') : ''
          return {
            id: b.id,
            title: b.title,
            description: b.description,
            date: dateStr,
            startTime,
            endTime,
            dj: (b.createdByName || '').trim() || 'Unknown DJ',
            details: b.details || ''
          }
        })
        setUpcomingBroadcasts(broadcasts)
      } catch (_) {}

      // Reset the form
      resetToCreateMode()

      // Close the form
      setShowScheduleForm(false)

      // Show success toast
      showToast(isEditMode ? "Broadcast updated successfully!" : "Broadcast scheduled successfully!")
    } catch (error) {
      logger.error(`Error ${isEditMode ? "updating" : "scheduling"} broadcast:`, error)
      // Show error toast with backend message if available
      const errorMessage = error.response?.data?.message ||
                          `Failed to ${isEditMode ? "update" : "schedule"} broadcast. Please try again.`
      showToast(errorMessage, "error")
    } finally {
      setIsLoading(false)
    }
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

      // Format date string in YYYY-MM-DD to match broadcast.date format
      // Ensure we use padStart to get proper 2-digit months and days
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`

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

  // Confirm and execute deletion of a broadcast
  const confirmDeleteBroadcast = async () => {
    if (!selectedBroadcast) return

    try {
      setIsLoading(true)

      // Call the API to delete the broadcast
      await broadcastService.delete(selectedBroadcast.id)

      // Remove the broadcast from the local state
      setUpcomingBroadcasts(upcomingBroadcasts.filter(broadcast =>
          broadcast.id !== selectedBroadcast.id
      ))

      // Close the confirmation modal
      setIsDeleteConfirmOpen(false)
      setSelectedBroadcast(null)

      // Show success message
      showToast("Broadcast deleted successfully!")
    } catch (error) {
      logger.error("Error deleting broadcast:", error)
      showToast("Failed to delete broadcast. Please try again.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
      <React.Fragment>
        <SEO
          title="Broadcast Schedule"
          description="View upcoming broadcasts and schedule your own on Wildcat Radio. Browse calendar and list views of all scheduled campus radio shows."
          url={location.pathname}
          keywords="broadcast schedule, radio schedule, upcoming shows, campus radio schedule, wildcat radio schedule"
        />
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Broadcast Schedule</h1>

            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <div className="inline-flex rounded-md shadow-sm w-full sm:w-auto" role="group">
                <button
                    type="button"
                    onClick={() => setViewType("calendar")}
                    className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-l-lg border ${
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
                    className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-r-lg border ${
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
                      className="w-full sm:w-auto px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium flex items-center justify-center"
                      disabled={isLoading}
                  >
                    <CalendarIcon className="h-5 w-5 mr-1" />
                    {showScheduleForm ? "Cancel" : "Schedule Broadcast"}
                  </button>
              )}
            </div>
          </div>

          {/* DJ/Admin Broadcast Scheduling Form */}
          {canScheduleBroadcasts && showScheduleForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-40">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-6xl w-full mx-4 my-8 overflow-auto max-h-[90vh]">
                  <div className="p-6 md:p-8">
                    <div className="flex justify-between items-start mb-4">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 border-b border-gray-200 dark:border-gray-700">
                        {showReviewStep ? "Confirm Your Broadcast" : (isEditMode ? "Edit Broadcast" : "Schedule New Broadcast")}
                      </h2>
                      <button
                          onClick={() => setShowScheduleForm(false)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    {showReviewStep ? (
                      <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Broadcast Summary</h3>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Title</label>
                              <p className="text-lg font-semibold text-gray-900 dark:text-white">{broadcastDetails.title}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Description</label>
                              <p className="text-gray-900 dark:text-white">{broadcastDetails.description || '—'}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Date</label>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatDateWithDay(broadcastDetails.date)}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Duration</label>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">{calculateDuration()}</p>
                              </div>
                            </div>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                              <label className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Time</label>
                              <p className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
                                {formatTimeTo12h(broadcastDetails.startTime)} - {formatTimeTo12h(broadcastDetails.endTime)}
                              </p>
                              <p className="text-xs text-yellow-800/80 dark:text-yellow-300/80 mt-1">Allowed hours: 6:00 AM – 10:00 PM</p>
                            </div>
                            {broadcastDetails.details && (
                              <div>
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Staff Details</label>
                                <p className="text-gray-900 dark:text-white bg-maroon-50 dark:bg-maroon-900/30 p-3 rounded-md">{broadcastDetails.details}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end space-x-3">
                          <button
                              type="button"
                              onClick={handleBackToEdit}
                              className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                          >
                            <svg className="h-4 w-4 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Go Back & Edit
                          </button>
                          <button
                              type="button"
                              onClick={handleBroadcastScheduleSubmit}
                              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-maroon-700 hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-600"
                              disabled={isLoading}
                          >
                            {isLoading ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Scheduling...
                                </>
                            ) : (
                                <>
                                  <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Confirm & Schedule
                                </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleReviewStep(); }}>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Broadcast Title <span className="text-red-500">*</span>
                          </label>
                          <input
                              type="text"
                              name="title"
                              id="title"
                              value={broadcastDetails.title}
                              onChange={handleBroadcastDetailsChange}
                              required
                              placeholder="Enter broadcast title"
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label
                              htmlFor="description"
                              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Description <span className="text-red-500">*</span>
                          </label>
                          <textarea
                              name="description"
                              id="description"
                              rows="3"
                              value={broadcastDetails.description}
                              onChange={handleBroadcastDetailsChange}
                              required
                              placeholder="Enter broadcast description"
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border resize-none"
                              style={{ maxHeight: '120px', minHeight: '80px' }}
                          ></textarea>
                        </div>
                        <div>
                          <DateSelector
                              value={broadcastDetails.date}
                              onChange={(date) => handleBroadcastDetailsChange({ target: { name: 'date', value: date } })}
                              label="Date"
                              id="date"
                              required={true}
                              min={getMinDate()}
                          />
                          {isSelectedDateInPast() && (
                            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                              <div className="flex">
                                <svg className="h-5 w-5 text-red-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <div>
                                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                                    Past Date Selected
                                  </h3>
                                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                                    You cannot schedule broadcasts for past dates. Please select today or a future date.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <TimeSelector
                              value={broadcastDetails.startTime}
                              onChange={(time) => {
                                const isValid = validateTimeInput(time, 'startTime')
                                if (isValid || !time) {
                                  handleBroadcastDetailsChange({ target: { name: 'startTime', value: time } })
                                }
                              }}
                              label="Start Time"
                              id="startTime"
                              required={true}
                              min={broadcastDetails.date && !isSelectedDateInPast() ? getMinStartTimeForSelectedDate() : undefined}
                              max={ALLOWED_END}
                              disabled={isSelectedDateInPast()}
                          />
                          {isSelectedDateInPast() && (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 italic">
                              Time selection disabled for past dates
                            </p>
                          )}
                          {broadcastDetails.startTime && !validateTimeInput(broadcastDetails.startTime, 'startTime') && (
                            <p className="mt-1 text-sm text-red-600">Start time cannot be in the past</p>
                          )}
                          {broadcastDetails.startTime && compareTimes(broadcastDetails.startTime, ALLOWED_START) < 0 && (
                            <p className="mt-1 text-sm text-red-600">Start time must be at or after 7:00 AM</p>
                          )}
                          {/* Note: When scheduling for today after 7am, only future times are shown */}
                          {broadcastDetails.date === getMinDate() && !isSelectedDateInPast() && (() => {
                            const now = new Date();
                            const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
                            // Show note if current time is past 7am
                            if (compareTimes(currentTime, ALLOWED_START) > 0) {
                              return (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 italic">
                                  Note: Since today is selected and the current time is past 7:00 AM, only future times are shown.
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div>
                          <TimeSelector
                              value={broadcastDetails.endTime}
                              onChange={(time) => handleBroadcastDetailsChange({ target: { name: 'endTime', value: time } })}
                              label="End Time"
                              id="endTime"
                              required={true}
                              min={getMinEndTimeForStartTime()}
                              max={ALLOWED_END}
                              disabled={isSelectedDateInPast()}
                          />
                          {isSelectedDateInPast() && (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 italic">
                              Time selection disabled for past dates
                            </p>
                          )}
                          {broadcastDetails.startTime && broadcastDetails.endTime && 
                           !isEndTimeAfterStartTime() && (
                            <p className="mt-1 text-sm text-red-600">End time must be after start time</p>
                          )}
                          {broadcastDetails.endTime && compareTimes(broadcastDetails.endTime, ALLOWED_END) > 0 && (
                            <p className="mt-1 text-sm text-red-600">End time must be at or before 10:00 PM</p>
                          )}
                          {/* Note: End time must be at least 1 hour after start time */}
                          {broadcastDetails.startTime && (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 italic">
                              Note: End time must be at least 1 hour after start time ({formatTimeTo12h(broadcastDetails.startTime)}).
                            </p>
                          )}
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

                      <div className="mt-6 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={() => setShowScheduleForm(false)}
                            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                        <button
                            type="submit"
                            className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isFormValid() ? 'bg-maroon-700 hover:bg-maroon-800' : 'bg-gray-400 cursor-not-allowed'} focus:outline-none focus:ring-2 focus:ring-offset-2 ${isFormValid() ? 'focus:ring-maroon-600' : 'focus:ring-gray-400'}`}
                            disabled={isLoading || !isFormValid()}
                        >
                          <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                          Review Broadcast
                        </button>
                      </div>
                    </form>
                    )}
                  </div>
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

                    <div className="mt-6 flex justify-end space-x-2">
                      {canScheduleBroadcasts && (
                          <>
                            <button
                                onClick={() => handleDeleteBroadcast(selectedBroadcast)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                            >
                              Delete
                            </button>
                            <button
                                onClick={() => handleEditBroadcast(selectedBroadcast)}
                                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium"
                            >
                              Edit
                            </button>
                          </>
                      )}
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

          {/* Delete Confirmation Modal */}
          {isDeleteConfirmOpen && selectedBroadcast && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Confirm Deletion</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-6">
                    Are you sure you want to delete the broadcast "{selectedBroadcast.title}" scheduled for {new Date(selectedBroadcast.date).toLocaleDateString()} at {selectedBroadcast.startTime}?
                  </p>
                  <div className="flex justify-end space-x-3">
                    <button
                        onClick={() => setIsDeleteConfirmOpen(false)}
                        className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                        disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                        onClick={confirmDeleteBroadcast}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium"
                        disabled={isLoading}
                    >
                      {isLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Deleting...
                          </>
                      ) : (
                          "Delete Broadcast"
                      )}
                    </button>
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
                                      const y = day.date.getFullYear()
                                      const m = String(day.date.getMonth() + 1).padStart(2, '0')
                                      const d = String(day.date.getDate()).padStart(2, '0')
                                      const dateStr = `${y}-${m}-${d}`
                                      setBroadcastDetails((prev) => ({
                                        ...prev,
                                        date: dateStr,
                                      }))
                                      setShowScheduleForm(true)
                                    }}
                                    disabled={day.date < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())}
                                    className={`rounded-full p-1 transition-all duration-150 focus:outline-none focus:ring-2 ${
                                      day.date < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
                                        ? 'text-gray-400 dark:text-gray-600'
                                        : 'text-yellow-600 dark:text-yellow-400 hover:text-white hover:bg-yellow-500 cursor-pointer focus:ring-yellow-500/60 shadow-sm hover:shadow'
                                    }`}
                                    title={day.date < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) ? "Cannot schedule broadcasts for past dates" : "Schedule broadcast"}
                                    aria-label={day.date < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) ? "Cannot schedule broadcasts for past dates" : "Schedule broadcast"}
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

                  {/* No broadcasts placeholder */}
                  {upcomingBroadcasts.length === 0 && (
                      <div className="mt-6 text-center py-8 px-4 border-t border-gray-200 dark:border-gray-700">
                        <MicrophoneIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No broadcasts scheduled</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                          There are currently no broadcasts scheduled for this month. Check back later or
                          {canScheduleBroadcasts ? " use the plus icons on dates to schedule broadcasts." : " contact a DJ or admin to schedule a broadcast."}
                        </p>
                      </div>
                  )}
                </div>
              </div>
          ) : (
              // List View - Keep as is
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                {upcomingBroadcasts.length > 0 ? (
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
                ) : (
                    <div className="py-12 px-4 text-center">
                      <MicrophoneIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No broadcasts scheduled</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        There are currently no broadcasts scheduled. Check back later or {canScheduleBroadcasts && "schedule a broadcast using the button above."}
                        {!canScheduleBroadcasts && "contact a DJ or admin to schedule a broadcast."}
                      </p>
                    </div>
                )}
              </div>
          )}
          </div>
          {/* Toast notification */}
          {toast.visible && (
              <Toast
                  message={toast.message}
                  type={toast.type}
                  onClose={() => setToast({ ...toast, visible: false })}
              />
          )}
        </div>
      </React.Fragment>
  )
}
