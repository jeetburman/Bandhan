"use client";

import { useRouter } from "next/navigation";

interface BranchPickerProps {
  branches: { code: string; name: string }[];
  /** The branch currently shown, or null on the overview. */
  current: string | null;
}

export function BranchPicker({ branches, current }: BranchPickerProps) {
  const router = useRouter();

  return (
    <label className="block text-sm font-medium">
      Branch
      <select
        value={current ?? ""}
        onChange={(event) => {
          const code = event.target.value;
          router.push(code ? `/cluster/${code}` : "/cluster");
        }}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
      >
        <option value="">All branches</option>
        {branches.map((branch) => (
          <option key={branch.code} value={branch.code}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  );
}