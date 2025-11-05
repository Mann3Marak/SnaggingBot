// Script to query current database status
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://emjhzqradnokxkxnykte.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtamh6cXJhZG5va3hreG55a3RlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjE5MDI0MSwiZXhwIjoyMDc3NzY2MjQxfQ.9nIIW0zY0D9cZ8idTSHAvL4LD9WM9GFlOxvxvBxRz60'

const supabase = createClient(supabaseUrl, supabaseKey)

async function queryDatabase() {
  console.log('='.repeat(80))
  console.log('DATABASE STATUS REPORT')
  console.log('='.repeat(80))
  console.log()

  // Query all projects
  console.log('1. PROJECTS')
  console.log('-'.repeat(80))
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (projectsError) {
    console.error('Error fetching projects:', projectsError)
  } else {
    console.log(`Total projects: ${projects?.length || 0}`)
    projects?.forEach(project => {
      console.log(`\n  Project ID: ${project.id}`)
      console.log(`  Name: ${project.name}`)
      console.log(`  Description: ${project.description || 'N/A'}`)
      console.log(`  Building Name: ${project.building_name || 'N/A'}`)
      console.log(`  Total Apartments: ${project.total_apartments || 'N/A'}`)
      console.log(`  Created: ${new Date(project.created_at).toLocaleString()}`)
    })
  }

  console.log()
  console.log()

  // Query all apartments with client info
  console.log('2. APARTMENTS (with Client Information)')
  console.log('-'.repeat(80))
  const { data: apartments, error: apartmentsError } = await supabase
    .from('apartments')
    .select(`
      *,
      projects (
        name,
        address
      )
    `)
    .order('created_at', { ascending: false })

  if (apartmentsError) {
    console.error('Error fetching apartments:', apartmentsError)
  } else {
    console.log(`Total apartments: ${apartments?.length || 0}`)
    apartments?.forEach(apt => {
      console.log(`\n  Apartment ID: ${apt.id}`)
      console.log(`  Unit Number: ${apt.unit_number}`)
      console.log(`  Apartment Type: ${apt.apartment_type}`)
      console.log(`  Project: ${apt.projects?.name || 'N/A'}`)
      console.log(`  Building Number: ${apt.building_number || 'N/A'}`)
      console.log(`  Floor: ${apt.floor_number || 'N/A'}`)
      console.log(`  Client: ${apt.client_name || 'N/A'} ${apt.client_surname || ''}`.trim())
      console.log(`  Status: ${apt.status}`)
      console.log(`  Created: ${new Date(apt.created_at).toLocaleString()}`)
    })
  }

  console.log()
  console.log()

  // Query all inspection sessions (not just active ones)
  console.log('3. INSPECTION SESSIONS')
  console.log('-'.repeat(80))
  const { data: sessions, error: sessionsError } = await supabase
    .from('inspection_sessions')
    .select(`
      *,
      apartments (
        unit_number,
        apartment_type,
        building_number,
        client_name,
        client_surname,
        projects (
          name,
          address
        )
      )
    `)
    .order('started_at', { ascending: false })

  let activeOrInProgress: any[] = []

  if (sessionsError) {
    console.error('Error fetching inspection sessions:', sessionsError)
  } else {
    console.log(`Total inspection sessions: ${sessions?.length || 0}`)

    // Group by status
    const byStatus = sessions?.reduce((acc, session) => {
      acc[session.status] = (acc[session.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('\nBy Status:')
    Object.entries(byStatus || {}).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`)
    })

    // Show active/in-progress sessions
    activeOrInProgress = sessions?.filter(s =>
      ['active', 'in_progress'].includes(s.status)
    ) || []

    if (activeOrInProgress && activeOrInProgress.length > 0) {
      console.log('\nACTIVE/IN-PROGRESS SESSIONS:')
      activeOrInProgress.forEach(session => {
        console.log(`\n  Session ID: ${session.id}`)
        console.log(`  Status: ${session.status}`)
        console.log(`  Type: ${session.inspection_type || 'N/A'}`)
        console.log(`  Project: ${session.apartments?.projects?.name || 'N/A'}`)
        console.log(`  Building Number: ${session.apartments?.building_number || 'N/A'}`)
        console.log(`  Apartment: ${session.apartments?.unit_number || 'N/A'} (${session.apartments?.apartment_type || 'N/A'})`)
        console.log(`  Client: ${session.apartments?.client_name || ''} ${session.apartments?.client_surname || ''}`.trim())
        console.log(`  Created: ${new Date(session.started_at).toLocaleString()}`)
        console.log(`  Completed: ${session.completed_at ? new Date(session.completed_at).toLocaleString() : 'In Progress'}`)
      })
    } else {
      console.log('\nNo active or in-progress sessions found.')
    }

    // Show recent completed sessions
    const recentCompleted = sessions?.filter(s =>
      ['completed', 'finalised'].includes(s.status)
    ).slice(0, 5)

    if (recentCompleted && recentCompleted.length > 0) {
      console.log('\n\nRECENT COMPLETED SESSIONS (Last 5):')
      recentCompleted.forEach(session => {
        console.log(`\n  Session ID: ${session.id}`)
        console.log(`  Status: ${session.status}`)
        console.log(`  Type: ${session.inspection_type || 'N/A'}`)
        console.log(`  Apartment: ${session.apartments?.unit_number || 'N/A'} (${session.apartments?.apartment_type || 'N/A'})`)
        console.log(`  Client: ${session.apartments?.client_name || ''} ${session.apartments?.client_surname || ''}`.trim())
        console.log(`  Completed: ${session.completed_at ? new Date(session.completed_at).toLocaleString() : 'N/A'}`)
      })
    }
  }

  console.log()
  console.log()

  // Query inspection results for active sessions
  console.log('4. INSPECTION RESULTS (for active sessions)')
  console.log('-'.repeat(80))
  if (activeOrInProgress && activeOrInProgress.length > 0) {
    const sessionIds = activeOrInProgress.map(s => s.id)
    const { data: results, error: resultsError } = await supabase
      .from('inspection_results')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })

    if (resultsError) {
      console.error('Error fetching inspection results:', resultsError)
    } else {
      console.log(`Total inspection items logged: ${results?.length || 0}`)

      // Group by session
      const bySession = results?.reduce((acc, result) => {
        if (!acc[result.session_id]) {
          acc[result.session_id] = []
        }
        acc[result.session_id].push(result)
        return acc
      }, {} as Record<string, any[]>)

      Object.entries(bySession || {}).forEach(([sessionId, items]) => {
        const session = activeOrInProgress?.find(s => s.id === sessionId)
        console.log(`\n  Session: ${session?.apartments?.unit_number || sessionId}`)
        console.log(`  Items: ${items.length}`)
        console.log(`  Status breakdown: ${items.reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)}`)
      })
    }
  } else {
    console.log('No active sessions to show results for.')
  }

  console.log()
  console.log('='.repeat(80))
  console.log('END OF REPORT')
  console.log('='.repeat(80))
}

queryDatabase().catch(console.error)
