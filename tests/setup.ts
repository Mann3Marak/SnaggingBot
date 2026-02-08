/**
 * Jest setup file - loads environment variables for testing
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.test for test environment variables
config({ path: resolve(process.cwd(), '.env.test') });

console.log('🧪 Test environment loaded');
console.log(`   TEST_BASE_URL: ${process.env.TEST_BASE_URL || '(not set)'}`);
