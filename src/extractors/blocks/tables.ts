import type { TableRef } from "@/types";
import { queryAll, textOf } from "@/utils/dom";

export function extractTable(table: HTMLTableElement): TableRef {
  const headerCells = queryAll<HTMLTableCellElement>(table, "thead th, thead td");
  const headers = headerCells.length
    ? headerCells.map(textOf)
    : (queryAll<HTMLTableRowElement>(table, "tr")[0]
        ? queryAll<HTMLTableCellElement>(queryAll<HTMLTableRowElement>(table, "tr")[0]!, "th, td").map(textOf)
        : []);

  const bodyRows = table.tBodies.length
    ? queryAll<HTMLTableRowElement>(table, "tbody tr")
    : queryAll<HTMLTableRowElement>(table, "tr").slice(headerCells.length ? 0 : 1);

  const rows = bodyRows.map((row) => queryAll<HTMLTableCellElement>(row, "td, th").map(textOf));

  return { headers, rows };
}
