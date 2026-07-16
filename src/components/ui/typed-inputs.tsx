"use client";

import { useRef, useState } from "react";
import { Link2, Mail, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fieldClasses =
  "h-9 w-full rounded-md border border-line bg-raised pl-9 pr-3 text-sm text-ink placeholder:text-muted transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong disabled:pointer-events-none disabled:opacity-50";

function IconShell({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-faint"
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

export function EmailInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <IconShell icon={<Mail className="size-4" />} className={className}>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        className={fieldClasses}
        {...props}
      />
    </IconShell>
  );
}

export function UrlInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <IconShell icon={<Link2 className="size-4" />} className={className}>
      <input
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://…"
        className={fieldClasses}
        {...props}
      />
    </IconShell>
  );
}

/** Custom file field: styled picker + chosen-file chip; the real (hidden) input carries FormData. */
export function FileInput({
  name,
  id,
  accept,
  className,
}: {
  name: string;
  id?: string;
  accept?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          setFileName(file && file.size > 0 ? file.name : null);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="size-3.5" aria-hidden />
        {fileName ? "Change file" : "Choose file"}
      </Button>
      {fileName ? (
        <span className="flex min-w-0 items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
          <span className="truncate">{fileName}</span>
          <button
            type="button"
            aria-label="Remove file"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              setFileName(null);
            }}
            className="text-faint hover:text-danger"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ) : (
        <span className="text-xs text-faint">No file chosen</span>
      )}
    </div>
  );
}
