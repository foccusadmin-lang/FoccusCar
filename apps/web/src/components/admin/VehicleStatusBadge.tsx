import { VEHICLE_STATUS_LABELS, type VehicleStatus } from "@foccus/core";
import { Badge, type Tone } from "../ui/Badge";

const TONE: Record<VehicleStatus, Tone> = {
  AVAILABLE: "success", RESERVED: "info", RENTED: "gold", MAINTENANCE: "warning", INSPECTION: "warning", CLEANING: "info", BLOCKED: "danger", INACTIVE: "neutral",
};

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return <Badge tone={TONE[status]}>{VEHICLE_STATUS_LABELS[status]}</Badge>;
}
