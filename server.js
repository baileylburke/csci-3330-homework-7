const express = require('express');
const path = require('node:path');
const { Pool, types } = require('pg');

const pageSize = 20;
types.setTypeParser(1082, (value) => value);

function createApp(database) {
    const app = express();

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/', async (req, res, next) => {
        try {
            const countResult = await database.query('SELECT count(*) FROM customers');
            const customerCount = Number(countResult.rows[0].count);
            const totalPages = Math.max(1, Math.ceil(customerCount / pageSize));
            const requestedPage = typeof req.query.page === 'string' && /^\d+$/.test(req.query.page)
                ? Number(req.query.page) : 1;
            const page = Number.isSafeInteger(requestedPage)
                ? Math.min(totalPages, Math.max(1, requestedPage)) : 1;
            const offset = (page - 1) * pageSize;

            const customers = await database.query(
                'SELECT * FROM customers ORDER BY id LIMIT $1 OFFSET $2', [pageSize, offset]
            );
            const revenue = await database.query('SELECT sum(saleamount) FROM sales');
            const sales = await database.query(`SELECT products.name, sales.quantity, sales.saleamount
                FROM sales
                LEFT JOIN products ON sales.productid = products.id
                ORDER BY sales.id ASC`);
            const orders = await database.query('SELECT count(quantity) FROM orders');
            const issueCount = await database.query("SELECT count(id) FROM alerts WHERE type = 'issues'");
            const issues = await database.query("SELECT * FROM alerts WHERE type = 'issues'");
            const notificationCount = await database.query("SELECT count(id) FROM alerts WHERE type = 'notifications'");
            const notifications = await database.query("SELECT * FROM alerts WHERE type = 'notifications'");
            const tasks = await database.query("SELECT * FROM alerts WHERE type = 'tasks'");

            res.render('index', {
                customers: customers.rows,
                customerCount,
                revenue: Number(revenue.rows[0].sum || 0),
                sales: sales.rows,
                orders: Number(orders.rows[0].count),
                issueCount: Number(issueCount.rows[0].count),
                issues: issues.rows,
                notificationCount: Number(notificationCount.rows[0].count),
                notifications: notifications.rows,
                tasks: tasks.rows,
                page,
                totalPages,
                money: (amount) => Number(amount).toLocaleString('en-US', {
                    style: 'currency', currency: 'USD'
                }),
                number: (amount) => Number(amount).toLocaleString('en-US'),
                date: (value) => value ? `${value.slice(5, 7)}/${value.slice(8, 10)}/${value.slice(0, 4)}` : ''
            });
        } catch (error) {
            next(error);
        }
    });

    app.use((error, req, res, next) => {
        console.error('Dashboard request failed:', error.message);
        res.status(503).render('error');
    });

    return app;
}

if (require.main === module) {
    const pool = new Pool({ connectionTimeoutMillis: 5000 });
    pool.on('error', (error) => {
        console.error('Database connection error:', error.message);
    });
    const app = createApp(pool);
    const port = Number(process.env.PORT) || 3000;
    const server = app.listen(port, '127.0.0.1', () => {
        console.log(`Dashboard running at http://127.0.0.1:${port}`);
    });

    const shutdown = () => {
        server.close(() => pool.end());
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}

module.exports = { createApp };
