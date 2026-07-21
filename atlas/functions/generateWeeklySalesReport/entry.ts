import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';
import * as XLSX from 'npm:xlsx';

Deno.serve(async (req) => {
  try {
    const atlasRuntime = createClientFromRequest(req);
    const { timeRange = "this_week" } = await req.json().catch(() => ({}));

    // 1. Read all ReportConfig records (the source of truth for what reports to generate)
    const configs = await atlasRuntime.asServiceRole.entities.ReportConfig.list();

    const sections = [];
    const sheets = [];

    for (const config of configs) {
      const entityType = config.entity_type;
      let items = [];
      try {
        items = await atlasRuntime.asServiceRole.entities[entityType].list();
      } catch (e) {
        items = [];
      }

      const fields = (config.config && config.config.fields) || [];
      const yAxis = config.config && config.config.yAxis;
      const aggregation = config.config && config.config.aggregation;

      // Build a human-readable summary section per ReportConfig
      let section = `### ${config.name} (${entityType})`;
      if (config.description) section += `\n${config.description}`;
      section += `\nTotal records: ${items.length}`;
      if (aggregation && yAxis) {
        if (aggregation === "sum") {
          const sum = items.reduce((a, it) => a + (Number(it[yAxis]) || 0), 0);
          section += `\nSum of ${yAxis}: ${sum}`;
        } else if (aggregation === "avg") {
          const avg = items.length ? items.reduce((a, it) => a + (Number(it[yAxis]) || 0), 0) / items.length : 0;
          section += `\nAvg of ${yAxis}: ${avg.toFixed(2)}`;
        }
      }
      sections.push(section);

      // Build a sheet for the export from the configured fields
      const cols = fields.length ? fields : ["id", "created_date"];
      const rows = items.map((it) => {
        const row = {};
        for (const c of cols) row[c] = it[c];
        return row;
      });
      sheets.push({ name: config.name || entityType, rows });
    }

    // 2. Export the report data to an Excel workbook
    let excelBase64 = null;
    try {
      const wb = XLSX.utils.book_new();
      for (const s of sheets) {
        const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}]);
        XLSX.utils.book_append_sheet(wb, ws, String(s.name).slice(0, 31) || "Sheet");
      }
      excelBase64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    } catch (e) {
      excelBase64 = null;
    }

    const summary = `Weekly Sales Report — ${new Date().toLocaleDateString("en-US")}\n\n${sections.join("\n\n") || "No report configurations found."}`;

    return Response.json({
      summary,
      timeRange,
      reportConfigsProcessed: configs.length,
      exportGenerated: excelBase64 !== null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});