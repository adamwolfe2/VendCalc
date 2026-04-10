import { NextResponse } from "next/server"

interface NationalRecord {
  id: string
  fields: {
    "Location Name"?: string
    "Monthly Revenue"?: number
    "Property Type"?: string
    "Unit Count"?: number
    "Revenue Per Unit"?: number
    "Machine Type"?: string
    "Number of Machines"?: number
    "Placement Location"?: string
  }
}

interface NationalResponse {
  records: NationalRecord[]
  offset?: string
}

function filterOutliers(values: number[]): number[] {
  if (values.length < 3) return values

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  const stdDev = Math.sqrt(variance)

  return values.filter((val) => Math.abs(val - mean) <= 2 * stdDev)
}

export async function GET(request: Request) {
  const apiKey = process.env.AIRTABLE_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "Airtable API key not configured" }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const propertyType = searchParams.get("propertyType")
  const daysOpen = searchParams.get("daysOpen")

  const baseId = "appgqED05AlPLi0ar"
  const tableId = "tblqvGhUYwuT9X2aj"

  try {
    let url = `https://api.airtable.com/v0/${baseId}/${tableId}`

    if (propertyType) {
      const filterFormula = `{Property Type}="${propertyType}"`
      url += `?filterByFormula=${encodeURIComponent(filterFormula)}`
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch from Airtable" }, { status: response.status })
    }

    const data: NationalResponse = await response.json()

    const validRecords = data.records.filter(
      (r) =>
        typeof r.fields["Monthly Revenue"] === "number" &&
        r.fields["Monthly Revenue"] > 0 &&
        typeof r.fields["Number of Machines"] === "number" &&
        r.fields["Number of Machines"] > 0,
    )

    if (validRecords.length === 0) {
      return NextResponse.json({
        avgRevenuePerMachine: 0,
        minRevenue: 0,
        maxRevenue: 0,
        sampleSize: 0,
      })
    }

    const perMachineRevenues = validRecords.map((r) => {
      const monthlyRevenue = r.fields["Monthly Revenue"] || 0
      const numberOfMachines = r.fields["Number of Machines"] || 1
      return monthlyRevenue / numberOfMachines
    })

    const filteredRevenues = filterOutliers(perMachineRevenues)

    if (filteredRevenues.length === 0) {
      return NextResponse.json({
        avgRevenuePerMachine: 0,
        minRevenue: 0,
        maxRevenue: 0,
        sampleSize: 0,
      })
    }

    const totalPerMachineRevenue = filteredRevenues.reduce((sum, value) => sum + value, 0)
    let avgRevenuePerMachine = totalPerMachineRevenue / filteredRevenues.length

    let minRevenue = Math.min(...filteredRevenues)
    let maxRevenue = Math.max(...filteredRevenues)

    if (daysOpen) {
      const daysOpenNum = Number.parseInt(daysOpen)
      if (!isNaN(daysOpenNum) && daysOpenNum > 0) {
        avgRevenuePerMachine = (avgRevenuePerMachine / 7) * daysOpenNum
        minRevenue = (minRevenue / 7) * daysOpenNum
        maxRevenue = (maxRevenue / 7) * daysOpenNum
      }
    }

    return NextResponse.json({
      avgRevenuePerMachine,
      minRevenue,
      maxRevenue,
      sampleSize: filteredRevenues.length,
    })
  } catch {
    return NextResponse.json({ error: "Unable to load benchmark data" }, { status: 500 })
  }
}
