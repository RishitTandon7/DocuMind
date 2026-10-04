"use client";

import { motion } from "framer-motion";
import { useSideNav } from "@/components/providers/SideNavProvider";

export function HamburgerButton({ className = "" }: { className?: string }) {
  const { isOpen, toggle } = useSideNav();

  return (
    <button
      onClick={toggle}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
      id="hamburger-btn"
      className={`relative flex h-11 w-11 items-center justify-center rounded-full border border-black/8 bg-white/50 backdrop-blur-md text-ink transition-all hover:bg-white/70 active:scale-95 ${className}`}
    >
      <div className="flex flex-col gap-[5px] w-5 h-4 justify-center">
        <motion.span
          animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="block h-[2px] w-5 rounded-full bg-ink origin-center"
        />
        <motion.span
          animate={isOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.15 }}
          className="block h-[2px] w-5 rounded-full bg-ink origin-center"
        />
        <motion.span
          animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="block h-[2px] w-5 rounded-full bg-ink origin-center"
        />
      </div>
    </button>
  );
}
