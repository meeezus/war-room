// Animation tokens adapted from Folio, adjusted for emerald accent

// Spring configuration
export const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

// Timing tokens (ms)
export const timing = {
  instant: 0,
  fast: 100,
  normal: 150,
  deliberate: 200,
  slow: 300,
} as const;

// Easing functions
export const easing = {
  entrance: [0, 0, 0.2, 1] as const,
  state: [0.4, 0, 0.2, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
};

// Hover animations -- emerald accent
export const hoverLift = {
  y: -2,
  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.15)",
};

export const hoverScale = {
  scale: 1.02,
  boxShadow: "0 8px 20px rgba(16, 185, 129, 0.12)",
};

// Tap feedback
export const tapScale = { scale: 0.97 };

// Stagger for lists
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, x: -20 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: timing.deliberate / 1000,
      ease: easing.entrance,
    },
  },
};

// Feedback animations
export const feedback = {
  tap: { scale: 0.97 },
  success: { scale: [1, 1.05, 1] },
  error: { x: [0, -4, 4, -4, 0] },
} as const;

// Fade in from bottom
export const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: timing.slow / 1000,
      ease: easing.entrance,
    },
  },
};

// Reduced motion support
export const reducedMotionTransition = {
  type: "tween" as const,
  duration: 0,
};
