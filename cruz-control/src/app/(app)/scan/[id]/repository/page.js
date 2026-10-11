"use client";

import { useScan } from "../../scan-context";
import TabPlaceholder from "../tab-placeholder";

export default function RepositoryTab() {
  const { result } = useScan();
  if (!result.linkedRepository) {
    return <TabPlaceholder title="Repository">No repository was linked to this scan.</TabPlaceholder>;
  }
  return <TabPlaceholder title="Repository">Repository findings for {result.linkedRepository} are coming soon.</TabPlaceholder>;
}
