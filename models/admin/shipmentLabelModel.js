const { getPool, mssql } = require("../../config/db");


async function upsertShipmentLabel({
  shipmentId,
  orderId,
  awb,
  response
}) {
  const pool = await getPool();

  const packagesFound = response?.packages_found || 0;
  const pdfUrl = response?.pdf || null;

  const status =
    packagesFound > 0 && pdfUrl
      ? "generated"
      : "pending";

  await pool.request()
    .input("shipment_id", mssql.Int, shipmentId)
    .input("order_id", mssql.Int, orderId)
    .input("awb", mssql.VarChar(50), awb)
    .input("packages_found", mssql.Int, packagesFound)
    .input("response_json", mssql.NVarChar(mssql.MAX), JSON.stringify(response))
    .input("pdf_url", mssql.NVarChar(500), pdfUrl)
    .input("status", mssql.VarChar(20), status)
    .query(`
      MERGE shipment_labels AS t
      USING (SELECT @shipment_id AS shipment_id) s
      ON t.shipment_id = s.shipment_id
      WHEN MATCHED THEN
        UPDATE SET
          packages_found = @packages_found,
          response_json = @response_json,
          pdf_url = @pdf_url,
          status = @status,
          updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (
          shipment_id, order_id, awb,
          packages_found, response_json, pdf_url, status
        )
        VALUES (
          @shipment_id, @order_id, @awb,
          @packages_found, @response_json, @pdf_url, @status
        );
    `);
}

module.exports = {
  upsertShipmentLabel
};
