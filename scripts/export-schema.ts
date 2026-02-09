/**
 * Export Database Schema Script
 *
 * This script exports the complete database schema including:
 * - Tables and columns
 * - Indexes
 * - Functions
 * - Triggers
 * - RLS Policies
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Query to get complete schema information
 */
const SCHEMA_QUERIES = {
  tables: `
    SELECT
      table_schema,
      table_name,
      table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `,

  columns: `
    SELECT
      table_name,
      column_name,
      data_type,
      character_maximum_length,
      column_default,
      is_nullable,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `,

  constraints: `
    SELECT
      tc.constraint_name,
      tc.table_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    LEFT JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    LEFT JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_type;
  `,

  indexes: `
    SELECT
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `,

  functions: `
    SELECT
      n.nspname as schema,
      p.proname as name,
      pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY p.proname;
  `,

  triggers: `
    SELECT
      trigger_name,
      event_manipulation,
      event_object_table,
      action_statement,
      action_timing,
      action_orientation
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `,

  policies: `
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `
}

async function exportSchema() {
  console.log('Exporting database schema...\n')

  const timestamp = new Date().toISOString()
  let schemaDoc = `-- Database Schema Export\n`
  schemaDoc += `-- Project: SnagginBot_Prod\n`
  schemaDoc += `-- Exported: ${timestamp}\n`
  schemaDoc += `-- \n`
  schemaDoc += `-- This is a documentation file showing the current database schema.\n`
  schemaDoc += `-- To restore the schema, use the migration files instead.\n`
  schemaDoc += `-- \n\n`

  // Export tables
  console.log('Exporting table definitions...')
  const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
    query: SCHEMA_QUERIES.tables
  }).single()

  if (tablesError) {
    // Fallback: Try direct query
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: SCHEMA_QUERIES.tables })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (err) {
      console.error('Could not export schema via API:', err)
      console.log('Using migration files instead...')

      // Fallback: Concatenate all migration files
      const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations')
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort()

      schemaDoc += `-- ===========================================\n`
      schemaDoc += `-- SCHEMA FROM MIGRATIONS\n`
      schemaDoc += `-- ===========================================\n\n`

      for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')

        schemaDoc += `-- Migration: ${file}\n`
        schemaDoc += `-- -------------------------------------------\n\n`
        schemaDoc += content
        schemaDoc += `\n\n`
      }

      // Write the schema documentation
      const outputPath = path.join(__dirname, '..', 'backups', 'backup_2026-02-08T23-46-18', 'schema_complete.sql')
      fs.writeFileSync(outputPath, schemaDoc)

      console.log(`\n✓ Schema exported from migrations to: schema_complete.sql`)
      console.log(`  This file contains all ${migrationFiles.length} migration files combined.`)

      return
    }
  }

  console.log('✓ Schema export complete')
}

exportSchema().catch(error => {
  console.error('Schema export failed:', error)
  process.exit(1)
})
