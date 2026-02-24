"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumb";

interface Project {
  id: string;
  title: string;
}

const inputClass =
  "w-full rounded-sm border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/20 transition-colors";

const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider";

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}

function Field({ label, required, children, error }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>
        {label}
        {required && <span className="ml-1 text-[#ef4444]">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-[#ef4444] mt-0.5">{error}</p>
      )}
    </div>
  );
}

export default function NewObjectivePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [maxIterations, setMaxIterations] = useState(5);
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; success_criteria?: string; submit?: string }>({});

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects);
      })
      .catch(() => {
        // Non-fatal: dropdown just stays empty
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  function validate() {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Title is required.";
    if (!successCriteria.trim()) next.success_criteria = "Success criteria is required.";
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const res = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || "",
          success_criteria: successCriteria.trim(),
          max_iterations: maxIterations,
          project_id: projectId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ submit: data.error || "Failed to create objective. Please try again." });
        return;
      }

      router.push("/objectives");
    } catch {
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-lg mx-auto">
        <Breadcrumb
          segments={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Objectives", href: "/objectives" },
            { label: "New" },
          ]}
          className="mb-6"
        />

        <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground mb-6">
          Create Objective
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <Field label="Title" required error={errors.title}>
            <input
              className={inputClass}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="e.g. Ship discovery loop to production"
              disabled={submitting}
            />
          </Field>

          {/* Description */}
          <Field label="Description">
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional context or background"
              disabled={submitting}
            />
          </Field>

          {/* Success Criteria */}
          <Field label="Success Criteria" required error={errors.success_criteria}>
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              value={successCriteria}
              onChange={(e) => {
                setSuccessCriteria(e.target.value);
                if (errors.success_criteria) setErrors((prev) => ({ ...prev, success_criteria: undefined }));
              }}
              placeholder="How will we know this is done?"
              disabled={submitting}
            />
          </Field>

          {/* Max Iterations */}
          <Field label="Max Iterations">
            <input
              className={inputClass}
              type="number"
              min={1}
              max={50}
              value={maxIterations}
              onChange={(e) => setMaxIterations(Number(e.target.value))}
              disabled={submitting}
            />
          </Field>

          {/* Project */}
          <Field label="Project">
            <select
              className={inputClass}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={submitting || loadingProjects}
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>

          {/* Submit error */}
          {errors.submit && (
            <p className="text-sm text-[#ef4444] bg-[#ef4444]/[0.08] border border-[#ef4444]/[0.2] rounded-sm px-3 py-2">
              {errors.submit}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-sm bg-accent border border-border text-sm font-medium text-foreground hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Creating..." : "Create Objective"}
            </button>
            <Link
              href="/objectives"
              className="px-4 py-2 rounded-sm text-sm text-muted-foreground hover:text-foreground/70 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
