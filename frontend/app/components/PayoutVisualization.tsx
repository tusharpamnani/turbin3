"use client";

import React from 'react';

interface PayoutVisualizationProps {
  orderSide: 'LONG' | 'SHORT'; 
  amount: string; 
  className?: string;
}

const PayoutVisualization: React.FC<PayoutVisualizationProps> = ({ 
  orderSide, 
  amount,
  className = ""
}) => {
  const isBreakOut = orderSide === 'LONG';
  const amountValue = parseFloat(amount);
  const validAmount = !isNaN(amountValue) && amountValue > 0;
  
  const timePoints = [0, 6, 12, 18, 24];
  

  const breakOutPayouts = [200, 150, 100, 50, 0];
  const stayInPayouts = [0, 50, 100, 150, 200];
  
  const payouts = isBreakOut ? breakOutPayouts : stayInPayouts;

  return (
    <div className={`bg-zinc-900 rounded-xl border border-zinc-800 p-4 ${className}`}>
      <h3 className="text-base font-medium text-white mb-4 border-b border-zinc-800 pb-2">
        {isBreakOut ? 'BreakOut Payout' : 'StayIn Payout'} :
      </h3>
      
      <div className="relative h-[120px] text-sm">
        {/* Main horizontal line (time axis) */}
        <div className="absolute left-2 right-8 top-8 h-0.5 bg-zinc-500">
          {/* Arrow at end */}
          <div className="absolute right-0 top-0 w-3 h-3 -mr-1 -mt-1.5 border-t border-r border-zinc-400 transform rotate-45"></div>
        </div>
        
        {/* Time markers with percentages or SOL amounts */}
        {timePoints.map((hours, index) => {
          // Calculate position (0 = left edge, 1 = right edge)
          const position = index / (timePoints.length - 1);
          const left = `calc(${position * 100}% * 0.9)`; // 0.9 factor to account for right margin space for arrow
          
          // Calculate payout amount if user entered a value
          const payoutPercentage = payouts[index] / 100;
          const payoutAmount = validAmount ? (amountValue * payoutPercentage).toFixed(2) : null;
          
          return (
            <div 
              key={hours} 
              className="absolute"
              style={{ left, top: '24px' }}
            >
              {/* Vertical tick mark */}
              <div className="h-6 w-0.5 bg-zinc-500 mx-auto"></div>
              
              {/* Hour label */}
              <div className="text-xs text-zinc-400 mt-1 text-center">{hours}hrs</div>
              
              {/* Percentage or SOL amount */}
              <div className="text-sm mt-5 text-center">
                {validAmount ? (
                  <span className="text-purple-400 font-medium">◎ {payoutAmount}</span>
                ) : (
                  <span className="text-white font-mono">{payouts[index]}%</span>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Gradient overlay for blackboard effect */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-br from-zinc-300 to-transparent"></div>
      </div>
    </div>
  );
};

export default PayoutVisualization; 