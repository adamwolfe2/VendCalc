export interface LocationRecord {
  id: string
  locationName: string
  propertyType: string
  placementLocation: string
  machineType: string
  numberOfMachines: number
  monthlyRevenue: number
  revenuePerMachine: number
  daysOpen?: number
  cityType?: string // Added cityType field: major city, city, suburban, rural
}

export interface MachineCountTier {
  machineCount: number // e.g., 1, 2, 3, 4
  records: LocationRecord[] // Locations with this exact machine count
  sampleSize: number // Number of locations with this machine count
  minRevenue: number // Lowest revenue/machine for this tier
  maxRevenue: number // Highest revenue/machine for this tier
  medianRevenue: number // Median revenue/machine for projection
  avgRevenue: number // Average revenue/machine for this tier
}

export interface PlacementLocationData {
  placementLocation: string // e.g., "Lobby"
  machineCountTiers: MachineCountTier[] // Data grouped by number of machines (1, 2, 3, etc.)
  totalLocations: number // Total locations across all machine counts
  // Legacy fields for backwards compatibility
  records: LocationRecord[]
  count: number
  minRevenue: number
  maxRevenue: number
  medianRevenue: number
}

export interface CalculationResult {
  placementData: PlacementLocationData[] // Individual data for each placement location
  totalMonthly: number // Sum of medians if showing projection
  totalAnnual: number
  overallSampleSize: number // Total records across all placement locations
  confidenceLevel: "high" | "medium" | "limited" | "estimate"
  // Legacy fields for backwards compatibility - can be removed later
  avgRevenue: number
  minRevenue: number
  maxRevenue: number
  q1Revenue: number
  q3Revenue: number
  projectedMonthly: number
  projectedAnnual: number
  sampleSize: number
  matchType: "exact" | "property-placement" | "property-machine" | "property-only" | "none"
  comparisonTable: ComparisonRow[]
  monthlyTotals: MachineTotals
  annualTotals: MachineTotals
  usedFallbackData?: boolean
}

export interface LocationBreakdown {
  locationName: string
  monthlyRevenue: number
  annualRevenue: number
}

export interface NationalBenchmark {
  avgRevenuePerMachine: number
  minRevenue: number
  maxRevenue: number
  sampleSize: number
}

export interface ComparisonRow {
  locationName: string
  oneMachine: number
  twoMachines: number
  threeMachines: number
  fourMachines: number
}

export interface MachineTotals {
  oneMachine: number
  twoMachines: number
  threeMachines: number
  fourMachines: number
}

export const PROPERTY_TYPES = [
  "Tower Style Apartment (1 building)",
  "Garden Style Apartment (multiple buildings)",
  "Mid Rise (3-6 stories, sometimes has elevator)",
  "Apartment/High-Rise",
  "Student Housing",
  "Warehouse",
  "Urgent Care",
  "Hospital",
  "Hotel",
  "Other Business",
  "Veterinary Hospital",
  "Gym",
  "Office",
  "Commercial Building",
  "Manufacturing",
  "School",
  "Rec Center",
  "Municipal/Government Building",
  "Medical Outpatient Facility",
] as const

export const PLACEMENT_LOCATIONS = ["amenity lounge", "lobby", "gym", "laundry room", "mail room"] as const

export const MACHINE_TYPES = ["Stockwell", "Micromart", "Mixed"] as const

export const DAYS_OPEN_OPTIONS = [
  { value: "5", label: "5 days (Mon-Fri)" },
  { value: "6", label: "6 days (Mon-Sat)" },
  { value: "7", label: "7 days" },
] as const

export const PLANNED_LOCATIONS = [
  "Lobby",
  "Amenity/Lounge Area",
  "Mailroom",
  "Break Room",
  "Gym Area",
  "Other",
] as const

export const UNIT_COUNT_RANGES = [
  { value: "1-99", label: "1-99 units" },
  { value: "100-199", label: "100-199 units" },
  { value: "200-299", label: "200-299 units" },
  { value: "300-399", label: "300-399 units" },
  { value: "400-499", label: "400-499 units" },
  { value: "500+", label: "500+ units" },
] as const

export const LOCATION_MULTIPLIERS: Record<string, number> = {
  Lobby: 1.0,
  "Amenity/Lounge Area": 1.0,
  Mailroom: 1.0,
  "Break Room": 1.0,
  "Gym Area": 1.0,
  Other: 1.0,
}

export const BED_COUNT_RANGES = [
  { value: "1-99", label: "1-99 beds" },
  { value: "100-249", label: "100-249 beds" },
  { value: "250-499", label: "250-499 beds" },
  { value: "500-999", label: "500-999 beds" },
  { value: "1000+", label: "1000+ beds" },
] as const

export const CITY_TYPES = [
  "Major City",
  "City", 
  "Suburban",
  "Rural"
] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]
export type PlacementLocation = (typeof PLACEMENT_LOCATIONS)[number]
export type MachineType = (typeof MACHINE_TYPES)[number]
export type PlannedLocation = (typeof PLANNED_LOCATIONS)[number]
export type CityType = (typeof CITY_TYPES)[number]
