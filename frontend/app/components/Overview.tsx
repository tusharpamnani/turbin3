"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cross2Icon } from '@radix-ui/react-icons';

interface Item {
  id: number;
  title: string;
  subtitle: string;
  width: string;
  height: string;
}

const items: Item[] = [
  { 
    id: 1, 
    title: "What is Bound Market?", 
    subtitle: "Bound Market is the easiest way to trade volatility on $BTC. Select a price range to Stay In or Breakout and earn up to 2x in just 1 day.", 
    width: "w-3/5", 
    height: "h-64" 
  },
  { 
    id: 2, 
    title: "Why Bound Market?", 
    subtitle: "Retail users face significant barriers to professional trading techniques like hedging and leverage. Bound Market simplifies these complex strategies into intuitive positions.", 
    width: "w-2/4", 
    height: "h-64" 
  },
  { 
    id: 3, 
    title: "Stay In Positions", 
    subtitle: "Short volatility positions betting the price stays within a range. Earn full profits if it stays in-range for 12+ hours, or partial returns if it stays in for any period.", 
    width: "w-1/3", 
    height: "h-80" 
  },
  { 
    id: 4, 
    title: "Breakout Positions", 
    subtitle: "Long volatility positions betting the price moves outside a range. Earn full profits if breakout happens within 12 hours, or partial returns for breakouts between 12-24 hours.", 
    width: "w-1/2", 
    height: "h-72" 
  }
];

