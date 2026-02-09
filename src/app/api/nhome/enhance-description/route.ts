import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/server/apiAuth'
import { logger } from '@/lib/logger'
import { enforceRateLimit } from '@/lib/server/rateLimit'

/**
 * GET handler for authentication enforcement
 * Returns 405 Method Not Allowed only after authentication check
 * This prevents endpoint enumeration through unauthenticated 405 responses
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication first (returns 401 if not authenticated)
    await requireApiAuth(request)

    // After authentication, return 405 for wrong method
    return NextResponse.json(
      { error: 'Method not allowed. Use POST to enhance descriptions.' },
      { status: 405 }
    )
  } catch (error: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (error instanceof NextResponse) {
      return error
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  let userInput = ''
  try {
    // Authenticate user (doesn't need ownership check as it's just AI enhancement)
    const { user: authUser } = await requireApiAuth(request)
    const rateLimitResponse = await enforceRateLimit(
      request,
      {
        keyPrefix: 'nhome-enhance-description',
        windowMs: 60_000,
        max: 60,
      },
      { identifier: authUser.id }
    )
    if (rateLimitResponse) return rateLimitResponse

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      logger.warn('[Enhance Description] Malformed JSON', {
        userId: authUser.id,
        error: jsonError instanceof Error ? jsonError.message : 'Unknown',
      })
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const {
      userInput: ui,
      item,
      room,
      nhome_standards,
      property_type,
      location,
    } = body

    // Validate required fields
    if (!ui || typeof ui !== 'string' || ui.trim() === '') {
      logger.warn('[Enhance Description] Missing or invalid userInput', {
        userId: authUser.id,
      })
      return NextResponse.json(
        { error: 'Missing required field: userInput' },
        { status: 400 }
      )
    }

    userInput = ui

    logger.info('[Enhance Description] Processing enhancement request', {
      userId: authUser.id,
      item,
      room,
    })
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      logger.warn('OPENAI_API_KEY not configured')
      return NextResponse.json({ enhanced: userInput })
    }

    const system = `You are enhancing property inspection notes for NHome Property Management, 
a professional property service company in the Algarve, Portugal, founded by Natalie O'Kelly.

CONTEXT:
- Company: NHome Property Setup & Management
- Location: ${location || 'Algarve, Portugal'}
- Property Type: ${property_type || 'Residential'}
- Standards: ${nhome_standards || 'Professional quality standards'}

ENHANCEMENT REQUIREMENTS:
- Convert casual observations into professional inspection language
- Reference appropriate construction/property terminology
- Include specific repair or attention recommendations
- Consider Algarve climate factors (humidity, coastal conditions) when relevant
- Maintain professional tone suitable for developer communication
- Keep descriptions concise but comprehensive
- Use terminology appropriate for international property owners

EXAMPLES:
Input: "door doesn't close right"
Output: "Door requires adjustment for proper closure - recommend checking hinge alignment and frame settling. Common in coastal properties due to humidity changes."

Input: "paint looks bad"  
Output: "Wall paint finish shows uneven coverage and requires professional touch-up to meet NHome quality standards. Recommend surface preparation and reapplication."

Input: "tiles are loose"
Output: "Tile installation shows loose sections requiring immediate attention. Recommend professional re-fixing with appropriate adhesive. Critical for bathroom waterproofing integrity."`

    const user = `Room: ${room}
Item: ${item}
Inspector observation: "${userInput}"
NHome Standards: ${nhome_standards}

Enhance this observation into a professional NHome inspection note:`

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      logger.error('OpenAI enhance error', { detail })
      return NextResponse.json({ enhanced: userInput })
    }

    const data = await resp.json()
    const enhanced = data?.choices?.[0]?.message?.content || userInput

    logger.info('[Enhance Description] Enhancement completed', {
      userId: authUser.id,
      originalLength: userInput.length,
      enhancedLength: enhanced.length,
    })

    return NextResponse.json({
      enhanced,
      nhome_context: {
        company: 'NHome Property Setup & Management',
        location: location,
        standards: 'Professional Algarve property standards',
      },
    })
  } catch (error: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (error instanceof NextResponse) {
      return error
    }

    logger.error('[Enhance Description] Enhancement error', {
      error: error.message,
    })
    return NextResponse.json({ enhanced: userInput })
  }
}
