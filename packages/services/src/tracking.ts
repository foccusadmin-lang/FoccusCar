import { createHash } from "node:crypto";
import {
  TRACKING_CONSENT_TEXT, TRACKING_CONSENT_TITLE, TRACKING_CONSENT_VERSION, TRACKED_RENTAL_STATUSES, acceptablePositions, authorize,
  locationBatchSchema, trackingConsentSchema, trackingDecision, type AccessContext, type TrackingDecision,
} from "@foccus/core";
import { consents, customerLocations, customers, rentals, withTenant, type Tx } from "@foccus/db";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { audit, notify } from "./audit";
import { ServiceError, type RequestMeta, type ServiceDeps } from "./deps";

export const TRACKING_CONSENT_TYPE = "TRACKING_LOCATION";
const TEXT_SHA256 = createHash("sha256").update(`${TRACKING_CONSENT_TITLE}\n\n${TRACKING_CONSENT_TEXT}`).digest("hex");

/** Aceite vigente de rastreamento do usuário (o mais recente não retirado). */
export async function activeTrackingConsent(tx: Tx, companyId: string, userId: string) {
  const [row] = await tx
    .select()
    .from(consents)
    .where(and(eq(consents.companyId, companyId), eq(consents.userId, userId), eq(consents.type, TRACKING_CONSENT_TYPE), isNull(consents.revokedAt)))
    .orderBy(desc(consents.acceptedAt))
    .limit(1);
  return row ?? null;
}

async function trackedRental(tx: Tx, customerId: string) {
  const [row] = await tx
    .select({ id: rentals.id, status: rentals.status })
    .from(rentals)
    .where(and(eq(rentals.customerId, customerId), inArray(rentals.status, [...TRACKED_RENTAL_STATUSES]), isNull(rentals.deletedAt)))
    .orderBy(desc(rentals.startAt))
    .limit(1);
  return row ?? null;
}

/** Texto exibido ao cliente e situação do aceite. */
export async function getMyTracking(deps: ServiceDeps, ctx: AccessContext) {
  authorize(ctx, { permission: "self:profile.manage", companyId: ctx.companyId, ownerUserId: ctx.userId });
  return withTenant(deps.db, ctx, async (tx) => {
    const consent = await activeTrackingConsent(tx, ctx.companyId, ctx.userId);
    const [customer] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.userId, ctx.userId));
    const rental = customer ? await trackedRental(tx, customer.id) : null;
    return {
      terms: { version: TRACKING_CONSENT_VERSION, title: TRACKING_CONSENT_TITLE, text: TRACKING_CONSENT_TEXT },
      consent: consent ? { acceptedAt: consent.acceptedAt, version: consent.version, platform: consent.platform, current: consent.version === TRACKING_CONSENT_VERSION } : null,
      decision: trackingDecision({ consentActive: Boolean(consent), rental }),
    };
  });
}

/**
 * Aceite no fim do cadastro: exige o texto atual e uma posição real do aparelho
 * (prova de que a permissão de localização foi concedida). Guarda o ponto do aceite.
 */
