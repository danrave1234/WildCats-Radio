import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export function DateSelector({ value, onChange, label, required = false, id }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null);
  const containerRef = useRef(null);
  
  // Format displayed value
  const displayValue = selectedDate ? format(selectedDate, 'MMMM d, yyyy') : '';
  
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
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
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
    setSelectedDate(date);
    const formattedDate = format(date, 'yyyy-MM-dd');
    onChange(formattedDate);
    setIsOpen(false);
  };
  
  return (
    <div className="relative" ref={containerRef}>
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
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
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
                  className="p-1 text-center text-xs text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  {date.getDate()}
                </button>
              ))}
              
              {days.map((date, index) => (
                <button
                  type="button"
                  key={`current-${index}`}
                  onClick={() => handleDateSelect(date)}
                  className={`p-1 text-center text-xs rounded-md ${
                    isSelected(date)
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
                  className="p-1 text-center text-xs text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
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

export function TimeSelector({ value, onChange, label, required = false, id }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customHour, setCustomHour] = useState('');
  const [customMinute, setCustomMinute] = useState('');
  const [customAmPm, setCustomAmPm] = useState('AM');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const minuteInputRef = useRef(null);
  const containerRef = useRef(null);
  const formRef = useRef(null);
  
  // Generate time options (30 minute intervals)
  const generateTimeOptions = () => {
    const options = [];
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date();
        time.setHours(hour, minute, 0);
        options.push(time);
      }
    }
    
    return options;
  };
  
  const timeOptions = generateTimeOptions();
  
  // Format displayed value
  const displayValue = value ? 
    new Date(`2000-01-01T${value}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
    '';
  
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
    
    if (customHour && customMinute) {
      // Parse the hour and minute
      let hours = parseInt(customHour, 10);
      const minutes = parseInt(customMinute, 10);
      
      // Convert to 24-hour format
      if (customAmPm === 'PM' && hours < 12) {
        hours += 12;
      } else if (customAmPm === 'AM' && hours === 12) {
        hours = 0;
      }
      
      // Format as HH:MM for the internal value
      const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      onChange(formattedTime);
      
      // Close the dropdown after a small delay to prevent issues with event handling
      setTimeout(() => {
        setIsOpen(false);
        setShowCustomInput(false);
      }, 10);
    }
    
    return false;
  };
  
  // Check if time is selected
  const isSelected = (date) => {
    if (!value) return false;
    
    const [hours, minutes] = value.split(':').map(Number);
    return date.getHours() === hours && date.getMinutes() === minutes;
  };
  
  return (
    <div className="relative" ref={containerRef}>
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
          <ClockIcon className="h-5 w-5 text-gray-400" />
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
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
            {!showCustomInput && timeOptions.map((time, index) => (
              <button
                type="button"
                key={index}
                onClick={() => handleTimeSelect(time)}
                className={`w-full text-left px-3 py-2 text-sm ${
                  isSelected(time)
                    ? 'bg-maroon-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {format(time, 'h:mm a')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 