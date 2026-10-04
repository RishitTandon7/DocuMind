"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  {
    title: "Welcome to DocuMind",
    description: "Your intelligent document scanner and AI assistant.",
    icon: "📄",
  },
  {
    title: "Scan & Digitize",
    description: "Take a photo of any document. Our computer vision pipeline will crop, flatten, and digitize it.",
    icon: "📸",
  },
  {
    title: "Chat with Documents",
    description: "Ask questions and get instant answers from your scanned documents using our powerful AI.",
    icon: "🤖",
  },
];

export function Onboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Check if they've seen this before
    const hasSeenOnboarding = localStorage.getItem("documind_onboarding_seen");
    if (!hasSeenOnboarding) {
      setIsOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem("documind_onboarding_seen", "true");
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-sm bg-[#1a1a2e] border border-white/10 rounded-[2rem] p-8 shadow-2xl overflow-hidden relative"
          >
            <div className="flex flex-col items-center text-center space-y-8">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center"
                >
                  <div className="text-7xl mb-8 drop-shadow-xl">{STEPS[step].icon}</div>
                  <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">{STEPS[step].title}</h2>
                  <p className="text-white/60 text-sm leading-relaxed">{STEPS[step].description}</p>
                </motion.div>
              </AnimatePresence>
              
              <div className="flex gap-2 mb-2">
                {STEPS.map((_, i) => (
                  <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-blue-500" : "w-2 bg-white/20"}`} />
                ))}
              </div>

              <button 
                onClick={handleNext} 
                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl h-14 text-lg font-semibold shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98]"
              >
                {step === STEPS.length - 1 ? "Get Started" : "Continue"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