const Overview: React.FC = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <div className="container mx-auto px-4 mt-16">
      {/* First row: 1st and 2nd divs side by side */}
      <div className="flex flex-col sm:flex-col md:flex-row lg:flex-row justify-center gap-6">
        {items.slice(0, 2).map((item, index) => (
          <motion.div
            key={item.id}
            layoutId={item.id.toString()}
            className={`p-4 sm:p-5 md:p-6 bg-zinc-800 hover:custom-red rounded-3xl text-gray-50 cursor-pointer 
                      w-full sm:w-full md:w-1/2 lg:${item.width} 
                      h-auto sm:h-auto md:${item.id === 1 ? 'h-64' : 'h-64'} lg:${item.height} 
                      border border-zinc-700 mb-6 sm:mb-6 md:mb-0 lg:mb-0`}
            onClick={() => setSelectedId(item.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.h1 className="text-lg sm:text-xl md:text-2xl lg:text-2xl mb-2 sm:mb-3 md:mb-4 lg:mb-5 text-balance">{item.title}</motion.h1>
            <motion.p className="text-sm sm:text-base md:text-lg lg:text-xl text-zinc-300 text-justify px-1 sm:px-2 md:px-2 lg:px-3">{item.subtitle}</motion.p>
          </motion.div>
        ))}
      </div>

      {/* Second row: 3rd and 4th divs side by side */}
      <div className="flex flex-col sm:flex-col md:flex-row lg:flex-row justify-center gap-6 mt-0 sm:mt-0 md:mt-6 lg:mt-6">
        {items.slice(2).map((item) => (
          <motion.div
            key={item.id}
            layoutId={item.id.toString()}
            className={`p-4 sm:p-5 md:p-6 bg-zinc-800 hover:shadow-zinc-700 rounded-3xl text-gray-50 cursor-pointer 
                      w-full sm:w-full md:w-1/2 lg:${item.width} 
                      h-auto sm:h-auto md:${item.id === 3 ? 'h-80' : 'h-72'} lg:${item.height} 
                      border border-zinc-700 mb-6 sm:mb-6 md:mb-0 lg:mb-0`}
            onClick={() => setSelectedId(item.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              justifyItems: item.id === 3 ? "self-end" : "" 
            }}
          >
            <motion.h1 className="text-lg sm:text-xl md:text-2xl lg:text-2xl mb-2 sm:mb-3 md:mb-5 lg:mb-6 text-balance">{item.title}</motion.h1>
            <motion.h5 className="text-sm sm:text-base md:text-lg lg:text-xl text-zinc-300 text-balance">{item.subtitle}</motion.h5>
          </motion.div>
        ))}
      </div>

      {/* AnimatePresence for selected item */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            layoutId={selectedId.toString()}
            className="fixed top-0 left-0 w-full h-full bg-black/50 backdrop-blur-lg backdrop-filter flex items-center justify-center z-50 p-3 sm:p-4 md:p-6 lg:p-4"
          >
            <div className="bg-zinc-900 p-4 sm:p-5 md:p-8 lg:p-10 rounded-lg text-center w-full sm:w-11/12 md:w-3/4 lg:w-2/4 h-auto max-h-[90vh] sm:max-h-[90vh] md:max-h-[85vh] lg:h-3/5 relative border border-zinc-700 overflow-y-auto">
              <motion.h1 className="text-gray-50 text-xl sm:text-2xl md:text-2xl lg:text-3xl font-thin mb-2 sm:mb-3 md:mb-4 lg:mb-6">
                {items.find((item) => item.id === selectedId)?.title}
              </motion.h1>
              <motion.h5 className="text-zinc-300 text-xs sm:text-sm md:text-sm lg:text-base text-balance font-medium">
                {items.find((item) => item.id === selectedId)?.subtitle}
              </motion.h5>

              {/* Add additional detailed content for modal views */}
              {selectedId === 1 && (
                <div className="mt-4 sm:mt-6 md:mt-8 lg:mt-16 text-left">
                  <ul className="text-zinc-300 list-disc pl-4 sm:pl-5 space-y-1 sm:space-y-2">
                  <li className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300 mb-2 sm:mb-3 md:mb-3 lg:mb-4">
                    Bound Market simplifies volatility trading, making it accessible to all traders. Instead of complex options trading, we offer straightforward "Stay In" or "Breakout" positions.
                  </li>
                  <li className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300 mb-2 sm:mb-3 md:mb-3 lg:mb-4">
                    Our platform allows you to profit from your market insights without needing deep technical knowledge of derivatives or options.
                  </li>
                  <li className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300">
                    With predictable outcomes and transparent mechanics, you can focus on what matters: your market prediction.
                  </li>
                  </ul>
                </div>
              )}

              {selectedId === 3 && (
                <div className="mt-4 sm:mt-6 md:mt-8 lg:mt-16 text-left">
                  <p className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300 mb-2 sm:mb-3 md:mb-3 lg:mb-4">
                    <span className="text-gray-50 font-medium">How "Stay In" works:</span> When you open a Stay In position, you're predicting BTC will remain within a specified price range.
                  </p>
                  <p className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300 mb-2 sm:mb-3 md:mb-3 lg:mb-4">
                    <span className="text-gray-50 font-medium">Profit mechanics:</span> If BTC stays within range for the full 24 hours, you earn up to 2x your investment. Even if it breaks out eventually, you'll still receive a percentage based on how long it stayed in range.
                  </p>
                  <p className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300">
                    <span className="text-gray-50 font-medium">Perfect for:</span> Sideways markets, consolidation periods, or when you expect low volatility.
                  </p>
                </div>
              )}

              {selectedId === 4 && (
                <div className="mt-4 sm:mt-6 md:mt-8 lg:mt-16 text-left">
                  <p className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300 mb-2 sm:mb-3 md:mb-3 lg:mb-4">
                    <span className="text-gray-50 font-medium">How "Breakout" works:</span> When you open a Breakout position, you're predicting BTC will move outside a specified price range.
                  </p>
                  <p className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300 mb-2 sm:mb-3 md:mb-3 lg:mb-4">
                    <span className="text-gray-50 font-medium">Profit mechanics:</span> If BTC breaks outside the range within 12 hours, you earn up to 2x your investment. If the breakout happens between 12-24 hours, you'll receive a percentage of your potential profit.
                  </p>
                  <p className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300">
                    <span className="text-gray-50 font-medium">Perfect for:</span> News events, market uncertainty, or when you expect high volatility.
                  </p>
                </div>
              )}

              {selectedId === 2 && (
                <div className="mt-4 sm:mt-5 md:mt-6 lg:mt-8 text-left">
                  <p className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300 mb-2 sm:mb-3 md:mb-3 lg:mb-4">
                    Traditional financial markets present several challenges for retail traders:
                  </p>
                  <ul className="text-xs sm:text-sm md:text-sm lg:text-base text-zinc-300 list-disc pl-4 sm:pl-5 space-y-1 sm:space-y-2">
                    <li>Complex derivatives with steep learning curves</li>
                    <li>High capital requirements for options trading</li>
                    <li>Expensive fee structures that eat into profits</li>
                    <li>Complicated hedging strategies that require multiple positions</li>
                    <li>Limited access to professional volatility trading tools</li>
                  </ul>
                
                </div>
              )}

              {/* Close button */}
              <motion.button
                className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-3 md:right-3 lg:top-4 lg:right-4 bg-zinc-800 text-white rounded-full h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 lg:h-10 lg:w-10 flex justify-center items-center border border-zinc-700"
                onClick={() => setSelectedId(null)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Cross2Icon className="h-3 w-3 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-5 lg:w-5" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Overview;