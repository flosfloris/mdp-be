require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function initializeDatabase() {
  const client = await db.getClient();

  try {
    console.log('Starting database initialization...');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Split by semicolons and filter out empty statements
    const statements = schema
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      try {
        await client.query(statement);
        console.log('Executed statement successfully');
      } catch (error) {
        // Ignore "already exists" errors for idempotent operations
        if (
          !error.message.includes('already exists') &&
          !error.message.includes('duplicate key') &&
          !error.message.includes('CONFLICT')
        ) {
          throw error;
        }
        console.log('Skipped duplicate/existing entity');
      }
    }

    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Error during database initialization:', error.message);
    process.exit(1);
  } finally {
    await client.release();
    await db.closePool();
    process.exit(0);
  }
}

initializeDatabase();
