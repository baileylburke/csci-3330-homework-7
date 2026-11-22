const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

async function setup() {
    const client = new Client();
    await client.connect();
    try {
        await client.query('BEGIN');
        const existing = await client.query(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        );
        if (existing.rowCount > 0) {
            throw new Error('Use an empty database to load the starter data');
        }

        const files = [
            '1. alerts.sql',
            '2. products.sql',
            '3. customer.sql',
            '4. orders.sql',
            '5. sales.sql'
        ];
        for (const file of files) {
            const sql = await readFile(path.join(__dirname, file), 'utf8');
            await client.query(sql);
            console.log(`Loaded ${file}`);
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        await client.end();
    }
}

setup().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
