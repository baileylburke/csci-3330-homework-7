const express = require('express');
const path = require('node:path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index');
});

if (require.main === module) {
    const port = Number(process.env.PORT) || 3000;
    app.listen(port, '127.0.0.1', () => {
        console.log(`Dashboard running at http://127.0.0.1:${port}`);
    });
}

module.exports = app;
