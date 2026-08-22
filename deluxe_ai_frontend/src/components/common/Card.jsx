"use client";

import { motion } from "framer-motion";

export default function Card({
  children,
  className = "",
  hover = false,
  onClick,
}) {
  return (
    <motion.div
      whileHover={
        hover
          ? {
              y: -2,
              scale: 1.01,
            }
          : {}
      }
      transition={{
        duration: 0.2,
      }}
      onClick={onClick}
      className={`
        rounded-3xl
        border
        border-slate-200
        bg-white
        shadow-sm
        ${hover ? "cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
