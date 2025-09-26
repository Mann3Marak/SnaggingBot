import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const { clientEmail, sessionData, reportUrls, projectName, unitNumber } = await request.json()

    if (!clientEmail || !reportUrls?.portuguese) {
      return NextResponse.json({ error: 'Missing clientEmail or report URLs' }, { status: 400 })
    }

    const user = process.env.NHOME_EMAIL
    const pass = process.env.NHOME_EMAIL_PASSWORD
    const host = process.env.NHOME_SMTP_HOST
    const port = process.env.NHOME_SMTP_PORT ? parseInt(process.env.NHOME_SMTP_PORT, 10) : 587
    const secure = process.env.NHOME_SMTP_SECURE === 'true' || port === 465

    if (!user || !pass || !host) {
      return NextResponse.json(
        { error: 'Email transport not configured (NHOME_SMTP_HOST, NHOME_EMAIL, NHOME_EMAIL_PASSWORD).' },
        { status: 400 },
      )
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })

    const html = `<!DOCTYPE html>
<html><head><meta charSet="utf-8" />
<style>body{font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#333} .header{background:linear-gradient(135deg,#2563EB 0%,#0891B2 100%);color:#fff;padding:20px;text-align:center} .content{padding:30px;max-width:600px;margin:0 auto} .button{display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;margin:5px} .section{background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0}</style>
</head><body>
  <div class="header"><div class="logo">NHome Property Management</div><div class="tagline">Professional Property Services in the Algarve</div></div>
  <div class="content">
    <h2>Professional Inspection Documentation</h2>
    <p>Dear Valued Client,</p>
    <p>We are pleased to provide you with the comprehensive professional inspection documentation for:</p>
    <div class="section">
      <strong>Property:</strong> ${projectName}<br />
      <strong>Unit:</strong> ${unitNumber}<br />
      <strong>Inspection Date:</strong> ${new Date(sessionData?.completed_at).toLocaleDateString()}<br />
      <strong>Quality Assessment:</strong> NHome Professional Standards Applied
    </div>
    <h3>Your Professional Documentation Package Includes:</h3>
    <ul>
      <li><strong>Portuguese Professional Report</strong></li>
      <li><strong>English Professional Report</strong></li>
      <li><strong>Professional Photo Documentation</strong></li>
    </ul>
    <div class="section">
      <h4>Access Your Professional Reports:</h4>
      <a href="${reportUrls.portuguese}" class="button">📄 Portuguese Report</a>
      <a href="${reportUrls.english}" class="button">📄 English Report</a>
      <a href="${reportUrls.photoPackage}" class="button">📁 Photo Documentation</a>
    </div>
    <p>These reports have been prepared according to NHome's rigorous professional standards, specifically designed for Algarve properties and international property owners.</p>
    <p>Best regards,<br /><strong>The NHome Professional Team</strong><br />NHome Property Setup & Management</p>
  </div>
</body></html>`

    await transporter.sendMail({
      from: `NHome Property Management <${user}>`,
      to: clientEmail,
      subject: `NHome Professional Inspection Report - ${projectName}, Unit ${unitNumber}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending NHome professional email:', error)
    return NextResponse.json({ error: 'Failed to send professional email' }, { status: 500 })
  }
}

