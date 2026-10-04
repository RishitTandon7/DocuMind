"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";

// --- Configuration ---
const CARDS = [
    { id: 1, title: "COMPILING", color: "bg-yellow-300", tag: "STEP 01" },
    { id: 2, title: "OPTIMIZING", color: "bg-blue-300", tag: "STEP 02" },
    { id: 3, title: "HYDRATING", color: "bg-green-300", tag: "STEP 03" },
    { id: 4, title: "RENDERING", color: "bg-red-300", tag: "STEP 04" },
    { id: 5, title: "READY", color: "bg-purple-300", tag: "STEP 05" },
];

export default function BrutalistDeckLoader() {
    const [deck, setDeck] = useState(CARDS);
    const [progress, setProgress] = useState(0);

    // Auto-shuffle interval simulating a loading loop
    useEffect(() => {
        const cycleInterval = setInterval(() => {
            setDeck((prevDeck) => {
                const newDeck = [...prevDeck];
                const topCard = newDeck.shift();
                if (topCard) newDeck.push(topCard);
                return newDeck;
            });
        }, 1800);

        const progressInterval = setInterval(() => {
            setProgress((prev) => (prev >= 100 ? 0 : prev + 1));
        }, 90);

        return () => {
            clearInterval(cycleInterval);
            clearInterval(progressInterval);
        };
    }, []);

    return (
        <div
            className="absolute inset-0 flex items-center justify-center bg-zinc-100 p-8 z-10 antialiased overflow-hidden"
            style={{
                backgroundImage: "radial-gradient(#ccc 1px, transparent 1px)",
                backgroundSize: "20px 20px",
            }}
        >
            <div className="relative flex flex-col items-center scale-[0.65] sm:scale-90 md:scale-100 transform-gpu origin-center">
                {/* Tight Viewport Box - Sized exactly to match card height (h-80 = 320px) */}
                <div className="relative w-64 h-80 flex items-center justify-center [perspective:1200px]">
                    <AnimatePresence mode="popLayout">
                        {deck.map((card, index) => {
                            const isTop = index === 0;
                            const offset = index * 8;
                            const rotate = (index % 2 === 0 ? 1 : -1) * (index * 2);

                            return (
                                <motion.div
                                    key={card.id}
                                    layout
                                    initial={{
                                        scale: 0.8,
                                        y: -100,
                                        rotateX: 45,
                                        opacity: 0,
                                    }}
                                    animate={{
                                        x: isTop ? 0 : index * 3,
                                        y: isTop ? 0 : offset,
                                        rotate: isTop ? 0 : rotate,
                                        scale: 1 - index * 0.04,
                                        zIndex: CARDS.length - index,
                                        opacity: 1,
                                    }}
                                    exit={{
                                        x: 200,
                                        y: -40,
                                        rotate: 20,
                                        scale: 0.9,
                                        opacity: 0,
                                        transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
                                    }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 260,
                                        damping: 24,
                                    }}
                                    className={`absolute w-64 h-80 border-[3px] border-black p-5 flex flex-col justify-between shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${card.color} select-none`}
                                    style={{
                                        transformStyle: "preserve-3d",
                                    }}
                                >
                                    {/* TOP HEADER */}
                                    <div className="flex items-center justify-between">
                                        <div className="w-7 h-7 rounded-full border-2 border-black bg-white flex items-center justify-center">
                                            <div className="w-2 h-2 rounded-full bg-black" />
                                        </div>
                                        <span className="text-[10px] font-mono font-black border-2 border-black bg-white px-2 py-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                            {card.tag}
                                        </span>
                                    </div>

                                    {/* CENTER BODY */}
                                    <div className="flex flex-col items-center justify-center my-auto gap-3">
                                        {isTop ? (
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{
                                                    repeat: Infinity,
                                                    duration: 3,
                                                    ease: "linear",
                                                }}
                                                className="p-3 bg-black text-white rounded-full border-2 border-black"
                                            >
                                                <RefreshCw size={24} />
                                            </motion.div>
                                        ) : (
                                            <div className="p-3 bg-white/60 border-2 border-black rounded-full">
                                                <Sparkles size={24} className="text-black" />
                                            </div>
                                        )}

                                        <h3 className="text-2xl font-black uppercase tracking-tight text-center leading-none">
                                            {card.title}
                                        </h3>
                                    </div>

                                    {/* FOOTER */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center text-[10px] font-mono font-bold">
                                            <span>STATUS</span>
                                            <span>{progress}%</span>
                                        </div>

                                        <div className="w-full h-4 border-2 border-black bg-white p-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                            <motion.div
                                                className="h-full bg-black"
                                                transition={{ ease: "linear" }}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* STATUS BAR - Tightly positioned under the stack */}
                <div className="mt-12 flex items-center justify-center gap-3 bg-black text-white border-[3px] border-black px-5 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono text-xs font-bold uppercase w-fit z-10">
                    <Loader2 className="animate-spin text-yellow-300 shrink-0" size={16} />
                    <span>PROCESSING ASSETS...</span>
                </div>
            </div>
        </div>
    );
}
