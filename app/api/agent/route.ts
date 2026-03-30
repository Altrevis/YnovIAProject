import { NextRequest } from "next/server";
import { runScraper } from "@/lib/agent";
import { exportCSV, exportXLSX } from "@/lib/utils/export";

export async function POST(req: NextRequest) {
  const { url, format } = await req.json();

  const data = await runScraper(url);

  if (format === "csv") {
    const csv = exportCSV(data);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=exhibitors.csv",
      },
    });
  }

  if (format === "xlsx") {
    const xlsx = exportXLSX(data);

    return new Response(xlsx, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=exhibitors.xlsx",
      },
    });
  }

  return Response.json({ data });
}