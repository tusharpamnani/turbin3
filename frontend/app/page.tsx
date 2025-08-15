"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const LoadingOverlay = ({ isVisible }: { isVisible: boolean }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-zinc-900 rounded-2xl p-6 shadow-xl border border-zinc-800/50 flex items-center gap-4"
        >
          <div className="relative w-6 h-6">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-blue-500/20"
              style={{ borderTopColor: "rgb(59, 130, 246)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <span className="text-zinc-200 font-medium">Loading...</span>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 }
};

const slideIn = {
  initial: { x: -20, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration: 0.3 }
};
import DashboardPreview from "./components/DashboardPreview";
import Dashboard from "./components/Dashboard";
import PositionsPage from "./components/PositionsPage";
import Overview from "./components/Overview";
import CallToAction from "./components/CallToAction";
import logo from "../public/icon0.svg";

type NavButtonProps = {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

const NavButton = ({ onClick, children, variant = "primary" }: NavButtonProps) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={`
      px-6 py-2.5 rounded-lg font-medium
      flex items-center gap-2 shadow-lg
      transition-all duration-200 ease-in-out
      ${variant === "primary" 
        ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white hover:shadow-blue-500/20 border border-blue-400/20" 
        : "bg-zinc-800/50 hover:bg-zinc-700/50 text-gray-200 hover:shadow-zinc-500/10 backdrop-blur-sm border border-zinc-700/50"
      }
    `}
  >
    {children}
  </motion.button>
);

type PageContainerProps = {
  children: React.ReactNode;
};

const PageContainer = ({ children }: PageContainerProps) => (
  <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 relative overflow-hidden">
    {/* Ambient background gradients */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.05),transparent_50%)] pointer-events-none" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(29,78,216,0.05),transparent_50%)] pointer-events-none" />
    
    {/* Subtle grid pattern */}
    <div 
      className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)] pointer-events-none opacity-25"
    />
    
    {/* Content */}
    <div className="relative">
      {children}
    </div>
  </div>
);

type HeaderProps = {
  currentView: "home" | "dashboard" | "positions";
  onNavigate: (view: "home" | "dashboard" | "positions") => void;
};

const NavigationBreadcrumb = ({ currentView }: { currentView: "home" | "dashboard" | "positions" }) => {
  const paths = {
    home: [],
    dashboard: ["Dashboard"],
    positions: ["Dashboard", "Positions"]
  };

  return (
    <div className="hidden sm:flex items-center gap-2 text-sm text-zinc-400">
      {paths[currentView].map((path, index) => (
        <div key={path} className="flex items-center gap-2">
          {index > 0 && <span>/</span>}
          <span>{path}</span>
        </div>
      ))}
    </div>
  );
};

const Header = ({ currentView, onNavigate }: HeaderProps) => (
  <motion.header 
    className="sticky top-0 z-50 backdrop-blur-lg bg-zinc-900/80 border-b border-zinc-800/50"
    initial={false}
    animate={{
      height: currentView === "home" ? "5rem" : "4rem",
    }}
    transition={{ duration: 0.3 }}
  >
    <div className="max-w-7xl mx-auto px-6 h-full">
      <div className="flex justify-between items-center h-full">
        <div className="flex items-center gap-4">
          <motion.div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => onNavigate("home")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-zinc-700 shadow-lg group-hover:border-blue-500 transition-colors">
              <Image src={logo} alt="Bound Market" className="w-7 h-7" />
            </div>
            <span className="text-lg font-semibold text-gray-50">Bound Market</span>
          </motion.div>
          <NavigationBreadcrumb currentView={currentView} />
        </div>
        <nav className="flex items-center gap-4">
          {currentView !== "home" && (
            <NavButton onClick={() => onNavigate("home")} variant="secondary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Home
            </NavButton>
          )}
          {currentView === "home" && (
            <NavButton onClick={() => onNavigate("dashboard")}>
              Launch App
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 ml-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </NavButton>
          )}
        </nav>
      </div>
    </div>
  </motion.header>
);

export default function Page() {
  const [currentView, setCurrentView] = useState<"home" | "dashboard" | "positions">("home");
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigation = async (view: "home" | "dashboard" | "positions") => {
    setIsNavigating(true);
    // Add a small delay for smooth transition
    await new Promise(resolve => setTimeout(resolve, 300));
    setCurrentView(view);
    setIsNavigating(false);
  };

  return (
    <PageContainer>
      <LoadingOverlay isVisible={isNavigating} />
      <Header currentView={currentView} onNavigate={handleNavigation} />
      
      <AnimatePresence mode="wait">
        {currentView === "home" && (
          <motion.main
            {...fadeIn}
            className="relative"
          >
            <div className="max-w-7xl mx-auto px-6 py-12">
              {/* Hero Section */}
              <div className="text-center mb-16">
                <motion.h1 
                  className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gray-50 tracking-tight"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  Decentralized Binary Markets for
                  <motion.span 
                    className="text-blue-500"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                  > Digital Asset Volatility</motion.span>
                </motion.h1>
                <motion.p 
                  className="text-lg sm:text-xl text-zinc-400 max-w-3xl mx-auto mb-12"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  Predict market movements and profit from your insights. Powered by Solana
                  for lightning-fast, low-cost predictions.
                </motion.p>
                
                {/* Preview Section */}
                <motion.div 
                  className="relative mb-24"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10" />
                  <DashboardPreview onPreviewClick={() => handleNavigation("dashboard")} />
                </motion.div>
              </div>

              {/* Features Overview */}
              <motion.section 
                className="mb-24"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
              >
                <Overview />
              </motion.section>

              {/* Call to Action */}
              <motion.section 
                className="relative"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
              >
                <CallToAction onGoToDashboard={() => handleNavigation("dashboard")} />
              </motion.section>
            </div>
          </motion.main>
        )}

        {currentView === "dashboard" && (
          <motion.div {...fadeIn}>
            <Dashboard
              onBackClick={() => handleNavigation("home")}
              onPositionsClick={() => handleNavigation("positions")}
            />
          </motion.div>
        )}

        {currentView === "positions" && (
          <motion.div {...fadeIn}>
            <PositionsPage onBackClick={() => handleNavigation("dashboard")} />
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}