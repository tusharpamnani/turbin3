"use client";

import React from "react";
import { TokenSOL } from '@web3icons/react'; 

interface CallToActionProps {
  onGoToDashboard: () => void;
}

const CallToAction: React.FC<CallToActionProps> = ({ onGoToDashboard }) => {
  return (
    <div className="relative flex justify-center items-center max-h-[300px] sm:max-h-[320px] md:max-h-[350px] lg:max-h-[370px] w-full bg-zinc-800 shadow-md overflow-hidden border border-zinc-700 rounded-2xl sm:rounded-2xl md:rounded-3xl lg:rounded-3xl p-3 sm:p-3 md:p-4 lg:p-0 mt-0">
      {/* Solana Icon as Background - Desktop & Tablet */}
      <div className="absolute -right-28 -top-30 z-0 hidden md:block lg:block">
        <div className="opacity-10 -rotate-12">
          <TokenSOL variant="branded" size={650} />
        </div>
      </div>
      
      {/* Smaller Solana Icon for Small Tablet */}
      <div className="absolute -right-16 -top-16 z-0 hidden sm:block md:hidden">
        <div className="opacity-10 -rotate-12">
          <TokenSOL variant="branded" size={350} />
        </div>
      </div>
      
      {/* Smallest Solana Icon for Mobile */}
      <div className="absolute -right-12 -top-12 z-0 block sm:hidden">
        <div className="opacity-10 -rotate-12">
          <TokenSOL variant="branded" size={250} />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 p-3 sm:p-4 md:p-8 lg:p-12 flex flex-col justify-between gap-3 sm:gap-4 md:gap-6 lg:gap-10">
        <h2 className="text-lg sm:text-xl md:text-xl lg:text-2xl font-normal text-gray-50">
          &quot;Ready to Trade Volatility? Bound Market Makes It Simple!&quot;
        </h2>
        <p className="text-xs sm:text-sm md:text-sm lg:text-base pl-0 sm:pl-0 md:pl-1 lg:pl-2 text-zinc-300 font-thin">
          Bound Market makes volatility trading effortless with simple Stay In or Breakout positions.
          No complex derivatives, no steep learning curves. Join thousands of traders already profiting from BTC price movements!
        </p>
        <button
          onClick={onGoToDashboard}
          className="max-w-[120px] sm:max-w-[150px] md:max-w-[180px] lg:max-w-[200px] 
                   h-[30px] sm:h-[35px] md:h-[40px] lg:h-[50px] 
                   px-3 sm:px-3 md:px-4 lg:px-5 
                   py-0 sm:py-1 md:py-1 lg:py-2 
                   bg-zinc-800 border border-zinc-600 rounded-[8px] sm:rounded-[10px] md:rounded-[10px] lg:rounded-[12px] 
                   group hover:bg-black hover:border-zinc-400 transition-all duration-300 font-normal 
                   self-start md:self-start lg:self-auto"
        >
          <span className="text-xs sm:text-sm md:text-sm lg:text-base text-gray-50 group-hover:text-white">Start Trading &gt;</span>
        </button>
      </div>
    </div>
  );
};

export default CallToAction;