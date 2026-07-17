"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, UploadCloud, X } from "lucide-react";
import {
  parseStatementCsv,
  type ParseResult,
} from "@/lib/csv/parse";
import { importTransactions } from "@/app/(app)/upload/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { formatDate, formatGBP } from "@/lib/format";
import { cn } from "@/lib/utils";

const FORMAT_LABELS: Record<ParseResult["format"], string> = {
  monzo: "Monzo export",
  starling: "Starling export",
  generic: "Generic bank CSV",
};

const PREVIEW_ROWS = 8;

export function CsvDropzone() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ParseResult | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);

  const handleFile = React.useCallback((file: File) => {
    setParseError(null);
    setResult(null);
    setFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please choose a .csv file exported from your bank.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setParseError("That file is over 4 MB. Try exporting a shorter period.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseStatementCsv(String(reader.result ?? ""));
        setResult(parsed);
      } catch (error) {
        setParseError(
          error instanceof Error ? error.message : "Could not parse that file."
        );
      }
    };
    reader.onerror = () => setParseError("Could not read that file.");
    reader.readAsText(file);
  }, []);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setResult(null);
    setParseError(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const confirmImport = async () => {
    if (!result) return;
    setImporting(true);
    try {
      const summary = await importTransactions(result.rows);
      if (!summary.ok) {
        toast("Import failed", {
          description: summary.error,
          variant: "error",
        });
        return;
      }
      toast("Statement imported", {
        description: `${summary.inserted} new transactions saved (${summary.duplicates} duplicates skipped), ${summary.categorised} categorised by AI.`,
        variant: "success",
      });
      reset();
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast("Import failed", {
        description: "Something went wrong while saving. Please try again.",
        variant: "error",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV bank statement"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          dragging
            ? "border-primary bg-accent/60"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40"
        )}
      >
        <UploadCloud className="h-10 w-10 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">
            Drag and drop your bank statement CSV here
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse. Monzo, Starling and generic UK layouts
            supported, up to 2,000 rows.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {parseError ? (
        <div className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{parseError}</p>
          <button onClick={reset} aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-primary" aria-hidden />
                  {fileName}
                </CardTitle>
                <CardDescription className="mt-1.5">
                  Detected {FORMAT_LABELS[result.format]}. {result.rows.length}{" "}
                  transactions ready to import
                  {result.skipped > 0
                    ? `, ${result.skipped} rows skipped (missing date, description or amount)`
                    : ""}
                  .
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset} disabled={importing}>
                  Cancel
                </Button>
                <Button onClick={confirmImport} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Importing and categorising...
                    </>
                  ) : (
                    `Import ${result.rows.length} transactions`
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                  <TableRow key={`${row.date}-${i}`}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(row.date)}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {row.description}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right tabular-nums",
                        row.amount > 0 && "text-primary"
                      )}
                    >
                      {formatGBP(row.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {row.balance != null ? formatGBP(row.balance) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {result.rows.length > PREVIEW_ROWS ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Showing the first {PREVIEW_ROWS} of {result.rows.length} rows.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
