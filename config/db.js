// config/db.js
const mssql = require("mssql");
const logger = require("./logger");

const poolConfig = {
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server: process.env.MSSQL_SERVER,
  database: process.env.MSSQL_DATABASE,
  port: parseInt(process.env.MSSQL_PORT || "1433"),
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === "true",
    enableArithAbort: true,
    useUTC: false
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise = null;

const getPool = async () => {
  if (poolPromise) return poolPromise;
  poolPromise = mssql.connect(poolConfig)
    .then(pool => {
      logger.info("Connected to MSSQL");
      return pool;
    })
    .catch(err => {
      poolPromise = null;
      logger.error("MSSQL Connection Error", err);
      throw err;
    });
  return poolPromise;
};

module.exports = { getPool, mssql };
