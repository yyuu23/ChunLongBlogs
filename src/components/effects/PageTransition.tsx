"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** 页面级过渡：每次路由进入时淡入上移 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

/** 滚动渐入：进入视口时淡入上移，配合 delay 做 stagger */
export function FadeIn({ children, delay = 0, y = 24, className }: FadeInProps) {
  return (
    <motion.div
      className={className}
      initial={{ y, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
