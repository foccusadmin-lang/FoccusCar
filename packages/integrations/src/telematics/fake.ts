import { randomUUID } from "node:crypto";
import type { CommandResult, DeviceCapabilities, Position, TelematicsAdapter } from "./adapter";

/**
 * Rastreador simulado para desenvolvimento e testes: nunca usado em produção (bloqueado pela fábrica).
 * Permite gravar posições, simular webhooks e comandos sem hardware real.
 */
export class FakeTelematicsAdapter implements TelematicsAdapter {
  readonly provider = "fake";
  readonly positions = new Map<string, Position[]>();
  readonly commands = new Map<string, CommandResult & { externalDeviceId: string; command: "BLOCK" | "UNBLOCK" }>();
  capabilitiesByDevice = new Map<string, DeviceCapabilities>();

  push(position: Position) {
    const list = this.positions.get(position.externalDeviceId) ?? [];
    list.push(position);
    list.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    this.positions.set(position.externalDeviceId, list);
  }

  async capabilities(externalDeviceId: string): Promise<DeviceCapabilities> {
    return this.capabilitiesByDevice.get(externalDeviceId) ?? { positions: true, ignition: true, remoteBlock: false, tamper: false };
  }
  async latestPositions(ids: string[]) {
    return ids.flatMap((id) => this.positions.get(id)?.slice(-1) ?? []);
  }
  async history(id: string, from: Date, to: Date) {
    return (this.positions.get(id) ?? []).filter((p) => p.recordedAt >= from && p.recordedAt <= to);
  }
  async sendCommand(externalDeviceId: string, command: "BLOCK" | "UNBLOCK"): Promise<CommandResult> {
    const caps = await this.capabilities(externalDeviceId);
    const result: CommandResult = caps.remoteBlock
      ? { status: "SENT", providerRequestId: `fake_cmd_${randomUUID()}` }
      : { status: "REJECTED", providerResponse: { message: "Rastreador sem suporte a bloqueio." } };
    if (result.providerRequestId) this.commands.set(result.providerRequestId, { ...result, externalDeviceId, command });
    return result;
  }
  async commandStatus(providerRequestId: string): Promise<CommandResult> {
    return this.commands.get(providerRequestId) ?? { status: "FAILED", providerRequestId };
  }
  /** Formato simulado: {"positions":[{"deviceId","lat","lng","at","speed"}]} */
  async parseWebhook({ rawBody }: { headers: Headers; rawBody: string }): Promise<Position[]> {
    const body = JSON.parse(rawBody) as { positions?: { deviceId: string; lat: number; lng: number; at: string; speed?: number }[] };
    return (body.positions ?? []).map((p) => ({
      externalDeviceId: p.deviceId, latitude: p.lat, longitude: p.lng, recordedAt: new Date(p.at), speedKmh: p.speed, raw: p,
    }));
  }
}
