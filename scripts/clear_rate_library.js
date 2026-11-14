const { createClient } = require('@libsql/client');
const path = require('path');

async function clearRateLibrary() {
  const dbPath = path.resolve('data/jpa_quote.db');
  console.log('Connecting to database:', dbPath);
  const client = createClient({
    url: `file:${dbPath.replace(/\\/g, '/')}`,
  });

  const pCount = await client.execute('SELECT COUNT(*) as c FROM products');
  console.log('Current product count:', pCount.rows[0].c);

  await client.execute('DELETE FROM product_rates');
  await client.execute('DELETE FROM rate_change_history');
  await client.execute('DELETE FROM product_aliases');
  await client.execute('DELETE FROM products');

  // Mark rate_library_cleared = '1' so seedDb never resurrects demo products
  await client.execute(`
    INSERT OR REPLACE INTO system_settings (key, value, updated_at)
    VALUES ('rate_library_cleared', '1', datetime('now'))
  `);

  const pAfter = await client.execute('SELECT COUNT(*) as c FROM products');
  console.log('Rate library successfully cleared! Current product count:', pAfter.rows[0].c);
  console.log('Rate library is now 100% clean and ready for fresh storage.');
}

clearRateLibrary().catch(console.error);

