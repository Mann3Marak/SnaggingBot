import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let userInput = ''
  try {
    const {
      userInput: ui,
      item,
      room,
      nhome_standards,
      property_type,
      location,
    } = await request.json()

    userInput = ui
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not configured')
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
      console.error('OpenAI enhance error:', detail)
      return NextResponse.json({ enhanced: userInput })
    }

    const data = await resp.json()
    const enhanced = data?.choices?.[0]?.message?.content || userInput

    return NextResponse.json({ 
      enhanced,
      nhome_context: {
        company: 'NHome Property Setup & Management',
        location: location,
        standards: 'Professional Algarve property standards',
      },
    })
  } catch (error) {
    console.error('NHome description enhancement error:', error)
    return NextResponse.json({ enhanced: userInput })
  }
}

