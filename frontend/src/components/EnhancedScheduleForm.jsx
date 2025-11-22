import { format, differenceInMinutes, addMinutes } from "date-fns"
import { DateSelector, TimeSelector } from "./DateTimeSelector"
import { CalendarIcon, ClockIcon } from "@heroicons/react/24/outline"
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid"

export default function EnhancedScheduleForm({
  scheduledDate,
  scheduledStartTime,
  scheduledEndTime,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  formErrors = {},
  disabled = false,
}) {
  // Calculate duration preview
  const getDuration = () => {
    if (!scheduledDate || !scheduledStartTime || !scheduledEndTime) return null
    try {
      const [startHours, startMinutes] = scheduledStartTime.split(":").map(Number)
      const [endHours, endMinutes] = scheduledEndTime.split(":").map(Number)
      const [year, month, day] = scheduledDate.split("-").map(Number)
      const startDate = new Date(year, month - 1, day, startHours, startMinutes)
      const endDate = new Date(year, month - 1, day, endHours, endMinutes)
      const minutes = differenceInMinutes(endDate, startDate)
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      if (hours > 0 && mins > 0) {
        return `${hours}h ${mins}m`
      } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? "s" : ""}`
      } else {
        return `${mins} minute${mins > 1 ? "s" : ""}`
      }
    } catch (e) {
      return null
    }
  }

  const getTimeRange = () => {
    if (!scheduledStartTime || !scheduledEndTime) return ""
    try {
      const [startHours, startMinutes] = scheduledStartTime.split(":").map(Number)
      const [endHours, endMinutes] = scheduledEndTime.split(":").map(Number)
      const startDate = new Date(2000, 0, 1, startHours, startMinutes)
      const endDate = new Date(2000, 0, 1, endHours, endMinutes)
      return `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`
    } catch (e) {
      return ""
    }
  }

  const duration = getDuration()
  const timeRange = getTimeRange()

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Date and Time Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date Selector */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <CalendarIcon className="w-4 h-4 text-maroon-600 dark:text-maroon-400" />
            Broadcast Date
            <span className="text-red-500">*</span>
          </label>
          <DateSelector
            value={scheduledDate}
            onChange={onDateChange}
            label=""
            id="scheduledDate"
            required={true}
            min={new Date().toISOString().split('T')[0]}
          />
          {formErrors.scheduledDate && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <ExclamationTriangleIcon className="w-4 h-4" />
              {formErrors.scheduledDate}
            </p>
          )}
        </div>

        {/* Start Time Selector */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <ClockIcon className="w-4 h-4 text-maroon-600 dark:text-maroon-400" />
            Start Time
            <span className="text-red-500">*</span>
          </label>
          <TimeSelector
            value={scheduledStartTime}
            onChange={(time) => {
              // Validate that the time is not in the past
              if (time && scheduledDate) {
                const [year, month, day] = scheduledDate.split("-").map(Number)
                const [hours, minutes] = time.split(":").map(Number)
                const selectedDateTime = new Date(year, month - 1, day, hours, minutes)
                const now = new Date()
                
                if (selectedDateTime <= now) {
                  // Time is in the past, don't update
                  return
                }
              }
              
              onStartTimeChange(time)
              // Auto-adjust end time if start time is after end time
              if (scheduledEndTime && time && scheduledEndTime <= time) {
                const [hours, minutes] = time.split(":").map(Number)
                const endTime = format(addMinutes(new Date(2000, 0, 1, hours, minutes), 60), "HH:mm")
                onEndTimeChange(endTime)
              }
            }}
            label=""
            id="scheduledStartTime"
            required={true}
            selectedDate={scheduledDate}
          />
          {(() => {
            const isToday = scheduledDate && (() => {
              const today = new Date()
              const [year, month, day] = scheduledDate.split("-").map(Number)
              const selected = new Date(year, month - 1, day)
              return selected.getFullYear() === today.getFullYear() &&
                     selected.getMonth() === today.getMonth() &&
                     selected.getDate() === today.getDate()
            })()
            
            return isToday && !formErrors.scheduledStartTime && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <ExclamationTriangleIcon className="w-3 h-3" />
                Only future times are available for today
              </p>
            )
          })()}
          {formErrors.scheduledStartTime && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <ExclamationTriangleIcon className="w-4 h-4" />
              {formErrors.scheduledStartTime}
            </p>
          )}
        </div>

        {/* End Time Selector */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <ClockIcon className="w-4 h-4 text-maroon-600 dark:text-maroon-400" />
            End Time
            <span className="text-red-500">*</span>
          </label>
          <TimeSelector
            value={scheduledEndTime}
            onChange={(time) => {
              // Validate that the time is not in the past and is after start time
              if (time && scheduledDate) {
                const [year, month, day] = scheduledDate.split("-").map(Number)
                const [hours, minutes] = time.split(":").map(Number)
                const selectedDateTime = new Date(year, month - 1, day, hours, minutes)
                const now = new Date()
                
                if (selectedDateTime <= now) {
                  // Time is in the past, don't update
                  return
                }
                
                // Also validate that end time is after start time
                if (scheduledStartTime) {
                  const [startHours, startMinutes] = scheduledStartTime.split(":").map(Number)
                  const startDateTime = new Date(year, month - 1, day, startHours, startMinutes)
                  
                  if (selectedDateTime <= startDateTime) {
                    // End time is before or equal to start time, don't update
                    return
                  }
                }
              }
              
              onEndTimeChange(time)
            }}
            label=""
            id="scheduledEndTime"
            required={true}
            min={scheduledStartTime || undefined}
            selectedDate={scheduledDate}
          />
          {formErrors.scheduledEndTime && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <ExclamationTriangleIcon className="w-4 h-4" />
              {formErrors.scheduledEndTime}
            </p>
          )}
        </div>
      </div>

      {/* Duration Preview */}
      {duration && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <ClockIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-900 dark:text-green-200">Broadcast Duration</p>
                <p className="text-xs text-green-700 dark:text-green-400">{duration}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-green-600 dark:text-green-400">
                {format(new Date(scheduledDate), "MMM d, yyyy")}
              </p>
              <p className="text-sm font-medium text-green-900 dark:text-green-200">{timeRange}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

