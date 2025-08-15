"use client";

import { motion } from 'framer-motion';

interface DashboardPreviewProps {
  onPreviewClick: () => void;
}

const DashboardPreview = ({ onPreviewClick }: DashboardPreviewProps) => {
  return (
    <div className="relative pointer-events-none mt-5">
      {/* Preview container with overflow to show only top portion */}
      <div className="h-[250px] overflow-hidden">
        <motion.div
          layoutId="dashboard-main" 
          className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-xl cursor-pointer transition-transform duration-300 group pointer-events-auto"
          onClick={onPreviewClick}
          whileHover={{ scale: 1.02, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
          style={{ 
            maxWidth: "800px", 
            margin: "0 auto",
            padding: "20px 24px",
            background: "linear-gradient(to bottom right, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))",
          }}
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500/80 to-purple-600/80 rounded-lg flex items-center justify-center border border-white/20 backdrop-blur-sm shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400 font-medium">Live</span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-500/20"></div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white/5 p-4 rounded-lg border border-white/10 backdrop-blur-sm shadow-inner">
              <h5 className="text-sm text-zinc-400 mb-2">Balance</h5>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-medium text-white">62 SOL</span>
                <span className="text-emerald-400 text-sm">↑ Up</span>
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-lg border border-white/10 backdrop-blur-sm shadow-inner">
              <h5 className="text-sm text-zinc-400 mb-2">Predictions Made</h5>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-medium text-white">43%</span>
                <span className="text-rose-400 text-sm">↓ Down</span>
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-lg border border-white/10 backdrop-blur-sm shadow-inner">
              <h5 className="text-sm text-zinc-400 mb-2">Success Rate</h5>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-medium text-white">78%</span>
                <span className="text-emerald-400 text-sm">↑ Up</span>
              </div>
            </div>
          </div>
          
          {/* Additional sections that will be partially hidden */}
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-lg border border-white/10 backdrop-blur-sm shadow-inner">
              <h5 className="text-sm text-zinc-400 mb-2">Market Activity</h5>
              <div className="h-32 bg-white/5 rounded-lg border border-white/5"></div>
            </div>
            <div className="bg-white/5 p-4 rounded-lg border border-white/10 backdrop-blur-sm shadow-inner">
              <h5 className="text-sm text-zinc-400 mb-2">Recent Trades</h5>
              <div className="h-32 bg-white/5 rounded-lg border border-white/5"></div>
            </div>
          </div>
          
          {/* More content that will be even more hidden */}
          <div className="mt-4 bg-white/5 p-4 rounded-lg border border-white/10 backdrop-blur-sm shadow-inner">
            <h5 className="text-sm text-zinc-400 mb-2">Advanced Analytics</h5>
            <div className="h-40 bg-white/5 rounded-lg border border-white/5"></div>
          </div>
        </motion.div>
      </div>
      
      {/* Glassmorphic fade effect at bottom - adjusted for taller preview */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/90 to-transparent pointer-events-none"></div>
      
      {/* Click hint that appears on hover */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.5 }}
        className="absolute -bottom-8 left-0 right-0 text-center"
      >
      </motion.div>
    </div>
  );
};

export default DashboardPreview;