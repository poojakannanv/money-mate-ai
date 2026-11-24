export function SiteFooter() {
  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
        <p>
          Built by Pooja Kannan as a UK web developer portfolio project.{" "}
          <a
            href="https://github.com/poojakannanv/money-mate-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Source on GitHub.
          </a>
        </p>
        <p className="text-xs">
          Demo software, not financial advice. Your data stays in your account
          and is never shared.
        </p>
      </div>
    </footer>
  );
}
