const express = require('express');
const { randomUUID } = require('node:crypto');
const dotenv = require("dotenv").config();
const https = require("https");
const fs = require("fs");
const path = require("path");


const { DatabaseSync } = require('node:sqlite');
const database = new DatabaseSync('db/hormone.db');


var cors = require('cors');
const morgan = require("morgan");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());




const tables = {
    'injections': `
        CREATE TABLE injections(
            uuid TEXT UNIQUE PRIMARY KEY,
            time INTEGER NOT NULL,
            ester TEXT NOT NULL,
            concentration REAL NOT NULL,
            dose REAL NOT NULL,
            site TEXT,
            recipient TEXT,
            vial TEXT,
            notes TEXT
        ) STRICT
        `,
    'tests': `
        CREATE TABLE tests(
            uuid TEXT UNIQUE PRIMARY KEY,
            time INTEGER NOT NULL,
            test TEXT NOT NULL,
            unit TEXT NOT NULL,
            value REAL NOT NULL,
            recipient TEXT,
            notes TEXT
        ) STRICT
        `,
};

const keyArray = [];

for (const table in tables) {

    keyArray[table] = tables[`${table}`].match(/([a-z]+)(?= )/gm)
}

for(const item in tables) {

    if (database.prepare(`SELECT name FROM sqlite_schema WHERE  type =\'table\' AND name=\'${item}\'`).get() == undefined ) {
        console.log(`creating missing table "${item}"`)

        database.exec(tables[item]);
    } else {
        console.log(`table "${item}" exists!`)
    }
}



// Define a route for GET requests
for (const table in tables) {

    app.get(`/${table}`, (req, res) => {

        var query = `SELECT * FROM ${table}`;
        var filters = [];

        for(const item in req.query) {

            if (keyArray[table].includes(item)) {

                filters.push(item);
            }
        }

        if (filters.length > 0) {
            query = `${query} WHERE`

            for(const filter in filters) {

                query = `${query} ${filters[filter]} = '${req.query[filters[filter]].match(/[A-Za-z0-9.-]+/m)}'`

                if (filter <= filters.length - 2) {
                    query = `${query} AND`
                }
            }
        }

        const selectQuery = database.prepare(query);
        res.json({ message: selectQuery.all()});
    });
}



// Define a route for POST requests
for (const table in tables) {

    app.post(`/${table}`, (req, res) => {

        var values;
        const uuid = crypto.randomUUID()

        for(const item of keyArray[table]) {

            if (item == 'uuid') {
                values = `'${uuid}'`
            } else {

                if (typeof req.query[item] == 'string') {
                    values = `${values}, '${req.query[item].match(/[A-Za-z0-9.-]+/m)}'`
                } else if (typeof req.query[item] == 'number') {
                    values = `${values}, ${req.query[item]}`
                } else {
                    values = `${values}, NULL`
                }
            }
        }

        const insert = database.prepare(`INSERT INTO ${table} (${keyArray[table].toString()}) VALUES (${values})`);
        
        try {

            insert.all();
            res.json({ result: database.prepare(`SELECT * FROM ${table} WHERE uuid = '${uuid}'`).all()});

        } catch(err) {
            console.warn(err);
            res.json({ message: err});
        }
    });
}



// Define a route for PUT requests
for (const table in tables) {

    app.put(`/${table}`, (req, res) => {


        if(req.query.uuid) {

            const uuid = req.query.uuid.match(/[A-Za-z0-9.-]+/m);
            var query = `UPDATE ${table}\nSET`;

            var filters = [];

            for(const item in req.query) {

                if (keyArray[table].includes(item) && item != 'uuid') {

                    filters.push(item);
                }
            }

            if (filters.length > 0) {

                for(const filter in filters) {

                    query = `${query} ${filters[filter]} = '${req.query[filters[filter]].match(/[A-Za-z0-9.-]+/m)}'`

                    if (filter <= filters.length - 2) {
                        query = `${query},\n`
                    }
                }
            }

            query = `${query}\nWHERE uuid = '${uuid}'`

            try {

                const selectQuery = database.prepare(query);
                selectQuery.all();
                res.json({ result: database.prepare(`SELECT * FROM ${table} WHERE uuid = '${uuid}'`).all()});

            } catch(err) {
                console.warn(err);
                res.json({ message: err});
            }
            
        } else {
            res.json({ message: 'error: no uuid provided'});
        }
    });
}



// Define a route for DELETE requests
for (const table in tables) {
    app.delete(`/${table}`, (req, res) => {
        const query = database.prepare(`DELETE FROM ${table} where uuid = '${req.query.uuid.match(/[A-Za-z0-9.-]+/m)}'`);
        query.all();

        res.json({ message: 'row deleted', uuid: req.query.uuid});
    });
}

const options = {
  key: fs.readFileSync(path.join(__dirname, "localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "localhost.pem")),
};

const server = https.createServer(options, app);

server.listen(port, () => {
  console.log(`App listening on https://localhost:${port}`);
});

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}`);
// });


