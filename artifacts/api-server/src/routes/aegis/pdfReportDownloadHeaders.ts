export type PdfReportDownloadHeaders = Readonly<{
  "Content-Type": "application/pdf";
  "Content-Length": string;
  "Content-Disposition": string;
  "x-report-sha256": string;
  "Access-Control-Expose-Headers": "x-report-sha256, Content-Disposition";
}>;

export function buildStandardPdfReportFilename(): string {
  return `tancmark-report-${Date.now()}.pdf`;
}

export function buildCloakPdfReportFilename(): string {
  return `tancmark-cloak-report-${Date.now()}.pdf`;
}

export function buildPdfReportDownloadHeaders(input: {
  filename: string;
  byteLength: number;
  sha256: string;
}): PdfReportDownloadHeaders {
  return {
    "Content-Type": "application/pdf",
    "Content-Length": String(input.byteLength),
    "Content-Disposition": `attachment; filename="${input.filename}"`,
    "x-report-sha256": input.sha256,
    "Access-Control-Expose-Headers": "x-report-sha256, Content-Disposition",
  };
}
