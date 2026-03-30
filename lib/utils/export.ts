import { Parser } from "json2csv";
import * as XLSX from "xlsx";
import { Exhibitor } from "../types";

export function exportCSV(data: Exhibitor[]) {
  const parser = new Parser();
  return parser.parse(data);
}

export function exportXLSX(data: Exhibitor[]) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Exhibitors");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}