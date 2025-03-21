import { FC } from "react";
import { motion } from "framer-motion";

export const HeroIllustration: FC = () => {
  return (
    <motion.svg
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      viewBox="0 0 800 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-w-2xl mx-auto"
    >
      {/* Background Shapes with Animation */}
      <motion.circle
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, duration: 1, ease: "easeOut" }}
        cx="400"
        cy="300"
        r="250"
        className="fill-primary/5"
      />
      <motion.circle
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.4, duration: 1, ease: "easeOut" }}
        cx="400"
        cy="300"
        r="200"
        className="fill-primary/10"
      />

      {/* Animated Stack of Books */}
      <motion.path
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.6, duration: 1 }}
        d="M300 350 L500 350 L480 200 L320 200 Z"
        className="fill-primary"
        opacity="0.9"
      />
      <motion.path
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
        d="M320 200 L480 200 L460 150 L340 150 Z"
        className="fill-primary"
        opacity="0.8"
      />
      <motion.path
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        d="M340 150 L460 150 L440 100 L360 100 Z"
        className="fill-primary"
        opacity="0.7"
      />

      {/* Floating Graduation Cap */}
      <motion.g
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ 
          repeat: Infinity, 
          repeatType: "reverse", 
          duration: 2,
          ease: "easeInOut"
        }}
      >
        <path
          d="M380 50 L420 50 L440 70 L360 70 Z"
          className="fill-primary"
        />
        <path
          d="M360 70 L440 70 L400 90 Z"
          className="fill-primary"
        />
        <line
          x1="400"
          y1="90"
          x2="400"
          y2="120"
          className="stroke-primary"
          strokeWidth="4"
        />
      </motion.g>

      {/* Animated Mathematical Symbols */}
      <motion.g
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        <text x="280" y="280" className="fill-primary text-2xl font-bold">+</text>
        <text x="320" y="320" className="fill-primary text-2xl font-bold">÷</text>
        <text x="460" y="290" className="fill-primary text-2xl font-bold">×</text>
        <text x="500" y="330" className="fill-primary text-2xl font-bold">=</text>
      </motion.g>

      {/* Animated ABC Letters */}
      <motion.g
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.4, duration: 0.8 }}
      >
        <text x="350" y="400" className="fill-primary text-3xl font-bold">A</text>
        <text x="400" y="400" className="fill-primary text-3xl font-bold">B</text>
        <text x="450" y="400" className="fill-primary text-3xl font-bold">C</text>
      </motion.g>

      {/* Animated Decorative Lines */}
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
        d="M250 450 Q 400 500 550 450"
        className="stroke-primary"
        strokeWidth="3"
        fill="none"
      />
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 1.8, duration: 1 }}
        d="M250 460 Q 400 510 550 460"
        className="stroke-primary"
        strokeWidth="2"
        fill="none"
      />
    </motion.svg>
  );
};