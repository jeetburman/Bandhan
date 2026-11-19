"use client";

import { useRouter } from "next/navigation";
import { Picker, type PickerOption } from "./picker";

interface BranchPickerProps {
  branches: { code: string; name: string }[];
  /** The branch currently shown, or null on the overview. */
  current: string | null;
  /** Where a branch's page lives. */
  basePath?: string;
  /** The label for "no branch chosen". Pass null to leave that choice out. */
  allLabel?: string | null;
}

export function BranchPicker({
  branches,
  current,
  basePath = "/cluster",
  allLabel = "All branches",
}: BranchPickerProps) {
  const router = useRouter();

  const options: PickerOption[] = [
    ...(allLabel ? [{ value: "", label: allLabel }] : []),
    ...branches.map((branch) => ({ value: branch.code, label: branch.name })),
  ];

  return (
    <Picker
      label="Branch"
      name="branch"
      options={options}
      value={current ?? ""}
      onChange={(code) => router.push(code ? `${basePath}/${code}` : basePath)}
      placeholder="Choose a branch"
    />
  );
}