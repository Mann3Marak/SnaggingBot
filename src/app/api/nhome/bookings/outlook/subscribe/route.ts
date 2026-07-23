import { NextResponse } from 'next/server'
import { getAppGraphToken } from '@/lib/server/nhome-graph-auth'
import { outlookConfig, isOutlookConfigured } from '@/lib/server/outlook-sync'

// POST /api/nhome/bookings/outlook/subscribe
// Creates (or refreshes) the Microsoft Graph change-notification subscription that
// powers inbound Outlook → app sync. Graph subscriptions on calendar events expire
// after ~3 days, so this should be re-run on a schedule (cron) to renew.
export async function POST() {
  try {
    if (!isOutlookConfigured()) {
      return NextResponse.json({ error: 'Outlook is not configured' }, { status: 400 })
    }
    const webhookUrl = process.env.NHOME_OUTLOOK_WEBHOOK_URL
    if (!webhookUrl) {
      return NextResponse.json(
        {
          error: 'Missing NHOME_OUTLOOK_WEBHOOK_URL',
          detail: 'Set it to the public HTTPS URL of /api/nhome/bookings/outlook/webhook',
        },
        { status: 400 }
      )
    }

    const { user, calendarId } = outlookConfig()
    const resource = calendarId
      ? `/users/${user}/calendars/${calendarId}/events`
      : `/users/${user}/events`

    // Max expiration for calendar-event subscriptions is ~4230 minutes; stay under it.
    const expiration = new Date(Date.now() + 60 * 60 * 1000 * 70) // ~2.9 days

    const token = await getAppGraphToken()
    const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        changeType: 'created,updated,deleted',
        notificationUrl: webhookUrl,
        resource,
        expirationDateTime: expiration.toISOString(),
        clientState: process.env.NHOME_OUTLOOK_CLIENT_STATE || 'nhome-bookings',
      }),
      cache: 'no-store',
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to create subscription', detail: data },
        { status: res.status }
      )
    }

    return NextResponse.json({
      message: 'Outlook subscription active',
      subscriptionId: data.id,
      expiresAt: data.expirationDateTime,
    })
  } catch (err: any) {
    console.error('Error creating Outlook subscription:', err)
    return NextResponse.json(
      { error: 'Unexpected server error', detail: err?.message },
      { status: 500 }
    )
  }
}
