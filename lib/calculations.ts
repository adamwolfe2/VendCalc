import type { LocationRecord, CalculationResult, ComparisonRow, MachineTotals, PlacementLocationData, MachineCountTier } from "./types"

// Map form location names to Airtable placement location values
// Note: Airtable has mixed casing (e.g., "lobby" and "Lobby") - we use case-insensitive matching
const LOCATION_NAME_MAP: Record<string, string> = {
  Lobby: "lobby",
  "Amenity/Lounge Area": "amenity lounge",
  Mailroom: "mail room",
  "Break Room": "breakroom",
  "Gym Area": "gym",
  Other: "other",
  // Additional mappings for Airtable variations
  Clubhouse: "clubhouse",
  "Package Room": "package room",
  "Laundry Room": "laundry room",
  Hallway: "hallway",
}

// Map form property types to Airtable property type values
// Form value -> Airtable value (case-insensitive matching is used)
// Map form property types to ALL possible Airtable property type values
// Some Airtable entries use shorthand, some use full descriptions
// We use "contains" matching so both "Mid Rise Apartment" and 
// "Mid Rise (3-6 stories, sometimes 'O' shaped)" will match
const PROPERTY_TYPE_KEYWORDS: Record<string, string[]> = {
  "Tower Style Apartment (1 building)": ["tower style apartment"],
  "Garden Style Apartment (multiple buildings)": ["garden style apartment"],
  "Mid Rise (3-6 stories, sometimes has elevator)": ["mid rise"],
  "Apartment/High-Rise": ["high rise apartment"],
  "Student Housing": ["student housing"],
  Warehouse: ["warehouse"],
  "Urgent Care": ["urgent care"],
  Hospital: ["hospital"],
  Hotel: ["hotel"],
  "Other Business": ["other business"],
  "Veterinary Hospital": ["veterinary hospital", "veterinary"],
  Gym: ["gym"],
  Office: ["office"],
  "Commercial Building": ["commercial building", "commercial"],
  Manufacturing: ["manufacturing"],
  School: ["school"],
  "Rec Center": ["rec center", "recreation center"],
  "Municipal/Government Building": ["municipal", "government building"],
  "Medical Outpatient Facility": ["medical outpatient"],
  Other: ["other"],
}

function removeDuplicates(records: LocationRecord[]): LocationRecord[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    // Use a composite key that includes enough fields to distinguish unique locations
    // but catch true duplicates (same person, same address, same everything)
    const key = [
      record.propertyType.toLowerCase(),
      record.placementLocation.toLowerCase(),
      record.numberOfMachines,
      record.monthlyRevenue.toFixed(2),
      record.locationName.toLowerCase().trim(),
      (record.cityType || "").toLowerCase(),
    ].join("|")
    if (seen.has(key)) {
      console.log(`[v0] DEDUP: Removing duplicate record - ${record.locationName} (${record.propertyType}, ${record.placementLocation}, ${record.numberOfMachines} machines, $${record.monthlyRevenue.toFixed(2)})`)
      return false
    }
    seen.add(key)
    return true
  })
}

