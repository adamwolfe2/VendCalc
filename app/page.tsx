"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { ROICalculator } from "@/components/roi-calculator"

export default function VendingROICalculator() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="border-b border-border bg-card"
      >
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/vp%20new%20logo-K8Zf46EjgbcFDJwnPKs2mmuoBQJPxS.jpg"
              alt="Modern Amenities Logo"
              width={48}
              height={48}
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Vendingpreneurs</h1>
              <p className="text-sm text-muted-foreground">ROI Calculator</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Hero Section */}
        

        {/* Calculator Component */}
        <ROICalculator />
      </div>
    </div>
  )
}
