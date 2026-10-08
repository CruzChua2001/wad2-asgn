"use client";

import { useScan } from "../../scan-context";
import TabPlaceholder from "../tab-placeholder";

export default function RepositoryTab() {
  const { scan } = useScan();
  if (!scan.result.linkedRepository) {
    return <TabPlaceholder title="Repository">No repository was linked to this scan.</TabPlaceholder>;
  }
  return <TabPlaceholder title="Repository">Repository findings for {scan.result.linkedRepository} are coming soon.</TabPlaceholder>;
}
