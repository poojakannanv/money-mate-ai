import { CsvDropzone } from "@/components/upload/csv-dropzone";

export const metadata = { title: "Upload a statement" };

export default function UploadPage() {
  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Upload a bank statement
        </h1>
        <p className="mt-2 text-muted-foreground">
          Export a CSV from your bank, drop it below, and MoneyMate will parse
          it, skip anything you have already imported, and categorise every
          transaction with AI. Parsing happens in your browser; only the
          normalised rows are stored.
        </p>
      </div>
      <CsvDropzone />
      <div className="mt-8 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How to export your CSV</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Monzo: Payments, then Statements and select CSV.</li>
          <li>Starling: Statements, choose a period, download as CSV.</li>
          <li>
            Other banks: download a CSV and rename the columns to date,
            description, amount and balance if needed.
          </li>
        </ul>
      </div>
    </div>
  );
}
