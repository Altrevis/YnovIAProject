import { Parser } from "json2csv"; //npm install json2csv

export function exportCSV(data: any[]) {
  const parser = new Parser();
  return parser.parse(data);
}

import * as XLSX from "xlsx"; //npm install xlsx

export function exportXLSX(data: any[]) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Exhibitors");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}