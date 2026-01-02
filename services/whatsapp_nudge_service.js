const { getPool } = require("../config/db");
const { sendTemplateMessage } = require("./whatsapp_services");
const logger = require("../config/logger");

// 🔐 phone normalizer (no user input)
function normalizePhone(phone) {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 12) return d;
  return null;
}

/**
 * Reorder nudge (Delivered + delay)
 */
async function sendReorderNudge(minutesDelay = 1) {
  const pool = await getPool();

  const result = await pool.request().input("delay", minutesDelay).query(`
    SELECT TOP 10 order_id, customer_phone
    FROM orders
    WHERE status = 'Delivered'
      AND delivered_at IS NOT NULL
      AND reorder_nudge_sent = 0
      AND delivered_at <= DATEADD(MINUTE, -@delay, GETDATE())
  `);

  for (const row of result.recordset) {
    const phone = normalizePhone(row.customer_phone);
    if (!phone) continue;

    console.log("📲 Sending REORDER WhatsApp to:", phone);

    try {
      await sendTemplateMessage({
        phone,
        event: "REORDER",
      });

      await pool.request().input("orderId", row.order_id).query(`
          UPDATE orders
          SET reorder_nudge_sent = 1,
              last_whatsapp_nudge_at = GETDATE()
          WHERE order_id = @orderId
        `);

      logger.info("Reorder WhatsApp sent", { orderId: row.order_id });
    } catch (err) {
      logger.error("Reorder WhatsApp failed", {
        orderId: row.order_id,
        error: err.message,
      });
    }
  }
}

/**
 * Explore nudge (Delivered + delay in minutes / days)
 */
async function sendExploreNudge(minutesDelay = 2) {
  const pool = await getPool();

  const result = await pool.request().input("delay", minutesDelay).query(`
    SELECT TOP 10 order_id, customer_phone
    FROM orders
    WHERE status = 'Delivered'
      AND delivered_at IS NOT NULL
      AND discover_nudge_sent = 0
      AND delivered_at <= DATEADD(MINUTE, -@delay, GETDATE())
  `);

  for (const row of result.recordset) {
    const phone = normalizePhone(row.customer_phone);
    if (!phone) continue;

    console.log("🌿 Sending EXPLORE WhatsApp to:", phone);

    try {
      await sendTemplateMessage({
        phone,
        event: "DISCOVER_BLEND",
      });

      await pool.request().input("orderId", row.order_id).query(`
        UPDATE orders
        SET discover_nudge_sent = 1,
            last_whatsapp_nudge_at = GETDATE()
        WHERE order_id = @orderId
      `);

      logger.info("Explore WhatsApp sent", { orderId: row.order_id });
    } catch (err) {
      logger.error("Explore WhatsApp failed", {
        orderId: row.order_id,
        error: err.message,
      });
    }
  }
}

module.exports = {
  sendReorderNudge,
  sendExploreNudge,
};
