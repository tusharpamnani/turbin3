"use client";

import React, { useState, useEffect } from 'react';

interface VolatilitySliderProps {
  percent: number;
  setPercent: (value: number) => void;
  disabled?: boolean;
}

const VolatilitySlider: React.FC<VolatilitySliderProps> = ({ percent, setPercent, disabled = false }) => {
  const [inputValue, setInputValue] = useState<string>(percent.toFixed(1));
  
  // Values for the slider - range from 0.1% to 10.0% with 0.1% increments
  const values = [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
    1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0,
    2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0,
    3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.0,
    4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.0,
    5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.0,
    6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7.0,
    7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.0,
    8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 9.0,
    9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.0
  ];
  
  // Find the closest allowed value to current percent
  const closestValueIndex = values.reduce((prevIndex, value, currentIndex) => {
    return Math.abs(value - percent) < Math.abs(values[prevIndex] - percent)
      ? currentIndex
      : prevIndex;
  }, 0);

  // Update input value when percent changes from parent
  useEffect(() => {
    setInputValue(percent.toFixed(1));
  }, [percent]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    setPercent(values[index]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
  };

  const handleInputBlur = () => {
    let newValue = parseFloat(inputValue);
    
    // Validate input
    if (isNaN(newValue)) {
      newValue = percent;
    } else {
      // Clamp value between min and max
      newValue = Math.max(0.1, Math.min(10.0, newValue));
      
      // Find closest allowed value
      const closestValue = values.reduce((prev, curr) => 
        Math.abs(curr - newValue) < Math.abs(prev - newValue) ? curr : prev
      );
      
      newValue = closestValue;
    }
    
    setInputValue(newValue.toFixed(1));
    setPercent(newValue);
  };

  return (
    <div>
      <div className="flex justify-between items-center">
        <label className="block text-sm text-zinc-400 mb-1">Volatility Range</label>
        <div className="flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={disabled}
            className={`w-16 h-7 bg-zinc-700 text-purple-400 text-sm text-center rounded-md border border-zinc-600 focus:outline-none focus:border-purple-500 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <span className="text-sm font-medium text-purple-400 ml-1">%</span>
        </div>
      </div>
      
      <input
        type="range"
        min="0"
        max={values.length - 1}
        value={closestValueIndex}
        step="1"
        onChange={handleSliderChange}
        disabled={disabled}
        className={`w-full h-2 bg-gradient-to-r from-[#00FF99] to-[#FF4C4C] rounded-lg appearance-none cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      
      <div className="flex justify-between mt-1">
        <span className="text-xs text-[#00FF99]">0.1%</span>
        <span className="text-xs text-[#FF4C4C]">10.0%</span>
      </div>
    </div>
  );
};

export default VolatilitySlider;
