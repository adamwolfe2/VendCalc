"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Loader2,
  TrendingUp,
  Building2,
  X,
  Users,
  CheckSquare,
  Info,
  RotateCcw,
  MapPin,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import {
  PROPERTY_TYPES,
  PLANNED_LOCATIONS,
  UNIT_COUNT_RANGES,
  LOCATION_MULTIPLIERS,
  BED_COUNT_RANGES,
  CITY_TYPES, // Declare CITY_TYPES variable
  type LocationRecord,
  type CalculationResult,
  type NationalBenchmark,
} from "@/lib/types"
import { calculateProjections } from "@/lib/calculations"

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Failed to fetch data")
  }
  return response.json()
}

const products = [
  {
    name: "Micro Mart",
    machineType: "Micromart",
    description:
      "A large capacity smart cooler that offers automatic product recognition technology for ultimate convenience.",
    image: "/images/micromart-smart-pantry-angle-1024x1024.jpg",
  },
  {
    name: "Stockwell",
    machineType: "Stockwell",
    description: "A secure, self-serve smart cabinet for high-traffic areas.",
    image: "/images/image-clust-hero-stockwell.webp",
  },
  {
    name: "HaHa",
    machineType: "Mixed",
    description: "High-resolution self-checkout kiosk for all micro markets.",
    image: "/images/banner-614x1024.png",
  },
]

const machineType = "Micromart" // Declare machineType variable

