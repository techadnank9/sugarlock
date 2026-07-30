'use client'
import { motion, useReducedMotion } from 'framer-motion'

/** The unlock reveal — design/design-tokens.md calls this "the money shot".
 * Locked: slow 3.5s gold breathe loop. Unlock: one hard burst, gold -> teal. */
export function GiftVessel({ status }: { status: 'locked' | 'unlocked' | 'released' }) {
  const reduceMotion = useReducedMotion()
  const isUnlocked = status !== 'locked'

  return (
    <motion.div
      className={`mx-auto h-32 w-32 rounded-full shadow-[0_0_40px_-10px_var(--state)] ${
        isUnlocked ? 'is-unlocked' : 'is-locked'
      }`}
      animate={{
        backgroundColor: isUnlocked ? '#4ca894' : '#d9a441',
        scale: reduceMotion ? 1 : isUnlocked ? [1, 1.2, 1] : [1, 1.04, 1],
      }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : isUnlocked
            ? { duration: 0.7, ease: 'easeOut' }
            : { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }
      }
    />
  )
}