export async function acceptTrackingConsent(deps: ServiceDeps, ctx: AccessContext, input: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "self:profile.manage", companyId: ctx.companyId, ownerUserId: ctx.userId });
  const data = trackingConsentSchema.parse(input);
  if (acceptablePositions([data.position]).length === 0)
    throw new ServiceError("A localização recebida está com data inválida. Confira o relógio do celular e tente de novo.", 422, "INVALID_POSITION");

  return withTenant(deps.db, ctx, async (tx) => {
    const [customer] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.userId, ctx.userId));
    if (!customer) throw new ServiceError("Preencha seus dados antes de autorizar a localização.", 409, "PROFILE_REQUIRED");

    let consent = await activeTrackingConsent(tx, ctx.companyId, ctx.userId);
    if (consent && consent.version !== TRACKING_CONSENT_VERSION) {
      await tx.update(consents).set({ revokedAt: new Date() }).where(eq(consents.id, consent.id));
      consent = null;
    }
    if (!consent) {
      const [created] = await tx
        .insert(consents)
        .values({
          companyId: ctx.companyId, userId: ctx.userId, customerId: customer.id, type: TRACKING_CONSENT_TYPE,
          version: TRACKING_CONSENT_VERSION, textSha256: TEXT_SHA256, platform: data.platform,
          ip: meta?.ip?.slice(0, 64) ?? null, userAgent: meta?.userAgent?.slice(0, 300) ?? null,
        })
        .returning();
      consent = created!;
      await audit(tx, {
        companyId: ctx.companyId, actorUserId: ctx.userId, action: "customer.tracking_consent.accept", entity: "consents",
        entityId: consent.id, newValue: { version: TRACKING_CONSENT_VERSION, platform: data.platform }, meta,
      });
    }
    await tx.insert(customerLocations).values({
      companyId: ctx.companyId, userId: ctx.userId, customerId: customer.id, consentId: consent.id,
      source: "REGISTRATION", platform: data.platform, ...data.position,
    });
    return { consentId: consent.id, acceptedAt: consent.acceptedAt };
  });
}

/**
 * Retirada do aceite (LGPD art. 8º, § 5º). Não apaga o histórico já coletado, que segue a
 * retenção do contrato. Durante uma locação em andamento a locadora é avisada.
 */
export async function revokeTrackingConsent(deps: ServiceDeps, ctx: AccessContext, meta?: RequestMeta) {
  authorize(ctx, { permission: "self:profile.manage", companyId: ctx.companyId, ownerUserId: ctx.userId });
  return withTenant(deps.db, ctx, async (tx) => {
    const consent = await activeTrackingConsent(tx, ctx.companyId, ctx.userId);
    if (!consent) return { revoked: false };
    await tx.update(consents).set({ revokedAt: new Date() }).where(eq(consents.id, consent.id));
    const rental = consent.customerId ? await trackedRental(tx, consent.customerId) : null;
    await audit(tx, {
      companyId: ctx.companyId, actorUserId: ctx.userId, action: "customer.tracking_consent.revoke", entity: "consents",
      entityId: consent.id, oldValue: { version: consent.version }, newValue: { revokedAt: new Date().toISOString(), rentalId: rental?.id ?? null }, meta,
    });
    await notify(tx, {
      companyId: ctx.companyId, userId: ctx.userId, topic: "security", title: "Localização desativada",
      body: "Você retirou a autorização de localização. Novas locações ficam bloqueadas até que ela seja concedida de novo. O rastreador do veículo continua ativo durante a locação.",
      link: "/cadastro",
    });
    return { revoked: true, duringRental: Boolean(rental) };
  });
}

/**
 * Recebe lotes de posições do aplicativo. Só grava com aceite vigente e locação em andamento;
 * caso contrário não guarda nada e responde para o app parar o envio em segundo plano.
 */
export async function recordMyLocations(deps: ServiceDeps, ctx: AccessContext, input: unknown): Promise<TrackingDecision & { stored: number }> {
  authorize(ctx, { permission: "self:profile.manage", companyId: ctx.companyId, ownerUserId: ctx.userId });
  const data = locationBatchSchema.parse(input);
  return withTenant(deps.db, ctx, async (tx) => {
    const consent = await activeTrackingConsent(tx, ctx.companyId, ctx.userId);
    const rental = consent?.customerId ? await trackedRental(tx, consent.customerId) : null;
    const decision = trackingDecision({ consentActive: Boolean(consent), rental });
    if (!decision.track) return { ...decision, stored: 0 };
    const points = acceptablePositions(data.positions);
    if (points.length)
      await tx.insert(customerLocations).values(points.map((p) => ({
        companyId: ctx.companyId, userId: ctx.userId, customerId: consent!.customerId!, rentalId: decision.rentalId,
        consentId: consent!.id, source: data.source, platform: data.platform, ...p,
      })));
    return { ...decision, stored: points.length };
  });
}