export function ROICalculator() {
  const [propertyType, setPropertyType] = useState<string>("")
  const [numberOfEmployees, setNumberOfEmployees] = useState<number>(0)
  const [avgDailyVisitors, setAvgDailyVisitors] = useState<number>(0)
  const [unitCountRange, setUnitCountRange] = useState<string>("")
  const [bedCountRange, setBedCountRange] = useState<string>("")
  const [plannedLocations, setPlannedLocations] = useState<string[]>([])
  const [cityTypes, setCityTypes] = useState<string[]>([]) // City type filter
  const [daysOpen, setDaysOpen] = useState<number>(7)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [nationalBenchmark, setNationalBenchmark] = useState<NationalBenchmark | null>(null)
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set())

  // Use SWR for automatic data fetching and revalidation every 30 seconds
  const { data: airtableData, error: swrError, isLoading: isFetching, mutate } = useSWR(
    "/api/airtable",
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true, // Refresh when window regains focus
      revalidateOnReconnect: true, // Refresh when network reconnects
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
    }
  )

  // Transform Airtable data into records with validation
  const transformRecord = (record: { id: string; fields: Record<string, unknown> }): LocationRecord => ({
    id: record.id,
    locationName: (record.fields["Location Name"] || record.fields["Location Address"] || "") as string,
    propertyType: (record.fields["Property Type"] || "") as string,
    placementLocation: (record.fields["Placement Location"] || "") as string,
    machineType: (record.fields["Machine Type"] || "") as string,
    numberOfMachines: (record.fields["Number of Machines"] as number) || 0,
    monthlyRevenue: (record.fields["Monthly Revenue"] as number) || 0,
    revenuePerMachine: (record.fields["Revenue Per Machine"] as number) || 0,
    daysOpen: (record.fields["Days Open Per Week"] as number) || 7,
    cityType: ((record.fields["Location Type"] || record.fields["City Type"] || "") as string),
  })

  // Validate: only include records with ALL critical revenue fields populated
  const isValidRecord = (r: LocationRecord): boolean => {
    // REQUIRED: Must have property type and placement location
    if (!r.propertyType.trim() || !r.placementLocation.trim()) return false
    // REQUIRED: Number of machines must be at least 1
    if (!r.numberOfMachines || r.numberOfMachines <= 0) return false
    // REQUIRED: Monthly revenue must be a positive number (not $0)
    if (!r.monthlyRevenue || r.monthlyRevenue <= 0) return false
    // REQUIRED: Revenue per machine must be positive
    if (!r.revenuePerMachine || r.revenuePerMachine <= 0) return false
    // SANITY CHECK: Revenue per machine should not exceed monthly revenue
    if (r.revenuePerMachine > r.monthlyRevenue * 1.01) return false // 1% tolerance for rounding
    // SANITY CHECK: Monthly revenue / machines should roughly equal revenue per machine (within 10%)
    const calculatedPerMachine = r.monthlyRevenue / r.numberOfMachines
    const ratio = Math.abs(calculatedPerMachine - r.revenuePerMachine) / Math.max(calculatedPerMachine, r.revenuePerMachine)
    if (ratio > 0.10) {
      console.log(`[v0] EXCLUDED (revenue mismatch): ${r.locationName} - Monthly: $${r.monthlyRevenue}, Machines: ${r.numberOfMachines}, Per Machine: $${r.revenuePerMachine}, Calculated: $${calculatedPerMachine.toFixed(2)}, Ratio: ${(ratio * 100).toFixed(1)}%`)
      return false
    }
    return true
  }

  const allRecords: LocationRecord[] = (airtableData?.records || []).map(transformRecord)
  const records: LocationRecord[] = allRecords.filter(isValidRecord)
  
  const excluded = allRecords.length - records.length
  console.log(`[v0] ========== CLIENT DATA VALIDATION ==========`)
  console.log(`[v0] Total records from Airtable: ${allRecords.length}`)
  console.log(`[v0] Valid records after filtering: ${records.length}`)
  console.log(`[v0] Excluded records: ${excluded}`)
  if (excluded > 0) {
    const noProperty = allRecords.filter(r => !r.propertyType.trim()).length
    const noPlacement = allRecords.filter(r => !r.placementLocation.trim()).length
    const noMachines = allRecords.filter(r => !r.numberOfMachines || r.numberOfMachines <= 0).length
    const noRevenue = allRecords.filter(r => !r.monthlyRevenue || r.monthlyRevenue <= 0).length
    const noPerMachine = allRecords.filter(r => !r.revenuePerMachine || r.revenuePerMachine <= 0).length
    console.log(`[v0]   - Missing property type: ${noProperty}`)
    console.log(`[v0]   - Missing placement: ${noPlacement}`)
    console.log(`[v0]   - Zero/missing machines: ${noMachines}`)
    console.log(`[v0]   - Zero/missing monthly revenue: ${noRevenue}`)
    console.log(`[v0]   - Zero/missing revenue per machine: ${noPerMachine}`)
  }

  // Set error from SWR
  useEffect(() => {
    if (swrError) {
      setError("Unable to load data. Please try again.")
    }
  }, [swrError])

  const resetForm = () => {
    setPropertyType("")
    setNumberOfEmployees(0)
    setAvgDailyVisitors(0)
    setUnitCountRange("")
    setBedCountRange("")
    setPlannedLocations([])
    setCityTypes([])
    setDaysOpen(7)
    setError(null)
    setResult(null)
    setNationalBenchmark(null)
  }

  const handleCalculate = async () => {
    if (!propertyType || plannedLocations.length === 0) {
      setError("Please fill in all required fields")
      return
    }

    if (propertyType === "Apartment/High-Rise" && !unitCountRange) {
      setError("Unit Count Range is required for Apartment/High-Rise properties")
      return
    }

    if (propertyType === "Student Housing" && !bedCountRange) {
      setError("Bed Count Range is required for Student Housing properties")
      return
    }

    setIsLoading(true)
    setError(null)
    setNationalBenchmark(null)

    // CRITICAL: Fetch fresh data from Airtable before each calculation
    console.log("[v0] Fetching fresh Airtable data for calculation...")
    await mutate() // Force revalidate to get latest data
    
    setTimeout(async () => {
      // Use the freshly fetched and validated records
      const freshRecords = (airtableData?.records || []).map(transformRecord).filter(isValidRecord)
      
      console.log(`[v0] Calculating with ${freshRecords.length} valid records from Airtable`)
      
      const calculationResult = calculateProjections(
        freshRecords,
        propertyType,
        plannedLocations,
        daysOpen,
        numberOfEmployees,
        avgDailyVisitors,
        unitCountRange,
        bedCountRange,
        cityTypes, // Pass city type filter
      )

      setResult(calculationResult)
      setIsLoading(false)
    }, 800)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const getConfidenceConfig = (level: CalculationResult["confidenceLevel"]) => {
    switch (level) {
      case "high":
        return {
          label: "High confidence",
          color: "bg-emerald-500",
          textColor: "text-emerald-700",
          bgColor: "bg-emerald-50",
        }
      case "medium":
        return {
          label: "Moderate confidence",
          color: "bg-amber-500",
          textColor: "text-amber-700",
          bgColor: "bg-amber-50",
        }
      case "limited":
        return {
          label: "Limited data",
          color: "bg-orange-500",
          textColor: "text-orange-700",
          bgColor: "bg-orange-50",
        }
      case "estimate":
        return {
          label: "Estimate",
          color: "bg-slate-400",
          textColor: "text-slate-600",
          bgColor: "bg-slate-50",
        }
    }
  }

  const getMachineImage = () => {
    const product = products.find((p) => p.machineType === machineType)
    return product?.image || products[0].image
  }

  const handleLocationToggle = (location: string) => {
    setPlannedLocations((prev) =>
      prev.includes(location) ? prev.filter((loc) => loc !== location) : [...prev, location],
    )
  }

  const isValidInput =
    propertyType &&
    plannedLocations.length > 0 &&
    (propertyType !== "Apartment/High-Rise" || unitCountRange !== "") &&
    (propertyType !== "Student Housing" || bedCountRange !== "")

  const getComparisonStatus = (userValue: number, nationalAvg: number) => {
    if (nationalAvg === 0) return { percentage: 0, status: "neutral" as const }

    const percentage = ((userValue - nationalAvg) / nationalAvg) * 100
    let status: "above" | "average" | "below" = "average"

    if (percentage > 5) status = "above"
    else if (percentage < -10) status = "below"

    return { percentage, status }
  }

  const getConfidenceMessage = (result: CalculationResult): string => {
    if (result.usedFallbackData) {
      return "Estimate - no matching operator data"
    }

    if (result.matchType === "exact") {
      return `Based on ${result.sampleSize} operator-reported location${result.sampleSize === 1 ? "" : "s"}`
    }

    if (result.matchType === "property-only") {
      return `Based on ${result.sampleSize} similar operator-reported location${result.sampleSize === 1 ? "" : "s"}`
    }

    if (result.matchType === "fallback") {
      return `Based on ${result.sampleSize} total operator-reported locations`
    }

    return `Based on ${result.sampleSize} data points`
  }

  const toggleLocationExpansion = (locationName: string) => {
    setExpandedLocations((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(locationName)) {
        newSet.delete(locationName)
      } else {
        newSet.add(locationName)
      }
      return newSet
    })
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div
            key="input-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-gray-200 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-6 sm:p-8 lg:p-12">
                {/* Data Status Indicator */}
                {!isFetching && records.length > 0 && (
                  <div className="mb-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                      <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="font-medium text-emerald-700">Live Data</span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <span>{records.length} verified locations</span>
                    <span className="text-gray-400">•</span>
                    <span>Auto-updates every 30s</span>
                  </div>
                )}
                
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-3">Revenue Calculator</h2>
                <p className="text-gray-600 text-center mb-10 text-base">
                  Select your property details to see projected revenue based on real operator data
                </p>

                {isFetching && records.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#2596be]" />
                    <span className="ml-3 text-gray-600">Loading location data...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Property Type */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Building2 className="h-4 w-4 text-[#2596be]" />
                        Property Type <span className="text-red-500">*</span>
                      </label>
                      <Select value={propertyType} onValueChange={setPropertyType}>
                        <SelectTrigger className="w-full h-14 text-base bg-gray-50 border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                          <SelectValue placeholder="Select property type" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROPERTY_TYPES.map((type) => (
                            <SelectItem key={type} value={type} className="py-3">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {propertyType !== "Apartment/High-Rise" && propertyType !== "Student Housing" && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Users className="h-4 w-4 text-[#2596be]" />
                          Number of Employees
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={numberOfEmployees === 0 ? "" : numberOfEmployees}
                          onChange={(e) => {
                            const value = e.target.value
                            setNumberOfEmployees(value === "" ? 0 : Math.max(0, Number.parseInt(value) || 0))
                          }}
                          placeholder="Optional"
                          className="w-full h-14 text-base bg-gray-50 border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                        />
                      </div>
                    )}

                    {propertyType !== "Apartment/High-Rise" && propertyType !== "Student Housing" && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Users className="h-4 w-4 text-[#2596be]" />
                          Average Daily Visitors
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={avgDailyVisitors === 0 ? "" : avgDailyVisitors}
                          onChange={(e) => {
                            const value = e.target.value
                            setAvgDailyVisitors(value === "" ? 0 : Math.max(0, Number.parseInt(value) || 0))
                          }}
                          placeholder="Optional"
                          className="w-full h-14 text-base bg-gray-50 border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                        />
                        <p className="text-xs text-gray-500">Estimate unique visitors per day, excluding employees.</p>
                      </div>
                    )}

                    {propertyType === "Apartment/High-Rise" && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Building2 className="h-4 w-4 text-[#2596be]" />
                          Unit Count Range <span className="text-red-500">*</span>
                        </label>
                        <Select value={unitCountRange} onValueChange={setUnitCountRange}>
                          <SelectTrigger className="w-full h-14 text-base bg-gray-50 border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                            <SelectValue placeholder="Select unit count range" />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_COUNT_RANGES.map((range) => (
                              <SelectItem key={range.value} value={range.value} className="py-3">
                                {range.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {propertyType === "Student Housing" && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Building2 className="h-4 w-4 text-[#2596be]" />
                          Number of Beds <span className="text-red-500">*</span>
                        </label>
                        <Select value={bedCountRange} onValueChange={setBedCountRange}>
                          <SelectTrigger className="w-full h-14 text-base bg-gray-50 border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                            <SelectValue placeholder="Select bed count range" />
                          </SelectTrigger>
                          <SelectContent>
                            {BED_COUNT_RANGES.map((range) => (
                              <SelectItem key={range.value} value={range.value} className="py-3">
                                {range.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Building2 className="h-4 w-4 text-[#2596be]" />
                        Days Open Per Week <span className="text-red-500">*</span>
                      </label>
                      <Select value={daysOpen.toString()} onValueChange={(val) => setDaysOpen(Number(val))}>
                        <SelectTrigger className="w-full h-14 text-base bg-gray-50 border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                          <SelectValue placeholder="Select days open per week" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                            <SelectItem key={day} value={day.toString()} className="py-3">
                              {day} {day === 1 ? "day" : "days"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* City Type Filter (Optional) */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Building2 className="h-4 w-4 text-[#2596be]" />
                        City Type <span className="text-xs text-gray-500 font-normal">(Optional - for more accurate data)</span>
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {CITY_TYPES.map((cityType) => (
                          <label
                            key={cityType}
                            className="flex items-center gap-2 p-3 bg-gray-50 border-2 border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer transition-all"
                          >
                            <Checkbox
                              checked={cityTypes.includes(cityType)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCityTypes([...cityTypes, cityType])
                                } else {
                                  setCityTypes(cityTypes.filter((t) => t !== cityType))
                                }
                              }}
                              className="h-4 w-4"
                            />
                            <span className="text-sm font-medium text-gray-700">{cityType}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">Select to filter data by city type for more precise projections</p>
                    </div>

                    {/* Planned Machine Locations */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <CheckSquare className="h-4 w-4 text-[#2596be]" />
                        Planned Machine Locations <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {PLANNED_LOCATIONS.map((location) => (
                          <div key={location} className="flex items-center space-x-2">
                            <Checkbox
                              id={location}
                              checked={plannedLocations.includes(location)}
                              onCheckedChange={() => handleLocationToggle(location)}
                              className="border-[#2596be] data-[state=checked]:bg-[#2596be]"
                            />
                            <label htmlFor={location} className="text-sm text-gray-700 cursor-pointer select-none">
                              {location}
                            </label>
                          </div>
                        ))}
                      </div>
                      {plannedLocations.length === 0 && (
                        <p className="text-xs text-red-500">Please select at least one location</p>
                      )}
                    </div>

                    {/* Error State */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <p className="text-red-700 text-center font-medium text-sm">{error}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Calculate Button */}
                    <Button
                      onClick={handleCalculate}
                      disabled={!isValidInput || isLoading}
                      size="lg"
                      className="w-full h-16 text-lg font-semibold bg-[#2596be] hover:bg-[#1e7a9a] text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="mr-2 h-5 w-5" />
                          Calculate Revenue Projection
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={resetForm}
                      variant="outline"
                      size="lg"
                      className="w-full h-14 text-base font-medium border-gray-300 hover:bg-gray-50 rounded-xl transition-all duration-200 bg-transparent"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset Form
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="results-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
              <div className="relative flex h-[90vh] max-h-[700px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
                <div className="flex items-center justify-between bg-gradient-to-r from-[#2596be] to-[#1e7a9a] px-8 py-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-white/20 p-2">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Your Revenue Projection</h2>
                      <p className="text-sm text-white/90">
                        These are estimated projections only. Actual results vary based on operator performance, product
                        selection, and location factors.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null)
                      setNationalBenchmark(null)
                    }}
                    className="rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30"
                  >
                    <X className="h-5 w-5 text-white" />
                  </button>
                </div>

                <CardContent className="p-3 space-y-2 bg-gray-50">
                  {/* Header Stats Row - Monthly/Annual in blue header style */}
                  <div className="bg-gradient-to-r from-[#2596be] to-[#1d7a9e] rounded-lg p-3 text-white">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] opacity-80">Projected Monthly</p>
                        <p className="text-xl font-bold">{result && result.overallSampleSize > 0 ? formatCurrency(result.totalMonthly) : "N/A"}</p>
                        <p className="text-[8px] opacity-70 italic">Based on median values</p>
                      </div>
                      <div>
                        <p className="text-[10px] opacity-80">Projected Annual</p>
                        <p className="text-xl font-bold">{result && result.overallSampleSize > 0 ? formatCurrency(result.totalAnnual) : "N/A"}</p>
                        <p className="text-[8px] opacity-70 italic">See individual data below</p>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Row - Simplified */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="bg-blue-100 rounded-full p-1">
                          <MapPin className="h-3 w-3 text-[#2596be]" />
                        </div>
                        <p className="text-[9px] font-medium text-gray-500 uppercase"># of Placement Locations</p>
                      </div>
                      <p className="text-base font-bold text-gray-900">{result && result.placementData ? result.placementData.length : "0"}</p>
                      <p className="text-[9px] text-gray-500">selected locations</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="bg-blue-100 rounded-full p-1">
                          <CheckSquare className="h-3 w-3 text-[#2596be]" />
                        </div>
                        <p className="text-[9px] font-medium text-gray-500 uppercase">Total Data Points</p>
                      </div>
                      <p className="text-base font-bold text-gray-900">{result && result.overallSampleSize ? result.overallSampleSize : "0"}</p>
                      <p className="text-[9px] text-gray-500">operator locations</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="bg-blue-100 rounded-full p-1">
                          <Info className="h-3 w-3 text-[#2596be]" />
                        </div>
                        <p className="text-[9px] font-medium text-gray-500 uppercase">Confidence</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 capitalize">{result ? result.confidenceLevel : "N/A"}</p>
                      <p className="text-[9px] text-gray-500">{result && result.overallSampleSize > 0 ? `Based on ${result.overallSampleSize} locations` : "Not enough data"}</p>
                    </div>
                  </div>

                  {/* Data Source Card */}
                  <div className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="bg-blue-100 rounded-full p-1">
                        <Info className="h-3 w-3 text-[#2596be]" />
                      </div>
                      <p className="text-[9px] font-medium text-gray-500 uppercase">Data Source</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      {result && result.overallSampleSize > 0 ? `${result.overallSampleSize} operator locations` : "No matching data found"}
                    </p>
                    <p className="text-[9px] text-gray-500">
                      {result && result.overallSampleSize > 0 ? "Real revenue data from actual operator locations" : "Try selecting different property type or location"}
                    </p>
                  </div>

                  {/* Individual Operator Data by Placement Location */}
                  <div className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100 max-h-[400px] overflow-y-auto">
                    <h3 className="text-sm font-bold text-gray-900 mb-0.5">Operator Data by Placement Location</h3>
                    <p className="text-[9px] text-gray-500 mb-2">Real revenue from actual operator locations</p>
                    
                    <div className="space-y-3">
                      {result && result.placementData && result.placementData.map((placement) => (
                        <div key={placement.placementLocation} className="border border-gray-200 rounded p-2">
                          {/* Placement Location Header */}
                          <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-gray-100">
                            <div className="bg-[#2596be] rounded-full p-1">
                              <MapPin className="h-3 w-3 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-gray-900 uppercase">{placement.placementLocation}</p>
                              <p className="text-[9px] text-gray-500">
                                {placement.count > 0 ? `${placement.count} locations in database` : "No operator data available"}
                              </p>
                            </div>
                            {placement.count > 0 && (
                              <div className="text-right">
                                <p className="text-[9px] text-gray-500">Range</p>
                                <p className="text-xs font-semibold text-gray-700">
                                  {formatCurrency(placement.minRevenue)} - {formatCurrency(placement.maxRevenue)}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Machine Count Tiers */}
                          {placement.machineCountTiers && placement.machineCountTiers.length > 0 ? (
                            <div className="space-y-1.5 mt-1">
                              {placement.machineCountTiers.map((tier) => (
                                <div key={tier.machineCount} className="bg-gray-50 rounded p-2 border border-gray-200">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <div className="bg-[#2596be] rounded px-1.5 py-0.5">
                                        <p className="text-[10px] font-bold text-white">{tier.machineCount}</p>
                                      </div>
                                      <p className="text-[10px] font-semibold text-gray-900">
                                        {tier.machineCount === 1 ? '1 Machine' : `${tier.machineCount} Machines`}
                                      </p>
                                    </div>
                                    <p className="text-[9px] text-gray-500">{tier.sampleSize} location{tier.sampleSize !== 1 ? 's' : ''}</p>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <div className="text-center">
                                      <p className="text-[8px] text-gray-500">Median</p>
                                      <p className="text-xs font-bold text-[#2596be]">{formatCurrency(tier.medianRevenue)}</p>
                                      <p className="text-[7px] text-gray-400">monthly revenue</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-[8px] text-gray-500">Low</p>
                                      <p className="text-xs font-semibold text-gray-700">{formatCurrency(tier.minRevenue)}</p>
                                      <p className="text-[7px] text-gray-400">monthly revenue</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-[8px] text-gray-500">High</p>
                                      <p className="text-xs font-semibold text-gray-700">{formatCurrency(tier.maxRevenue)}</p>
                                      <p className="text-[7px] text-gray-400">monthly revenue</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-2 text-center">
                              <p className="text-xs font-semibold text-red-500">Not enough operator data</p>
                              <p className="text-[9px] text-gray-500">No matching records for this property type and location</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Optional: Totals Row for Projection Estimate */}
                    {result && result.overallSampleSize > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-bold text-gray-900">Projection Estimate</p>
                          <div className="text-right">
                            <p className="text-base font-bold text-[#2596be]">{formatCurrency(result.totalMonthly)}<span className="text-gray-500 text-xs font-normal">/mo</span></p>
                            <p className="text-[9px] text-gray-500">{formatCurrency(result.totalAnnual)} annually</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-gray-500 italic">Note: Uses median values from each location. See actual operator data above for full range.</p>
                      </div>
                    )}
                  </div>

                  {/* Compact CTA */}
                  <div className="bg-gradient-to-r from-[#2596be] to-[#1e7a9e] rounded-lg p-2.5 text-white flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-xs">Help improve this calculator</p>
                      <p className="text-[9px] opacity-80">Share your route data for better projections</p>
                    </div>
                    <Button
                      onClick={() => window.open("https://forms.fillout.com/t/ih64AaSuUDus", "_blank")}
                      className="bg-white text-[#2596be] hover:bg-white/90 font-semibold px-3 py-1.5 text-xs rounded-lg"
                    >
                      + Contribute Data
                    </Button>
                  </div>
                </CardContent>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ROICalculator
