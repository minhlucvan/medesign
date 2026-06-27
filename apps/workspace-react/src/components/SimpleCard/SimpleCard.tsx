/**
 * SimpleCard — captured by emdesign.
 * Reusable, design-system-bound component. Edit freely; re-capture to update.
 */
import { Box } from "@ds/Box";
export function SimpleCard({ label = "Card" }: { label?: string }) {
  return <Box className="bg-surface p-4 rounded shadow">{label}</Box>;
}
