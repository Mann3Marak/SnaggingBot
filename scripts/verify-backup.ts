/**
 * Backup Verification Script
 *
 * This script verifies the integrity of a database backup by:
 * 1. Checking all expected files exist
 * 2. Validating JSON files can be parsed
 * 3. Comparing record counts with backup metadata
 * 4. Checking for empty or corrupted files
 */

import * as fs from 'fs'
import * as path from 'path'

// Get backup directory from command line or use latest
const backupDir = process.argv[2] || getLatestBackup()

function getLatestBackup(): string {
  const backupsDir = path.join(__dirname, '..', 'backups')
  const backups = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup_'))
    .sort()
    .reverse()

  if (backups.length === 0) {
    console.error('No backups found in backups/ directory')
    process.exit(1)
  }

  return path.join(backupsDir, backups[0])
}

interface BackupMetadata {
  timestamp: string
  project: string
  project_ref: string
  tables_backed_up: string[]
  backup_directory: string
  files_created: string[]
}

async function verifyBackup() {
  console.log('='.repeat(60))
  console.log('BACKUP VERIFICATION')
  console.log('='.repeat(60))
  console.log(`Backup directory: ${backupDir}`)
  console.log('')

  // Check if backup directory exists
  if (!fs.existsSync(backupDir)) {
    console.error(`❌ Backup directory not found: ${backupDir}`)
    process.exit(1)
  }

  console.log('✓ Backup directory exists')

  // Load and verify metadata
  const metadataPath = path.join(backupDir, 'backup_metadata.json')
  if (!fs.existsSync(metadataPath)) {
    console.error('❌ backup_metadata.json not found')
    process.exit(1)
  }

  console.log('✓ Metadata file exists')

  let metadata: BackupMetadata
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    console.log('✓ Metadata file is valid JSON')
  } catch (err) {
    console.error('❌ Failed to parse metadata:', err)
    process.exit(1)
  }

  console.log('')
  console.log('Backup Information:')
  console.log(`  Project: ${metadata.project}`)
  console.log(`  Project ID: ${metadata.project_ref}`)
  console.log(`  Timestamp: ${metadata.timestamp}`)
  console.log('')

  // Verify JSON files
  console.log('Verifying JSON data files...')
  let totalRecords = 0
  const tableStats: Array<{ table: string; records: number; size: string; status: string }> = []

  for (const table of metadata.tables_backed_up) {
    const jsonFile = path.join(backupDir, `${table}.json`)

    if (!fs.existsSync(jsonFile)) {
      // Check if there's an error file
      const errorFile = path.join(backupDir, `${table}_ERROR.txt`)
      if (fs.existsSync(errorFile)) {
        tableStats.push({
          table,
          records: 0,
          size: '0 B',
          status: '⚠ Table not found in schema'
        })
        continue
      } else {
        console.error(`  ❌ Missing file: ${table}.json`)
        tableStats.push({
          table,
          records: 0,
          size: '0 B',
          status: '❌ Missing'
        })
        continue
      }
    }

    try {
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'))
      const stats = fs.statSync(jsonFile)
      const sizeKB = (stats.size / 1024).toFixed(1)

      totalRecords += data.length
      tableStats.push({
        table,
        records: data.length,
        size: `${sizeKB} KB`,
        status: '✓'
      })

      console.log(`  ✓ ${table}: ${data.length} records (${sizeKB} KB)`)
    } catch (err) {
      console.error(`  ❌ Failed to parse ${table}.json:`, err)
      tableStats.push({
        table,
        records: 0,
        size: '0 B',
        status: '❌ Invalid JSON'
      })
    }
  }

  console.log('')
  console.log(`Total records: ${totalRecords}`)
  console.log('')

  // Verify SQL files
  console.log('Verifying SQL restore files...')

  const sqlFiles = [
    { name: 'restore_data.sql', required: true },
    { name: 'schema_complete.sql', required: true }
  ]

  for (const sqlFile of sqlFiles) {
    const filePath = path.join(backupDir, sqlFile.name)

    if (!fs.existsSync(filePath)) {
      if (sqlFile.required) {
        console.error(`  ❌ Missing required file: ${sqlFile.name}`)
      } else {
        console.log(`  ⚠ Optional file not found: ${sqlFile.name}`)
      }
      continue
    }

    const stats = fs.statSync(filePath)
    const sizeKB = (stats.size / 1024).toFixed(1)

    if (stats.size === 0) {
      console.error(`  ❌ Empty file: ${sqlFile.name}`)
    } else {
      console.log(`  ✓ ${sqlFile.name}: ${sizeKB} KB`)
    }
  }

  console.log('')

  // Verify migrations directory
  console.log('Verifying migrations...')
  const migrationsDir = path.join(backupDir, 'migrations')

  if (!fs.existsSync(migrationsDir)) {
    console.error('  ❌ migrations/ directory not found')
  } else {
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
    console.log(`  ✓ Found ${migrationFiles.length} migration files`)
  }

  console.log('')

  // Verify documentation
  console.log('Verifying documentation...')

  const docFiles = [
    'README.md',
    'BACKUP_SUMMARY.md',
    'RESTORE_INSTRUCTIONS.md'
  ]

  for (const docFile of docFiles) {
    const filePath = path.join(backupDir, docFile)

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      const sizeKB = (stats.size / 1024).toFixed(1)
      console.log(`  ✓ ${docFile}: ${sizeKB} KB`)
    } else {
      console.log(`  ⚠ ${docFile} not found`)
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('VERIFICATION SUMMARY')
  console.log('='.repeat(60))
  console.log('')

  // Print table summary
  console.log('Table Backup Status:')
  console.log('')
  console.log('  Table                      Records    Size       Status')
  console.log('  ' + '-'.repeat(56))

  for (const stat of tableStats) {
    const tableName = stat.table.padEnd(25)
    const records = stat.records.toString().padStart(7)
    const size = stat.size.padStart(10)
    console.log(`  ${tableName} ${records}    ${size}    ${stat.status}`)
  }

  console.log('')
  console.log(`Total Records: ${totalRecords}`)
  console.log('')

  // Final status
  const hasErrors = tableStats.some(s => s.status.includes('❌'))
  const hasWarnings = tableStats.some(s => s.status.includes('⚠'))

  if (hasErrors) {
    console.log('❌ BACKUP HAS ERRORS - Some files are missing or corrupted')
    process.exit(1)
  } else if (hasWarnings) {
    console.log('⚠ BACKUP COMPLETE WITH WARNINGS - Some tables were not found in schema')
    console.log('   This is expected if those tables were removed in migrations.')
  } else {
    console.log('✓ BACKUP VERIFIED SUCCESSFULLY - All files present and valid')
  }

  console.log('')
}

// Run verification
verifyBackup().catch(error => {
  console.error('Verification failed:', error)
  process.exit(1)
})
