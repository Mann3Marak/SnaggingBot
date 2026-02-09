/**
 * Comprehensive Database Backup Script
 *
 * This script creates a complete backup of the Supabase database including:
 * 1. Full data export for all critical tables
 * 2. JSON format for easy restoration
 * 3. SQL INSERT statements for direct restoration
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

// Initialize Supabase client with service role key for full access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Found' : 'Missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Backup directory
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
const backupDir = path.join(process.cwd(), 'backups', `backup_${timestamp}`)

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true })
}

// Critical tables to backup
const criticalTables = [
  'companies',
  'users',
  'projects',
  'apartments',
  'inspection_sessions',
  'inspection_results',
  'checklist_templates',
  'checklist_items',
  'inspection_conversations',
  'inspection_reports',
  'nhome_photos'
]

/**
 * Export table data to JSON
 */
async function exportTableToJSON(tableName: string): Promise<void> {
  console.log(`Exporting ${tableName}...`)

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')

    if (error) {
      console.error(`Error exporting ${tableName}:`, error.message)
      // Create error log
      fs.writeFileSync(
        path.join(backupDir, `${tableName}_ERROR.txt`),
        `Error: ${error.message}\nDetails: ${JSON.stringify(error, null, 2)}`
      )
      return
    }

    // Save as JSON
    const jsonPath = path.join(backupDir, `${tableName}.json`)
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2))

    console.log(`✓ Exported ${data?.length || 0} records from ${tableName}`)
  } catch (err) {
    console.error(`Failed to export ${tableName}:`, err)
    fs.writeFileSync(
      path.join(backupDir, `${tableName}_ERROR.txt`),
      `Error: ${err}`
    )
  }
}

/**
 * Convert JSON data to SQL INSERT statements
 */
function jsonToSQL(tableName: string, data: any[]): string {
  if (!data || data.length === 0) {
    return `-- No data in ${tableName}\n`
  }

  const columns = Object.keys(data[0])
  let sql = `-- ${tableName} (${data.length} rows)\n`
  sql += `-- Generated: ${new Date().toISOString()}\n\n`

  for (const row of data) {
    const values = columns.map(col => {
      const val = row[col]
      if (val === null) return 'NULL'
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
      if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`
      return val
    })

    sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`
  }

  sql += '\n'
  return sql
}

/**
 * Main backup function
 */
async function createBackup() {
  console.log('='.repeat(60))
  console.log('SUPABASE DATABASE BACKUP')
  console.log('='.repeat(60))
  console.log(`Backup directory: ${backupDir}`)
  console.log(`Timestamp: ${timestamp}`)
  console.log('='.repeat(60))
  console.log('')

  // Export all tables to JSON
  for (const table of criticalTables) {
    await exportTableToJSON(table)
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('CREATING SQL RESTORE SCRIPT')
  console.log('='.repeat(60))
  console.log('')

  // Create combined SQL restore script
  let combinedSQL = `-- Supabase Database Backup - Restore Script\n`
  combinedSQL += `-- Created: ${new Date().toISOString()}\n`
  combinedSQL += `-- Project: SnagginBot_Prod\n`
  combinedSQL += `-- Database: aojewecjssqwkhtrcjim\n`
  combinedSQL += `--\n`
  combinedSQL += `-- IMPORTANT: Review this script before running!\n`
  combinedSQL += `-- This will INSERT data into existing tables.\n`
  combinedSQL += `--\n\n`
  combinedSQL += `-- Disable triggers during restore (optional, uncomment if needed)\n`
  combinedSQL += `-- SET session_replication_role = 'replica';\n\n`

  for (const table of criticalTables) {
    const jsonPath = path.join(backupDir, `${table}.json`)

    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
      combinedSQL += jsonToSQL(table, data)
      console.log(`✓ Generated SQL for ${table} (${data.length} rows)`)
    }
  }

  combinedSQL += `\n-- Re-enable triggers (if disabled above)\n`
  combinedSQL += `-- SET session_replication_role = 'origin';\n\n`
  combinedSQL += `-- Backup restore completed\n`

  // Save combined SQL file
  const sqlPath = path.join(backupDir, 'restore_data.sql')
  fs.writeFileSync(sqlPath, combinedSQL)

  console.log('')
  console.log('='.repeat(60))
  console.log('CREATING BACKUP METADATA')
  console.log('='.repeat(60))
  console.log('')

  // Create backup metadata
  const metadata = {
    timestamp: new Date().toISOString(),
    project: 'SnagginBot_Prod',
    project_ref: 'aojewecjssqwkhtrcjim',
    tables_backed_up: criticalTables,
    backup_directory: backupDir,
    files_created: [
      ...criticalTables.map(t => `${t}.json`),
      'restore_data.sql',
      'backup_metadata.json'
    ]
  }

  fs.writeFileSync(
    path.join(backupDir, 'backup_metadata.json'),
    JSON.stringify(metadata, null, 2)
  )

  console.log('✓ Created backup metadata')
  console.log('')
  console.log('='.repeat(60))
  console.log('BACKUP COMPLETE!')
  console.log('='.repeat(60))
  console.log('')
  console.log(`Location: ${backupDir}`)
  console.log('')
  console.log('Files created:')
  console.log('  - backup_metadata.json (backup information)')
  console.log('  - restore_data.sql (SQL restore script)')
  criticalTables.forEach(t => {
    console.log(`  - ${t}.json (${t} data export)`)
  })
  console.log('')
}

// Run backup
createBackup().catch(error => {
  console.error('Backup failed:', error)
  process.exit(1)
})
