import { NextResponse } from "next/server"
import { getAppGraphToken } from "@/lib/server/nhome-graph-auth"

export async function GET() {
  try {
    const access_token = await getAppGraphToken()

    const drivesRes = await fetch("https://graph.microsoft.com/v1.0/drives", {
      headers: { Authorization: `Bearer ${access_token}` },
      cache: "no-store",
    })

    if (!drivesRes.ok) {
      const text = await drivesRes.text()
      return NextResponse.json({ error: "Failed to fetch drives", details: text }, { status: drivesRes.status })
    }

    const drivesData = await drivesRes.json()
    if (!drivesData.value || drivesData.value.length === 0) {
      return NextResponse.json({ error: "No drives available" }, { status: 404 })
    }

    const driveId = drivesData.value[0].id

    const res = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`, {
      headers: { Authorization: `Bearer ${access_token}` },
      cache: "no-store",
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: "Failed to fetch OneDrive items", details: text }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ success: true, driveId, items: data.value })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 })
  }
}
