import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export function DateSelector({ value, onChange, label, required = false, id, min }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null);
  const containerRef = useRef(null);
  
  // Get today's date as minimum (YYYY-MM-DD format)
  const getTodayMinDate = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };
  
  // Use today as minimum, or the provided min if it's later than today
  const effectiveMinDate = (() => {
    const todayMin = getTodayMinDate();
    if (!min) return todayMin;
    // Return whichever is later (today or provided min)
    return min > todayMin ? min : todayMin;
  })();
  
  // Format displayed value
  const displayValue = selectedDate ? format(selectedDate, 'MMMM d, yyyy') : '';
  
  // Check if a date is disabled (before minimum date or in the past) - using local date components to avoid timezone issues
  const isDateDisabled = (date) => {
    const dateToCheck = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Parse the effective min date
    const [minYear, minMonth, minDay] = effectiveMinDate.split('-').map(Number);
    const minDate = new Date(minYear, minMonth - 1, minDay);
    const minDateToCheck = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    
    // Disable dates before the effective minimum date
    return dateToCheck < minDateToCheck;
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Get days in month
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get previous month days to fill the calendar
    const prevMonthDays = [];
    const prevMonth = new Date(year, month, 0);
    const prevMonthLastDay = prevMonth.getDate();
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      prevMonthDays.push(new Date(year, month - 1, prevMonthLastDay - i));
    }
    
    // Current month days
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Next month days
    const nextMonthDays = [];
    const totalCells = 42; // 6 rows of 7 days
    const remainingCells = totalCells - (prevMonthDays.length + days.length);
    
    for (let i = 1; i <= remainingCells; i++) {
      nextMonthDays.push(new Date(year, month + 1, i));
    }
    
    return { prevMonthDays, days, nextMonthDays };
  };
  
  const { prevMonthDays, days, nextMonthDays } = getDaysInMonth();
  
  // Move to previous month
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  // Move to next month
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    const dateToCheck = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayToCheck = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dateToCheck.getTime() === todayToCheck.getTime();
  };
  
  // Check if date is selected
  const isSelected = (date) => {
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };
  
  // Handle date selection
  const handleDateSelect = (date) => {
    // Don't allow selection of disabled dates
    if (isDateDisabled(date)) {
      return;
    }
    setSelectedDate(date);
    const formattedDate = format(date, 'yyyy-MM-dd');
    onChange(formattedDate);
    setIsOpen(false);
  };
  
  return (
    <div className="relative" ref={containerRef} style={{ zIndex: isOpen ? 9999 : 'auto' }}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          id={id}
          name={id}
          value={displayValue}
          readOnly
          onClick={() => setIsOpen(!isOpen)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border cursor-pointer"
          required={required}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <CalendarIcon className="h-5 w-5 text-gray-400" />
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-[10000] mt-1 w-full min-w-[280px] bg-white dark:bg-gray-800 rounded-md shadow-2xl border border-gray-200 dark:border-gray-700" style={{ position: 'absolute', top: '100%', left: 0 }}>
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <ChevronLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {format(currentMonth, 'MMMM yyyy')}
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <ChevronRightIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, index) => (
                <div key={index} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {prevMonthDays.map((date, index) => (
                <button
                  type="button"
                  key={`prev-${index}`}
                  onClick={() => handleDateSelect(date)}
                  disabled={isDateDisabled(date)}
                  className={`p-1 text-center text-xs rounded-md ${
                    isDateDisabled(date)
                      ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                      : 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {date.getDate()}
                </button>
              ))}
              
              {days.map((date, index) => (
                <button
                  type="button"
                  key={`current-${index}`}
                  onClick={() => handleDateSelect(date)}
                  disabled={isDateDisabled(date)}
                  className={`p-1 text-center text-xs rounded-md ${
                    isDateDisabled(date)
                      ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                      : isSelected(date)
                        ? 'bg-maroon-600 text-white hover:bg-maroon-700'
                        : isToday(date)
                          ? 'bg-maroon-100 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300 hover:bg-maroon-200 dark:hover:bg-maroon-900/50'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {date.getDate()}
                </button>
              ))}
              
              {nextMonthDays.map((date, index) => (
                <button
                  type="button"
                  key={`next-${index}`}
                  onClick={() => handleDateSelect(date)}
                  disabled={isDateDisabled(date)}
                  className={`p-1 text-center text-xs rounded-md ${
                    isDateDisabled(date)
                      ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                      : 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {date.getDate()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TimeSelector({ value, onChange, label, required = false, id, min, max, disabled = false, selectedDate = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customHour, setCustomHour] = useState('');
  const [customMinute, setCustomMinute] = useState('');
  const [customAmPm, setCustomAmPm] = useState('AM');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const minuteInputRef = useRef(null);
  const containerRef = useRef(null);
  const formRef = useRef(null);
  
  // Check if selected date is today
  const isSelectedDateToday = () => {
    if (!selectedDate) return false;
    const today = new Date();
    const [year, month, day] = selectedDate.split('-').map(Number);
    const selected = new Date(year, month - 1, day);
    return selected.getFullYear() === today.getFullYear() &&
           selected.getMonth() === today.getMonth() &&
           selected.getDate() === today.getDate();
  };
  
  // Get minimum time (current time if date is today, otherwise min prop or undefined)
  const getEffectiveMinTime = () => {
    if (isSelectedDateToday()) {
      const now = new Date();
      // Round up to next 30-minute interval
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const roundedMinutes = Math.ceil((currentMinutes + 1) / 30) * 30;
      const minHours = Math.floor(roundedMinutes / 60);
      const minMins = roundedMinutes % 60;
      return `${String(minHours).padStart(2, '0')}:${String(minMins).padStart(2, '0')}`;
    }
    return min;
  };
  
  // Generate time options (30 minute intervals) within min/max range
  const generateTimeOptions = () => {
    const options = [];
    const effectiveMin = getEffectiveMinTime();

    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date();
        time.setHours(hour, minute, 0);
        
        // Filter by effective min time (current time if date is today)
        if (effectiveMin) {
          const [minHour, minMinute] = effectiveMin.split(':').map(Number);
          const minTime = new Date();
          minTime.setHours(minHour, minMinute, 0);
          if (time < minTime) continue;
        }
        
        if (max) {
          const [maxHour, maxMinute] = max.split(':').map(Number);
          const maxTime = new Date();
          maxTime.setHours(maxHour, maxMinute, 0);
          if (time > maxTime) continue;
        }
        
        options.push(time);
      }
    }

    return options;
  };
  
  // Format displayed value
  const displayValue = value ? 
    new Date(`2000-01-01T${value}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 
    '';
  
  // Generate time options - this will recalculate on every render when selectedDate or min changes
  const timeOptions = generateTimeOptions();
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowCustomInput(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Prevent form submission
  useEffect(() => {
    const handleFormSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const form = formRef.current;
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
      return () => {
        form.removeEventListener('submit', handleFormSubmit);
      };
    }
  }, [showCustomInput]);

  // Reset custom time inputs when opening the picker
  useEffect(() => {
    if (isOpen && showCustomInput) {
      // If we have a current value, populate the fields
      if (value) {
        const date = new Date(`2000-01-01T${value}`);
        let hours = date.getHours();
        const minutes = date.getMinutes();
        let period = 'AM';
        
        if (hours >= 12) {
          period = 'PM';
          if (hours > 12) hours -= 12;
        }
        if (hours === 0) hours = 12;
        
        setCustomHour(hours.toString());
        setCustomMinute(minutes.toString().padStart(2, '0'));
        setCustomAmPm(period);
      } else {
        setCustomHour('');
        setCustomMinute('');
        setCustomAmPm('AM');
      }
    }
  }, [isOpen, showCustomInput, value]);
  
  // Handle time selection
  const handleTimeSelect = (date) => {
    // Format as HH:MM
    const formattedTime = format(date, 'HH:mm');
    
    // Validate that the time is not in the past if date is today
    if (isSelectedDateToday()) {
      const now = new Date();
      const selectedTime = new Date();
      selectedTime.setHours(date.getHours(), date.getMinutes(), 0, 0);
      now.setSeconds(0, 0);
      
      // Round up to next minute for comparison
      if (selectedTime <= now) {
        // Time is in the past, don't set it
        return;
      }
    }
    
    onChange(formattedTime);
    setIsOpen(false);
    setShowCustomInput(false);
  };
  
  // Handle custom hour input
  const handleHourChange = (e) => {
    const input = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
    
    if (input === '') {
      setCustomHour('');
      return;
    }
    
    const numericValue = parseInt(input, 10);
    
    // Handle hours from 1-12
    if (numericValue > 0 && numericValue <= 12) {
      setCustomHour(numericValue.toString());
      
      // Auto-advance to minute field if 2 digits are entered or if valid hour is entered
      if (input.length >= 2 || numericValue > 1) {
        minuteInputRef.current?.focus();
      }
    } else if (numericValue === 0) {
      setCustomHour('12'); // Convert 0 to 12
      minuteInputRef.current?.focus();
    }
  };
  
  // Handle custom minute input
  const handleMinuteChange = (e) => {
    const input = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
    
    if (input === '') {
      setCustomMinute('');
      return;
    }
    
    // Ensure minutes are within 0-59
    if (input.length <= 2) {
      const numericValue = parseInt(input, 10);
      if (numericValue >= 0 && numericValue < 60) {
        // Don't pad with zeros while user is typing
        setCustomMinute(input);
      }
    }
  };
  
  // Handle custom time submission
  const handleCustomTimeSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Validate inputs are present
    if (!customHour || !customMinute) {
      return false;
    }
    
    // Parse the hour and minute
    let hours = parseInt(customHour, 10);
    const minutes = parseInt(customMinute, 10);
    
    // Validate numeric values
    if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return false;
    }
    
    // Convert to 24-hour format
    if (customAmPm === 'PM' && hours < 12) {
      hours += 12;
    } else if (customAmPm === 'AM' && hours === 12) {
      hours = 0;
    }
    
    // Format as HH:MM for the internal value
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    // Validate that the time is not in the past if date is today
    if (isSelectedDateToday()) {
      const now = new Date();
      const selectedDateTime = new Date();
      selectedDateTime.setHours(hours, minutes, 0, 0);
      now.setSeconds(0, 0);
      
      // Add 1 minute buffer to allow times very close to now
      const minTime = new Date(now.getTime() + 60000);
      
      if (selectedDateTime < minTime) {
        // Time is in the past, don't set it
        return false;
      }
    }
    
    // Call onChange to update the parent component
    onChange(formattedTime);
    
    // Close the dropdown after a small delay to prevent issues with event handling
    setTimeout(() => {
      setIsOpen(false);
      setShowCustomInput(false);
    }, 10);
    
    return false;
  };
  
  // Check if time is selected
  const isSelected = (date) => {
    if (!value) return false;
    
    const [hours, minutes] = value.split(':').map(Number);
    return date.getHours() === hours && date.getMinutes() === minutes;
  };
  
  return (
    <div className="relative" ref={containerRef} style={{ zIndex: isOpen ? 9999 : 'auto' }}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          id={id}
          name={id}
          value={displayValue}
          readOnly
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border ${disabled ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-600 opacity-60' : 'cursor-pointer'}`}
          required={required}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ClockIcon className={`h-5 w-5 ${disabled ? 'text-gray-300 dark:text-gray-500' : 'text-gray-400'}`} />
        </div>
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-[10000] mt-1 w-full min-w-[200px] max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-md shadow-2xl border border-gray-200 dark:border-gray-700" style={{ position: 'absolute', top: '100%', left: 0 }}>
          <div className="p-1">
            {/* Custom time input */}
            {showCustomInput ? (
              <form 
                ref={formRef}
                onSubmit={handleCustomTimeSubmit} 
                className="p-2 border-b border-gray-200 dark:border-gray-700"
              >
                <div className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter custom time
                </div>
                <div className="flex items-center space-x-1">
                  <div className="flex-none w-16">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customHour}
                      onChange={handleHourChange}
                      placeholder="Hour"
                      maxLength={2}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-1 border text-center"
                    />
                  </div>
                  <div className="flex-none text-gray-500 dark:text-gray-400">:</div>
                  <div className="flex-none w-16">
                    <input
                      type="text"
                      inputMode="numeric"
                      ref={minuteInputRef}
                      value={customMinute}
                      onChange={handleMinuteChange}
                      placeholder="Min"
                      maxLength={2}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-600 focus:ring-maroon-600 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-1 border text-center"
                    />
                  </div>
                  <div className="flex-none w-16">
                    <select
                      value={customAmPm}
                      onChange={(e) => setCustomAmPm(e.target.value)}
                      className="w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white p-1 border"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCustomTimeSubmit}
                    className="inline-flex items-center px-2 py-1 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-maroon-600 hover:bg-maroon-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon-500"
                  >
                    Set Time
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="w-full text-left px-3 py-2 text-sm font-medium text-maroon-600 hover:text-maroon-800 dark:text-maroon-300 dark:hover:text-maroon-200 border-b border-gray-200 dark:border-gray-700"
              >
                Enter custom time...
              </button>
            )}
            
            {/* Preset time options */}
            {!showCustomInput && timeOptions.map((time, index) => {
              // Check if this time option is in the past (if date is today)
              const isPastTime = isSelectedDateToday() && (() => {
                const now = new Date();
                const timeToCheck = new Date();
                timeToCheck.setHours(time.getHours(), time.getMinutes(), 0, 0);
                now.setSeconds(0, 0);
                return timeToCheck <= now;
              })();
              
              return (
                <button
                  type="button"
                  key={index}
                  onClick={() => handleTimeSelect(time)}
                  disabled={isPastTime}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    isPastTime
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                      : isSelected(time)
                        ? 'bg-maroon-600 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {format(time, 'h:mm a')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 