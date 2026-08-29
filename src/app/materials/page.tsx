'use client'

import { motion } from 'framer-motion'
import { useCourse } from '@/lib/useCourse'
import { MaterialLibrary } from '@/components/MaterialLibrary'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

export default function MaterialsPage() {
  const course = useCourse()
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
      <MaterialLibrary course={course} />
    </motion.div>
  )
}