export function calculateProjections(
  records: LocationRecord[],
  propertyType: string,
  plannedLocations: string[],
  daysOpen: number,
  employeeCount: number,
  dailyVisitors: number,
  unitCountRange: string,
  bedCountRange?: string,
  cityTypes?: string[], // Optional city type filter
): CalculationResult {
  // Get keywords for matching against Airtable property type values
  const propertyKeywords = PROPERTY_TYPE_KEYWORDS[propertyType] || [propertyType.toLowerCase()]

  console.log("[v0] ========== INDIVIDUAL RECORD DISPLAY MODE ==========")
  console.log("[v0] Input propertyType:", propertyType, "-> Keywords:", propertyKeywords.join(", "))
  console.log("[v0] Planned locations:", plannedLocations)
  console.log("[v0] Total records in dataset:", records.length)

  // Remove duplicates from source data
  const uniqueRecords = removeDuplicates(records)
  console.log("[v0] After removing duplicates:", uniqueRecords.length, "records")

  // NEW STRUCTURE: Return individual records grouped by placement location
  const placementData: PlacementLocationData[] = []
  let totalSampleSize = 0
  let hasNoData = false
  let projectedMonthlyTotal = 0 // Sum of medians for optional projection

  for (const plannedLocation of plannedLocations) {
    const airtablePlacementLocation = LOCATION_NAME_MAP[plannedLocation] || plannedLocation.toLowerCase()

    console.log(`[v0] --- Processing location: ${plannedLocation} ---`)
    console.log(`[v0] Airtable placement location: ${airtablePlacementLocation}`)

    // Filter by EXACT match: property type AND placement location AND optional city type
    const matchingRecords = uniqueRecords.filter((r) => {
      // Keyword-based matching: check if the Airtable property type contains any of our keywords
      const recordPropertyLower = r.propertyType.toLowerCase()
      const propertyMatch = propertyKeywords.some(keyword => recordPropertyLower.includes(keyword))
      const locationMatch = r.placementLocation.toLowerCase() === airtablePlacementLocation.toLowerCase()
      
      // Optional city type filter - only apply if user selected city types
      // Airtable values may differ from form values, e.g. "Major City (>1M Population)" vs "Major City"
      let cityMatch = true
      if (cityTypes && cityTypes.length > 0 && r.cityType) {
        cityMatch = cityTypes.some(ct => {
          const recordCity = (r.cityType || "").toLowerCase()
          const filterCity = ct.toLowerCase()
          // Use "starts with" matching so "Major City" matches "Major City (>1M Population)"
          // and "City" matches "City (<1M Population)"
          return recordCity.startsWith(filterCity) || recordCity === filterCity
        })
      }
      
      return propertyMatch && locationMatch && cityMatch && r.monthlyRevenue > 0
    })

    console.log(`[v0] Found ${matchingRecords.length} individual records for ${plannedLocation}`)
    
    if (matchingRecords.length > 0) {
      // GROUP BY NUMBER OF MACHINES
      const machineCountGroups = new Map<number, LocationRecord[]>()
      
      matchingRecords.forEach(record => {
        const count = record.numberOfMachines
        if (!machineCountGroups.has(count)) {
          machineCountGroups.set(count, [])
        }
        machineCountGroups.get(count)!.push(record)
      })

      console.log(`[v0] Grouped into ${machineCountGroups.size} machine count tiers`)

      // Calculate stats for each machine count tier
      const machineCountTiers: MachineCountTier[] = []
      let allRevenueValues: number[] = []

      Array.from(machineCountGroups.entries())
        .sort(([a], [b]) => a - b) // Sort by machine count ascending
        .forEach(([machineCount, records]) => {
          // CRITICAL: Use MONTHLY REVENUE (total for that location), NOT per-machine
          const monthlyRevenueValues = records.map(r => r.monthlyRevenue)
          allRevenueValues = allRevenueValues.concat(monthlyRevenueValues)
          
          const sortedRevenues = [...monthlyRevenueValues].sort((a, b) => a - b)
          const mid = Math.floor(sortedRevenues.length / 2)
          const medianRevenue = sortedRevenues.length % 2 !== 0
            ? sortedRevenues[mid]
            : (sortedRevenues[mid - 1] + sortedRevenues[mid]) / 2
          const avgRevenue = monthlyRevenueValues.reduce((sum, val) => sum + val, 0) / monthlyRevenueValues.length
          const minRevenue = Math.min(...monthlyRevenueValues)
          const maxRevenue = Math.max(...monthlyRevenueValues)

          machineCountTiers.push({
            machineCount,
            records,
            sampleSize: records.length,
            minRevenue,
            maxRevenue,
            medianRevenue,
            avgRevenue,
          })

          console.log(`[v0]   ${machineCount} machine(s): ${records.length} locations, Median Monthly Revenue: $${medianRevenue.toFixed(2)}, Range: $${minRevenue.toFixed(2)}-$${maxRevenue.toFixed(2)}`)
        })

      // Calculate overall stats across all machine counts
      const overallMin = Math.min(...allRevenueValues)
      const overallMax = Math.max(...allRevenueValues)
      const sortedAll = [...allRevenueValues].sort((a, b) => a - b)
      const overallMid = Math.floor(sortedAll.length / 2)
      const overallMedian = sortedAll.length % 2 !== 0
        ? sortedAll[overallMid]
        : (sortedAll[overallMid - 1] + sortedAll[overallMid]) / 2

      placementData.push({
        placementLocation: plannedLocation,
        machineCountTiers,
        totalLocations: matchingRecords.length,
        // Legacy fields
        records: matchingRecords,
        count: matchingRecords.length,
        minRevenue: overallMin,
        maxRevenue: overallMax,
        medianRevenue: overallMedian,
      })

      totalSampleSize += matchingRecords.length
      projectedMonthlyTotal += overallMedian
      
      console.log(`[v0] Overall range for ${plannedLocation}: $${overallMin.toFixed(2)} - $${overallMax.toFixed(2)} per machine`)
    } else {
      // NO DATA for this placement location
      placementData.push({
        placementLocation: plannedLocation,
        machineCountTiers: [],
        totalLocations: 0,
        // Legacy fields
        records: [],
        count: 0,
        minRevenue: 0,
        maxRevenue: 0,
        medianRevenue: 0,
      })
      hasNoData = true
      console.log(`[v0] NO DATA for ${plannedLocation}`)
    }
  }

  console.log(`[v0] ========== FINAL RESULTS ==========`)
  console.log(`[v0] Total records across all placement locations: ${totalSampleSize}`)
  console.log(`[v0] Projected monthly (sum of medians): $${projectedMonthlyTotal.toFixed(2)}`)
  console.log(`[v0] Has no-data placements: ${hasNoData}`)

  // Determine confidence level based on sample size
  let confidenceLevel: CalculationResult["confidenceLevel"]
  if (totalSampleSize === 0) {
    confidenceLevel = "estimate"
  } else if (totalSampleSize >= 10) {
    confidenceLevel = "high"
  } else if (totalSampleSize >= 5) {
    confidenceLevel = "medium"
  } else if (totalSampleSize >= 2) {
    confidenceLevel = "limited"
  } else {
    confidenceLevel = "estimate"
  }

  const totalAnnual = projectedMonthlyTotal * 12

  // Legacy compatibility fields (can be phased out)
  const locationBreakdowns: ComparisonRow[] = placementData.map(pd => ({
    locationName: pd.placementLocation,
    oneMachine: pd.medianRevenue,
    twoMachines: pd.medianRevenue * 2,
    threeMachines: pd.medianRevenue * 3,
    fourMachines: pd.medianRevenue * 4,
  }))

  const monthlyTotals: MachineTotals = {
    oneMachine: projectedMonthlyTotal,
    twoMachines: projectedMonthlyTotal * 2,
    threeMachines: projectedMonthlyTotal * 3,
    fourMachines: projectedMonthlyTotal * 4,
  }

  const annualTotals: MachineTotals = {
    oneMachine: monthlyTotals.oneMachine * 12,
    twoMachines: monthlyTotals.twoMachines * 12,
    threeMachines: monthlyTotals.threeMachines * 12,
    fourMachines: monthlyTotals.fourMachines * 12,
  }

  let avgRevenue = 0
  let minRevenue = 0
  let maxRevenue = 0
  let q1Revenue = 0
  let q3Revenue = 0

  if (totalSampleSize > 0) {
    avgRevenue = projectedMonthlyTotal / placementData.length
    minRevenue = Math.min(...placementData.map(pd => pd.minRevenue))
    maxRevenue = Math.max(...placementData.map(pd => pd.maxRevenue))
    q1Revenue = placementData[Math.floor(placementData.length / 4)]?.minRevenue || 0
    q3Revenue = placementData[Math.floor((placementData.length * 3) / 4)]?.maxRevenue || 0
  } else {
    // NO DATA - show $0 for everything
    avgRevenue = 0
    minRevenue = 0
    maxRevenue = 0
    q1Revenue = 0
    q3Revenue = 0
  }
  
  console.log(`[v0] Avg revenue: $${avgRevenue.toFixed(2)}`)
  console.log(`[v0] Range: $${q1Revenue.toFixed(2)} - $${q3Revenue.toFixed(2)}`)

  let totalMonthly = projectedMonthlyTotal

  // Calculate monthly totals for comparison scenarios
  const comparisonMonthlyTotals: MachineTotals = {
    oneMachine: locationBreakdowns.reduce((sum, row) => sum + row.oneMachine, 0),
    twoMachines: locationBreakdowns.reduce((sum, row) => sum + row.twoMachines, 0),
    threeMachines: locationBreakdowns.reduce((sum, row) => sum + row.threeMachines, 0),
    fourMachines: locationBreakdowns.reduce((sum, row) => sum + row.fourMachines, 0),
  }

  // Calculate annual totals
  const comparisonAnnualTotals: MachineTotals = {
    oneMachine: comparisonMonthlyTotals.oneMachine * 12,
    twoMachines: comparisonMonthlyTotals.twoMachines * 12,
    threeMachines: comparisonMonthlyTotals.threeMachines * 12,
    fourMachines: comparisonMonthlyTotals.fourMachines * 12,
  }

  // Determine match type
  let matchType: "exact" | "property-only" | "fallback" | "none" = totalSampleSize > 0 ? "exact" : "none"

  return {
    // NEW: Individual record data grouped by placement location
    placementData,
    totalMonthly,
    totalAnnual,
    overallSampleSize: totalSampleSize,
    confidenceLevel,
    
    // Legacy fields for backwards compatibility
    avgRevenue,
    minRevenue,
    maxRevenue,
    q1Revenue,
    q3Revenue,
    projectedMonthly: totalMonthly,
    projectedAnnual: totalAnnual,
    sampleSize: totalSampleSize,
    matchType,
    comparisonTable: locationBreakdowns,
    monthlyTotals: comparisonMonthlyTotals,
    annualTotals: comparisonAnnualTotals,
    usedFallbackData: hasNoData,
  }
}
