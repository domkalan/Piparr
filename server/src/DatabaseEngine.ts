import path from 'node:path';

import sqlite3 from "sqlite3";

export abstract class DatabaseEngine {
    public static instance: sqlite3.Database;

    public static Init() {
        return new Promise((resolve, reject) => {
            const databasePath = path.resolve('./data/app.db');

            const db = new sqlite3.Database(databasePath);

            this.instance = db;

            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='settings';`, (err, row) => {
                if (err) {
                    console.error(err.message);
                } else {
                    if (row) {
                        console.log('[Piparr][database] database is ready');

                        resolve(true);
                    } else {
                        console.log('[Piparr][database] looks like this is a new database');

                        this.CreateTables().then(() => {
                            resolve(true);
                        });
                    }
                }
            });
        })
    }

    public static Run(sql: string) {
        return new Promise((resolve, reject) => {
            console.log(`[Piparr][database][async][run] running ${sql}`)

            this.instance.run(sql, (err : any, result : any) => {
                if (err) {
                    console.error(err);

                    reject(err.message);
                } else {
                    resolve(result);
                }
            })
        })
    }

    public static RunSafe(sql: string, object: any) {
        return new Promise((resolve, reject) => {
            console.log(`[Piparr][database][async][run] running ${sql}`)

            this.instance.run(sql, object, function(err : any) {
                if (err) {
                    console.error(err);

                    reject(err.message);
                } else {
                    resolve(this.lastID);
                }
            })
        })
    }

    public static Insert(sql: string, object: any) {
        return new Promise((resolve, reject) => {
            console.log(`[Piparr][database][async][run] running ${sql}`)

            this.instance.run(sql, object, function(err : any) {
                if (err) {
                    console.error(err);

                    reject(err.message);
                } else {
                    resolve(this.lastID);
                }
            })
        })
    }

    public static Update(sql: string, object: any) {
        return new Promise((resolve, reject) => {
            console.log(`[Piparr][database][async][run] running ${sql}`)

            this.instance.run(sql, object, function(err : any) {
                if (err) {
                    console.error(err);

                    reject(err.message);
                } else {
                    resolve(this.lastID);
                }
            })
        })
    }

    public static All(sql: string) {
        return new Promise((resolve, reject) => {
            console.log(`[Piparr][database][async][all] running ${sql}`)

            this.instance.all(sql, (err : any, result : any) => {
                if (err) {
                    console.error(err);

                    reject(err.message);
                } else {
                    resolve(result);
                }
            })
        })
    }

    public static AllSafe(sql: string, object: any) {
        return new Promise((resolve, reject) => {
            console.log(`[Piparr][database][async][all] running ${sql}`)

            this.instance.all(sql, object, (err : any, result : any) => {
                if (err) {
                    console.error(err);

                    reject(err.message);
                } else {
                    resolve(result);
                }
            })
        })
    }

    private static async CreateTables() {
        await this.Run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );`);
        console.log('[Piparr][database] table "settings" created');

        await this.Run(`INSERT INTO settings (key, value) VALUES ('dbSchemaVersion', '1.0');`);
        console.log('[Piparr][database] dbSchemaVersion 1.0 defined');

        await this.Run(`CREATE TABLE IF NOT EXISTS streams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            stream TEXT NOT NULL,
            type TEXT NOT NULL,
            connections INTEGER DEFAULT 1,
            last_updated TEXT,
            regex TEXT,
            healthy INTEGER DEFAULT 1
        );`);
        console.log('[Piparr][database] table "streams" created');

        await this.Run(`CREATE TABLE IF NOT EXISTS epgsources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            epg TEXT NOT NULL
        );`);
        console.log('[Piparr][database] table "epgsources" created');

        await this.Run(`CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            logo TEXT,
            epg TEXT NOT NULL,
            channel_number INTEGER NOT NULL
        );`);
        console.log('[Piparr][database] table "channels" created');

        await this.Run(`CREATE TABLE IF NOT EXISTS channel_source (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stream_id INTEGER NOT NULL,
            channel_id INTEGER NOT NULL,
            stream_channel TEXT NOT NULL
        );`);
        console.log('[Piparr][database] table "channel_source" created');
    }
}