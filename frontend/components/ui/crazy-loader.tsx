"use client";

import { motion } from "framer-motion";
import React from "react";
import { Scan, Database, Cpu, Zap } from "lucide-react";

export default function CrazyLoader() {
  // Generate random particles
  const particles = Array.from({ length: 40 }).map((_, i) => ({
    id: i,
    size: Math.random() * 6 + 2,
    angle: Math.random() * 360,
    distance: Math.random() * 150 + 50,
    duration: Math.random() * 2 + 1,
    color: ["#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6"][Math.floor(Math.random() * 4)],
  }));

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-zinc-950 font-sans">
      {/* Deep space grid background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, #4f4f4f 1px, transparent 1px),
            linear-gradient(to bottom, #4f4f4f 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          transform: "perspective(500px) rotateX(60deg) scale(2)",
          transformOrigin: "center top",
        }}
      >
        <motion.div 
          className="w-full h-full"
          animate={{ y: [0, 40] }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Rotating 3D rings */}
      <div className="relative z-10 flex items-center justify-center h-full w-full perspective-1000">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={`ring-${i}`}
            className="absolute rounded-full border-y-2 border-transparent mix-blend-screen"
            style={{
              width: `${(i + 1) * 100}px`,
              height: `${(i + 1) * 100}px`,
              borderTopColor: ["#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6"][i % 4],
              borderBottomColor: ["#14b8a6", "#ec4899", "#8b5cf6", "#0ea5e9"][i % 4],
            }}
            animate={{
              rotateX: [0, 360],
              rotateY: [0, 360],
              rotateZ: [0, 360],
            }}
            transition={{
              duration: 8 - i,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {/* Orbiting particles */}
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              boxShadow: `0 0 10px ${p.color}`,
            }}
            animate={{
              x: [
                Math.cos((p.angle * Math.PI) / 180) * (p.distance - 20),
                Math.cos(((p.angle + 180) * Math.PI) / 180) * (p.distance + 20),
                Math.cos((p.angle * Math.PI) / 180) * (p.distance - 20),
              ],
              y: [
                Math.sin((p.angle * Math.PI) / 180) * (p.distance - 20),
                Math.sin(((p.angle + 180) * Math.PI) / 180) * (p.distance + 20),
                Math.sin((p.angle * Math.PI) / 180) * (p.distance - 20),
              ],
              scale: [0.5, 1.5, 0.5],
              opacity: [0.2, 1, 0.2],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Core pulsing icon container */}
        <motion.div
          className="relative z-20 flex h-24 w-24 items-center justify-center rounded-2xl bg-black/50 backdrop-blur-md border border-white/10"
          animate={{
            boxShadow: [
              "0 0 20px rgba(139, 92, 246, 0.3)",
              "0 0 60px rgba(139, 92, 246, 0.8)",
              "0 0 20px rgba(139, 92, 246, 0.3)",
            ],
            scale: [1, 1.1, 1],
            rotateZ: [0, 5, -5, 0],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Swapping icons */}
          <div className="relative h-12 w-12 text-white">
            {[Scan, Database, Cpu, Zap].map((Icon, index) => (
              <motion.div
                key={index}
                className="absolute inset-0 flex items-center justify-center"
                animate={{
                  opacity: [0, 1, 1, 0, 0],
                  scale: [0.5, 1, 1, 1.5, 0.5],
                  rotate: [0, 0, 90, 90, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  times: [0, 0.1, 0.25, 0.35, 1],
                  delay: index * 1, // Stagger 4 icons over 4 seconds
                }}
              >
                <Icon className="h-full w-full" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Holographic scan line */}
      <motion.div
        className="absolute left-0 w-full z-30 pointer-events-none"
        style={{
          height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.8), transparent)",
          boxShadow: "0 0 20px 5px rgba(34,211,238,0.3)",
        }}
        animate={{
          top: ["-10%", "110%", "-10%"],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      {/* Glitching overlay text */}
      <div className="absolute bottom-10 z-30 flex flex-col items-center">
        <motion.div 
          className="text-cyan-400 font-mono text-sm tracking-[0.5em] font-bold uppercase mix-blend-screen"
          animate={{
            opacity: [1, 0.5, 1, 0, 1],
            x: [0, -2, 2, -1, 0],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "mirror"
          }}
        >
          Processing
        </motion.div>
      </div>
    </div>
  );
}
