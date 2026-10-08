export const importHeaders = [
  "账号ID",
  "来源编号",
  "来源名称",
  "标题",
  "作者",
  "正文",
  "地区编码",
  "体裁",
  "通道",
  "主题",
  "海外国家城市",
] as const;
export interface OfflineSubmissionRow {
  ownerId: string;
  sourceRef: string;
  sourceName: string;
  title: string;
  author: string;
  content: string;
  region: string;
  genre: string;
  channel: string;
  themes: string[];
  overseasLocation: string;
}
/** CSV fields remain text; the server validates identity, provenance and scope. */
export function parseSubmissionImport(csv: string): OfflineSubmissionRow[] {
  if (csv.length > 1_000_000) throw new Error("文件内容不能超过 1 MB。");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const source = csv.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else field += char;
    } else if (char === '"' && !field && !closed) quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
      closed = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
      closed = false;
    } else {
      if (closed || char === '"')
        throw new Error("CSV 引号格式不正确，请使用模板重新导出。");
      field += char;
    }
  }
  if (quoted) throw new Error("CSV 正文的引号未闭合。");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  const headers = rows.shift()?.map((value) => value.trim());
  if (!headers || headers.join("|") !== importHeaders.join("|"))
    throw new Error("列名或顺序不匹配，请使用提供的 CSV 模板。");
  if (!rows.length || rows.length > 100)
    throw new Error("每批须包含 1–100 条稿件。");
  return rows.map((values, index) => {
    if (values.length !== importHeaders.length)
      throw new Error(`第 ${index + 1} 条稿件列数不正确。`);
    const [
      ownerId,
      sourceRef,
      sourceName,
      title,
      author,
      content,
      region,
      genre,
      channel,
      themes,
      overseasLocation,
    ] = values.map((value) => value.trim());
    return {
      ownerId: ownerId!,
      sourceRef: sourceRef!,
      sourceName: sourceName!,
      title: title!,
      author: author!,
      content: content!,
      region: region!,
      genre: genre!,
      channel: channel!,
      themes: themes
        ? themes
            .split("|")
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
      overseasLocation: overseasLocation!,
    };
  });
}
