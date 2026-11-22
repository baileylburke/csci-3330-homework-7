const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const { Client } = require('pg');
const { createApp } = require('../server');

const tables = ['alerts', 'customers', 'products', 'sales', 'orders'];

function bodyRows(html, id) {
    const body = html.match(new RegExp(`<tbody id="${id}">([\\s\\S]*?)</tbody>`));
    assert.ok(body, id);
    return [...body[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
        [...row[1].matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/g)].map((cell) =>
            cell[1].replace(/<[^>]+>/g, '').trim()));
}

test('PostgreSQL dashboard', async (suite) => {
    const client = new Client();
    await client.connect();
    let connected = true;
    let server;

    try {
        await client.query('BEGIN');
        for (const table of tables) {
            await client.query(`CREATE TEMP TABLE ${table} ON COMMIT DROP AS SELECT * FROM public.${table}`);
        }
        await client.query('SET LOCAL search_path = pg_temp, public');

        const reset = async () => {
            for (const table of tables) {
                await client.query(`TRUNCATE pg_temp.${table}`);
                await client.query(`INSERT INTO pg_temp.${table} SELECT * FROM public.${table}`);
            }
        };

        server = createApp(client).listen(0, '127.0.0.1');
        await once(server, 'listening');
        const base = `http://127.0.0.1:${server.address().port}`;
        const get = async (path = '/') => {
            const response = await fetch(base + path);
            return { status: response.status, html: await response.text() };
        };

        await suite.test('renders the supplied totals and every alert category', async () => {
            const { status, html } = await get();
            assert.equal(status, 200);
            assert.match(html, /id="customer-num">1,284</);
            assert.match(html, /id="orders-amt">342</);
            assert.match(html, /id="issues-amt">12</);
            assert.match(html, /id="notification-num">3</);
            assert.equal((html.match(/\$35,800\.00/g) || []).length, 2);
            const alerts = await client.query('SELECT description FROM pg_temp.alerts');
            for (const alert of alerts.rows) assert.ok(html.includes(alert.description));
        });

        await suite.test('joins all sales to product names in sales order', async () => {
            const { html } = await get();
            const rows = bodyRows(html, 'salesTableBody');
            assert.equal(rows.length, 10);
            assert.deepEqual(rows[0], ['Laptop', '5', '$6,000.00']);
            assert.deepEqual(rows[9], ['External Drive', '5', '$1,000.00']);
        });

        await suite.test('reaches all 1284 customers in order without duplicates', async () => {
            const all = await client.query('SELECT email FROM pg_temp.customers ORDER BY id');
            const emails = [];
            for (let page = 1; page <= 65; page++) {
                const { status, html } = await get(`/?page=${page}`);
                assert.equal(status, 200);
                const rows = bodyRows(html, 'customerTableBody');
                assert.equal(rows.length, page === 65 ? 4 : 20);
                emails.push(...rows.map((row) => row[1]));
                assert.ok(html.includes(`Page ${page} of 65`));
                if (page === 1) assert.doesNotMatch(html, /rel="prev"/);
                if (page === 65) assert.doesNotMatch(html, /rel="next"/);
            }
            assert.deepEqual(emails, all.rows.map((row) => row.email));
            assert.equal(new Set(emails).size, 1284);
        });

        await suite.test('handles missing, invalid, repeated, and oversized page values', async () => {
            for (const query of ['', '?page=0', '?page=-4', '?page=1.5', '?page=abc',
                '?page=1&page=2', '?page[x]=2', '?page=999999999999999999999',
                '?page=1%3BDROP%20TABLE%20customers']) {
                const { status, html } = await get('/' + query);
                assert.equal(status, 200);
                assert.match(html, /Page 1 of 65/);
            }
            assert.match((await get('/?page=999')).html, /Page 65 of 65/);
            assert.equal((await client.query('SELECT count(*) FROM pg_temp.customers')).rows[0].count, '1284');
        });

        await suite.test('reflects database changes and counts orders instead of units', async () => {
            await client.query("UPDATE pg_temp.customers SET name = 'Database Customer' WHERE id = 1");
            await client.query('UPDATE pg_temp.sales SET saleamount = saleamount + 0.25 WHERE id = 1');
            await client.query('UPDATE pg_temp.orders SET quantity = quantity + 100 WHERE id = 1');
            await client.query("INSERT INTO pg_temp.alerts VALUES (999, 'notifications', 'Database notification')");
            const { html } = await get();
            assert.ok(html.includes('Database Customer'));
            assert.ok(html.includes('$35,800.25'));
            assert.ok(html.includes('Database notification'));
            assert.match(html, /id="notification-num">4</);
            assert.match(html, /id="orders-amt">342</);
            await reset();
        });

        await suite.test('escapes database text and preserves calendar dates', async () => {
            const value = '<script>alert("stored")</script>&';
            await client.query('UPDATE pg_temp.customers SET name = $1, datejoined = $2 WHERE id = 1', [value, '2024-03-10']);
            await client.query('UPDATE pg_temp.products SET name = $1 WHERE id = 1', [value]);
            await client.query('UPDATE pg_temp.alerts SET description = $1 WHERE id = 1', [value]);
            const { html } = await get();
            assert.ok(!html.includes(value));
            assert.equal((html.match(/&lt;script&gt;/g) || []).length, 3);
            assert.ok(html.includes('03/10/2024'));
            await reset();
        });

        await suite.test('renders empty tables with zero totals and a single page', async () => {
            for (const table of tables) await client.query(`TRUNCATE pg_temp.${table}`);
            const { status, html } = await get('/?page=65');
            assert.equal(status, 200);
            assert.ok(html.includes('$0.00'));
            for (const id of ['customer-num', 'orders-amt', 'issues-amt', 'notification-num']) {
                assert.ok(html.includes(`id="${id}">0<`));
            }
            for (const message of ['No customers found.', 'No sales found.', 'No issues found.',
                'No notifications found.', 'No tasks found.', 'Page 1 of 1']) {
                assert.ok(html.includes(message));
            }
            assert.doesNotMatch(html, /rel="(?:next|prev)"/);
            await reset();
        });

        await suite.test('serves public assets and keeps server files private', async () => {
            for (const path of ['/css/styles.css', '/js/source.js']) {
                assert.equal((await get(path)).status, 200);
            }
            for (const path of ['/.env', '/server.js', '/package.json', '/scripts/1.%20alerts.sql']) {
                assert.equal((await get(path)).status, 404);
            }
        });

        await suite.test('returns a readable error when the database connection closes', async () => {
            await client.query('ROLLBACK');
            await client.end();
            connected = false;
            const { status, html } = await get();
            assert.equal(status, 503);
            assert.ok(html.includes('Dashboard unavailable'));
            if (process.env.PGPASSWORD) assert.ok(!html.includes(process.env.PGPASSWORD));
            assert.ok(!html.includes('SELECT count'));
        });
    } finally {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (connected) {
            await client.query('ROLLBACK');
            await client.end();
        }
    }
});
