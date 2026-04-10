import { NextResponse } from "next/server"

interface AirtableRecord {
  id: string
  fields: {
    "Location Name"?: string
    "Location Address"?: string
    "Property Type"?: string
    "Placement Location"?: string
    "Machine Type"?: string
    "Number of Machines"?: number
    "Monthly Revenue"?: number
    "Revenue Per Machine"?: number
    "Days Open Per Week"?: number
    "City Type"?: string
    "Location Type"?: string // Airtable may use either "City Type" or "Location Type"
    "Unit Count"?: number
    [key: string]: unknown // Allow for any additional fields
  }
}

interface AirtableResponse {
  records: AirtableRecord[]
  offset?: string
}

export async function GET() {
  const apiKey = process.env.AIRTABLE_API_KEY

  console.log("[v0] ========== AIRTABLE CONNECTION STATUS ==========")
  console.log("[v0] API Key configured:", !!apiKey)

  if (!apiKey) {
    console.log("[v0] ERROR: Airtable API key not configured")
    return NextResponse.json({ error: "Airtable API key not configured" }, { status: 500 })
  }

  const baseId = "appgqED05AlPLi0ar"
  const tableId = "tblkadlOcE5xxrJCu"
  const viewId = "viwxismRdvkfehzcD"

  console.log("[v0] Base ID:", baseId)
  console.log("[v0] Table ID:", tableId)
  console.log("[v0] View ID:", viewId)

  try {
    console.log("[v0] Fetching ALL records from Airtable (paginated, no cache)...")

    // CRITICAL: Paginate to fetch ALL records (Airtable returns max 100 per page)
    let allRecords: AirtableRecord[] = []
    let offset: string | undefined = undefined
    let pageCount = 0

    do {
      pageCount++
      const url = offset
        ? `https://api.airtable.com/v0/${baseId}/${tableId}?view=${viewId}&offset=${offset}`
        : `https://api.airtable.com/v0/${baseId}/${tableId}?view=${viewId}`

      const airtableResponse = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      })

      if (!airtableResponse.ok) {
        console.log("[v0] ERROR: Airtable fetch failed with status:", airtableResponse.status)
        return NextResponse.json({ error: "Failed to fetch from Airtable" }, { status: airtableResponse.status })
      }

      const data: AirtableResponse = await airtableResponse.json()
      allRecords = allRecords.concat(data.records)
      offset = data.offset // Will be undefined when no more pages
      
      console.log(`[v0] Page ${pageCount}: fetched ${data.records.length} records (total so far: ${allRecords.length})`)
    } while (offset)

    console.log("[v0] ========== AIRTABLE FETCH COMPLETE ==========")
    console.log("[v0] Total records fetched across all pages:", allRecords.length)

    if (allRecords.length > 0) {
      const sampleRecord = allRecords[0]
      console.log("[v0] Available field names:", Object.keys(sampleRecord.fields))

      // Log unique property types in the data
      const propertyTypes = [...new Set(allRecords.map((r) => r.fields["Property Type"]).filter(Boolean))]
      console.log("[v0] Unique Property Types in data:", propertyTypes)

      // Log unique placement locations in the data
      const placementLocations = [...new Set(allRecords.map((r) => r.fields["Placement Location"]).filter(Boolean))]
      console.log("[v0] Unique Placement Locations in data:", placementLocations)

      // Log unique city/location types
      const locationTypes = [...new Set(allRecords.map((r) => r.fields["Location Type"] || r.fields["City Type"]).filter(Boolean))]
      console.log("[v0] Unique Location/City Types in data:", locationTypes)

      // DATA VALIDATION: Comprehensive quality report
      const zeroMachines = allRecords.filter(r => !r.fields["Number of Machines"] || r.fields["Number of Machines"] === 0)
      const zeroRevenue = allRecords.filter(r => !r.fields["Monthly Revenue"] || r.fields["Monthly Revenue"] === 0)
      const zeroPerMachine = allRecords.filter(r => !r.fields["Revenue Per Machine"] || r.fields["Revenue Per Machine"] === 0)
      const missingPropertyType = allRecords.filter(r => !r.fields["Property Type"])
      const missingPlacement = allRecords.filter(r => !r.fields["Placement Location"])
      const missingLocationType = allRecords.filter(r => !r.fields["Location Type"] && !r.fields["City Type"])
      
      // Check for revenue mismatch (monthly / machines != per machine)
      const revenueMismatch = allRecords.filter(r => {
        const monthly = r.fields["Monthly Revenue"] || 0
        const machines = r.fields["Number of Machines"] || 0
        const perMachine = r.fields["Revenue Per Machine"] || 0
        if (monthly === 0 || machines === 0 || perMachine === 0) return false
        const calculated = monthly / machines
        const ratio = Math.abs(calculated - perMachine) / Math.max(calculated, perMachine)
        return ratio > 0.10
      })
      
      console.log("[v0] ========== DATA QUALITY REPORT ==========")
      console.log(`[v0] Total records: ${allRecords.length}`)
      console.log(`[v0] Missing property type: ${missingPropertyType.length}`)
      console.log(`[v0] Missing placement location: ${missingPlacement.length}`)
      console.log(`[v0] Missing location/city type: ${missingLocationType.length}`)
      console.log(`[v0] Zero/missing machines: ${zeroMachines.length}`)
      console.log(`[v0] Zero/missing monthly revenue: ${zeroRevenue.length}`)
      console.log(`[v0] Zero/missing revenue per machine: ${zeroPerMachine.length}`)
      console.log(`[v0] Revenue math mismatch (>10%): ${revenueMismatch.length}`)

      // Count fully valid records
      const validRecords = allRecords.filter(r => 
        r.fields["Property Type"] &&
        r.fields["Placement Location"] &&
        r.fields["Number of Machines"] && r.fields["Number of Machines"] > 0 &&
        r.fields["Monthly Revenue"] && r.fields["Monthly Revenue"] > 0 &&
        r.fields["Revenue Per Machine"] && r.fields["Revenue Per Machine"] > 0
      )
      console.log(`[v0] Fully valid records: ${validRecords.length} / ${allRecords.length}`)
      
      // Log first few problematic records for debugging
      const problemRecords = allRecords.filter(r => 
        !r.fields["Property Type"] ||
        !r.fields["Placement Location"] ||
        !r.fields["Number of Machines"] || r.fields["Number of Machines"] === 0 ||
        !r.fields["Monthly Revenue"] || r.fields["Monthly Revenue"] === 0 ||
        !r.fields["Revenue Per Machine"] || r.fields["Revenue Per Machine"] === 0
      ).slice(0, 10)
      
      if (problemRecords.length > 0) {
        console.log("[v0] Sample problem records:")
        problemRecords.forEach(r => {
          console.log(`[v0]   - ${r.fields["Location Address"] || "No address"} | Property: ${r.fields["Property Type"] || "MISSING"} | Placement: ${r.fields["Placement Location"] || "MISSING"} | Machines: ${r.fields["Number of Machines"] || 0} | Revenue: $${r.fields["Monthly Revenue"] || 0} | Per Machine: $${r.fields["Revenue Per Machine"] || 0}`)
        })
      }
    }

    const jsonResponse = NextResponse.json({
      records: allRecords,
      meta: {
        totalRecords: allRecords.length,
        propertyTypes: [...new Set(allRecords.map((r) => r.fields["Property Type"]).filter(Boolean))],
        placementLocations: [...new Set(allRecords.map((r) => r.fields["Placement Location"]).filter(Boolean))],
      },
    })
    
    // Set headers to prevent caching - always serve fresh data
    jsonResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    jsonResponse.headers.set("Pragma", "no-cache")
    jsonResponse.headers.set("Expires", "0")
    
    return jsonResponse
  } catch (error) {
    console.log("[v0] ERROR: Exception during Airtable fetch:", error)
    return NextResponse.json({ error: "Unable to load data. Please try again." }, { status: 500 })
  }
}
