"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GlobalSearch } from "./GlobalSearch";
import { useSideNav } from "./providers/SideNavProvider";

export function GlobalSearchOverlay() {
  const { searchOpen, closeSearch } = useSideNav();

  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col items-center bg-[#FDF6EC]/95 backdrop-blur-md overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] px-4 pb-4"
        >
          <div className="w-full max-w-xl mt-16 sm:mt-24">
            <GlobalSearch overlay onClose={closeSearch} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
