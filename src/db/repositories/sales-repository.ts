
import { getDatabase } from "@/src/db/database";

export type EndOfDayProductSummary = {
  productName: string;
  totalWeightKg: number;
  totalAmountPesewas: number;
};

export type EndOfDaySummary = {
  transactionCount: number;
  totalSalesPesewas: number;
  products: EndOfDayProductSummary[];
};

export async function getEndOfDaySummary(
  date: string,
): Promise<EndOfDaySummary> {
  const db = await getDatabase();

  const totals = await db.getFirstAsync<{
    transactionCount: number;
    totalSalesPesewas: number;
  }>(
    `
    SELECT
      COUNT(*) AS transactionCount,
      COALESCE(SUM(total_amount_pesewas), 0)
        AS totalSalesPesewas
    FROM sales
    WHERE substr(sold_at, 1, 10) = ?;
    `,
    date,
  );

  const products =
    await db.getAllAsync<EndOfDayProductSummary>(
      `
      SELECT
        si.product_name AS productName,
        SUM(si.weight_kg) AS totalWeightKg,
        SUM(si.line_total_pesewas)
          AS totalAmountPesewas
      FROM sale_items si
      INNER JOIN sales s
        ON s.id = si.sale_id
      WHERE substr(s.sold_at, 1, 10) = ?
      GROUP BY
        si.product_id,
        si.product_name
      ORDER BY si.product_name;
      `,
      date,
    );

  return {
    transactionCount:
      totals?.transactionCount ?? 0,
    totalSalesPesewas:
      totals?.totalSalesPesewas ?? 0,
    products,
  };
}
