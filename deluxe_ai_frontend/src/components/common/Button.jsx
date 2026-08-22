"use client";

import { motion } from "framer-motion";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  className = "",
  onClick,
  type = "button",
}) {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 border border-blue-600",

    secondary:
      "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",

    outline:
      "bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-100",

    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",

    danger: "bg-red-600 text-white hover:bg-red-700 border border-red-600",
  };

  const sizes = {
    sm: "h-9 px-3 text-sm",

    md: "h-11 px-5 text-sm",

    lg: "h-12 px-6 text-base",
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      transition={{ duration: 0.15 }}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        inline-flex
        items-center
        justify-center
        gap-2
        rounded-2xl
        font-medium
        transition-all
        duration-200
        disabled:pointer-events-none
        disabled:opacity-50

        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
    >
      {loading && (
        <span
          className="
            h-4
            w-4
            animate-spin
            rounded-full
            border-2
            border-white
            border-t-transparent
          "
        />
      )}

      {!loading && leftIcon}

      <span>{children}</span>

      {!loading && rightIcon}
    </motion.button>
  );
}
