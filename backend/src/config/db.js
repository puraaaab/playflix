import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.mysql.host,
  port: env.mysql.port,
  user: env.mysql.user,
  password: env.mysql.password,
  database: env.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4'
});

let initializationPromise = null;

async function getAdminConnection() {
  return mysql.createConnection({
    host: env.mysql.host,
    port: env.mysql.port,
    user: env.mysql.user,
    password: env.mysql.password,
    multipleStatements: true
  });
}

async function ensureUsersSubscriptionExpiryColumn(connection) {
  const [rows] = await connection.query(
    `SELECT 1 AS exists_flag
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'subscription_expires_at'
     LIMIT 1`,
    [env.mysql.database]
  );

  if (rows.length === 0) {
    await connection.query('ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME NULL AFTER subscription_status');
  }
}

export async function initializeDatabase() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const adminConnection = await getAdminConnection();
    try {
      await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${env.mysql.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } finally {
      await adminConnection.end();
    }

    const schemaPath = fileURLToPath(new URL('../../database/schema.sql', import.meta.url));
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    const normalizedSchema = schemaSql
      .replace(/^CREATE DATABASE IF NOT EXISTS playflix;\s*USE playflix;\s*/i, '')
      .replace(/^\s*ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at DATETIME NULL AFTER subscription_status;\s*/im, '');

    const schemaConnection = await mysql.createConnection({
      host: env.mysql.host,
      port: env.mysql.port,
      user: env.mysql.user,
      password: env.mysql.password,
      database: env.mysql.database,
      multipleStatements: true,
      charset: 'utf8mb4'
    });

    try {
      await schemaConnection.query(normalizedSchema);
      await ensureUsersSubscriptionExpiryColumn(schemaConnection);
    } finally {
      await schemaConnection.end();
    }
  })();

  return initializationPromise;
}

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
