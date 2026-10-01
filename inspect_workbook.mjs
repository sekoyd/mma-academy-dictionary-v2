import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const projectDir = "/Users/serkankaraman/mma-academy-dictionary-v2";
const sourcePath = "/Users/serkankaraman/Desktop/MMA_Dictionary_Master_Glossary_v1.xlsx";
const outputDir = path.join(projectDir, "output", "workbook");

await fs.mkdir(outputDir, { recursive: true });
const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table,region",
  maxChars: 18000,
  tableMaxRows: 12,
  tableMaxCols: 12,
  tableMaxCellChars: 240,
});
await fs.writeFile(path.join(outputDir, "overview.ndjson"), overview.ndjson, "utf8");
console.log(overview.ndjson);

const sheets = workbook.worksheets.items;
for (const sheet of sheets) {
  const used = sheet.getUsedRange();
  const values = used?.values ?? [];
  await fs.writeFile(
    path.join(outputDir, `${sheet.name.replaceAll(/[^a-z0-9_-]+/gi, "_")}.json`),
    JSON.stringify(values, null, 2),
    "utf8",
  );
  const preview = await workbook.render({
    sheetName: sheet.name,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(outputDir, `${sheet.name.replaceAll(/[^a-z0-9_-]+/gi, "_")}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
  console.log(JSON.stringify({ sheet: sheet.name, rows: values.length, cols: values[0]?.length ?? 0 }));
}
