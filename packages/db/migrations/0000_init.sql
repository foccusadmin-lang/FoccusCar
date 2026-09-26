CREATE TYPE "public"."account_status" AS ENUM('REGISTERED', 'PROFILE_INCOMPLETE', 'PROFILE_COMPLETE', 'UNDER_REVIEW', 'ACTIVE', 'SUSPENDED', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."checklist_item_result" AS ENUM('OK', 'DAMAGE', 'NOTE', 'PHOTO');--> statement-breakpoint
CREATE TYPE "public"."checklist_type" AS ENUM('CHECKOUT', 'RETURN', 'INSPECTION');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('DRAFT', 'ISSUED', 'SIGNED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."customer_document_type" AS ENUM('CNH_FRONT', 'CNH_BACK', 'RG', 'PROOF_OF_ADDRESS', 'SELFIE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."damage_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('PENDING', 'HELD', 'PARTIALLY_RETAINED', 'RETAINED', 'RELEASED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."financial_category" AS ENUM('RENTAL', 'DEPOSIT', 'FUEL', 'DAMAGE', 'EXTRA_KM', 'FINE', 'EXTRA_DAY', 'LATE_FEE', 'CLEANING', 'LOST_ITEM', 'FEE', 'MAINTENANCE', 'INSURANCE', 'DOCUMENTATION', 'OPERATION', 'REPRESENTATIVE_MARGIN', 'REFUND', 'ADJUSTMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."financial_direction" AS ENUM('INCOME', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."fine_status" AS ENUM('RECEIVED', 'DRIVER_IDENTIFIED', 'CHARGED', 'PAID', 'CONTESTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."fuel_level" AS ENUM('FULL', 'THREE_QUARTERS', 'HALF', 'QUARTER', 'RESERVE');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('FLEX', 'GASOLINE', 'ETHANOL', 'DIESEL', 'HYBRID', 'ELECTRIC');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."maintenance_type" AS ENUM('PREVENTIVE', 'CORRECTIVE', 'REVIEW', 'OIL', 'BRAKES', 'TIRES', 'SUSPENSION', 'ENGINE', 'ELECTRICAL', 'AIR_CONDITIONING', 'BODYWORK', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('IN_APP', 'EMAIL', 'WHATSAPP', 'PUSH');--> statement-breakpoint
CREATE TYPE "public"."occurrence_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CHECKOUT_LINK');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."rental_period" AS ENUM('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."rental_status" AS ENUM('SCHEDULED', 'CHECKOUT_IN_PROGRESS', 'ACTIVE', 'RETURN_IN_PROGRESS', 'PENDING_SETTLEMENT', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'CONVERTED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('CLIENTE', 'REPRESENTANTE', 'OPERADOR', 'FINANCEIRO', 'GERENTE', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."security_alert_status" AS ENUM('NEW', 'ANALYZING', 'RESOLVED', 'IGNORED');--> statement-breakpoint
CREATE TYPE "public"."security_alert_type" AS ENUM('GEOFENCE_EXIT', 'GEOFENCE_ENTRY_FORBIDDEN', 'COMMUNICATION_LOST', 'UNEXPECTED_MOVEMENT', 'IGNITION', 'OFF_HOURS_MOVEMENT', 'TAMPER');--> statement-breakpoint
CREATE TYPE "public"."telematics_command" AS ENUM('BLOCK', 'UNBLOCK');--> statement-breakpoint
CREATE TYPE "public"."telematics_command_status" AS ENUM('REQUESTED', 'SENT', 'CONFIRMED', 'FAILED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('MANUAL', 'AUTOMATIC', 'CVT', 'AUTOMATED');--> statement-breakpoint
CREATE TYPE "public"."vehicle_event_type" AS ENUM('FLEET_ENTRY', 'RESERVATION', 'RENTAL_START', 'RENTAL_END', 'CHECKOUT', 'RETURN', 'MILEAGE', 'FUEL', 'CHECKLIST', 'PHOTO', 'DAMAGE', 'REPAIR', 'MAINTENANCE', 'TIRES', 'OIL', 'FINE', 'ACCIDENT', 'OCCURRENCE', 'GPS', 'BLOCK', 'UNBLOCK', 'DOCUMENT', 'COST', 'REVENUE', 'STATUS_CHANGE', 'ADMIN_CHANGE');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'INSPECTION', 'CLEANING', 'BLOCKED', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."wallet_tx_status" AS ENUM('PENDING', 'AVAILABLE', 'WITHDRAWN', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('REQUESTED', 'REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"cnpj" varchar(14),
	"slug" varchar(60) NOT NULL,
	"domain" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" DEFAULT 'CLIENTE' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"company_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_key" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" "role" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"active_company_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"status" "account_status" DEFAULT 'PROFILE_INCOMPLETE' NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"driver_id" uuid,
	"type" "customer_document_type" NOT NULL,
	"custom_type_label" text,
	"status" "document_status" DEFAULT 'PENDING' NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"rejection_reason" text,
	"expires_at" date,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"cpf" varchar(11),
	"birth_date" date,
	"phone" varchar(20),
	"whatsapp" varchar(20),
	"email" text,
	"zip" varchar(8),
	"street" text,
	"number" varchar(20),
	"complement" text,
	"district" text,
	"city" text,
	"state" varchar(2),
	"profile_completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"cpf" varchar(11) NOT NULL,
	"is_customer_self" boolean DEFAULT false NOT NULL,
	"cnh_number" varchar(11),
	"cnh_categories" varchar(4),
	"cnh_issued_at" date,
	"cnh_expires_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "availability_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"state" varchar(2),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vehicle_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(60) NOT NULL,
	"required_cnh_category" varchar(2) DEFAULT 'B' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vehicle_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"number" text,
	"status" "document_status" DEFAULT 'APPROVED' NOT NULL,
	"storage_key" text,
	"issued_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"cost_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "vehicle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" "vehicle_event_type" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"description" text NOT NULL,
	"source" varchar(40) NOT NULL,
	"ref_table" varchar(60),
	"ref_id" uuid,
	"km" integer,
	"amount_cents" bigint,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"field" varchar(60) NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"changed_by" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"alt" text,
	"position" smallint DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"plate" varchar(8) NOT NULL,
	"renavam" varchar(11),
	"chassis" varchar(17),
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"version" text,
	"model_year" smallint NOT NULL,
	"manufacture_year" smallint,
	"color" text,
	"category_id" uuid,
	"transmission" "transmission" NOT NULL,
	"fuel_type" "fuel_type" NOT NULL,
	"seats" smallint,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_km" integer DEFAULT 0 NOT NULL,
	"status" "vehicle_status" DEFAULT 'INACTIVE' NOT NULL,
	"daily_rate_cents" bigint NOT NULL,
	"weekly_rate_cents" bigint,
	"biweekly_rate_cents" bigint,
	"monthly_rate_cents" bigint,
	"deposit_cents" bigint DEFAULT 0 NOT NULL,
	"km_allowance_per_day" integer,
	"extra_km_cents" bigint,
	"location_id" uuid,
	"showcase_visible" boolean DEFAULT false NOT NULL,
	"showcase_price_public" boolean DEFAULT true NOT NULL,
	"showcase_featured" boolean DEFAULT false NOT NULL,
	"acquired_at" timestamp with time zone,
	"acquisition_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"checklist_id" uuid NOT NULL,
	"item" varchar(40) NOT NULL,
	"result" "checklist_item_result" NOT NULL,
	"missing" boolean DEFAULT false NOT NULL,
	"note" text,
	"photo_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"rental_id" uuid,
	"vehicle_id" uuid NOT NULL,
	"type" "checklist_type" NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"performed_by" uuid,
	"km" integer NOT NULL,
	"fuel" "fuel_level" NOT NULL,
	"general_condition" text,
	"customer_signature_key" text,
	"operator_signature_key" text,
	"client_mutation_id" varchar(64),
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"number" varchar(20) NOT NULL,
	"reservation_id" uuid,
	"rental_id" uuid,
	"template_version" varchar(20) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"pdf_storage_key" text,
	"status" "contract_status" DEFAULT 'DRAFT' NOT NULL,
	"issued_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"signature" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "damages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"rental_id" uuid,
	"detected_in_checklist_id" uuid,
	"is_pre_existing" boolean DEFAULT false NOT NULL,
	"location" varchar(60) NOT NULL,
	"description" text NOT NULL,
	"severity" "damage_severity" NOT NULL,
	"photo_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_cost_cents" bigint,
	"responsible_customer_id" uuid,
	"repaired_at" timestamp with time zone,
	"repair_maintenance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "fuel_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"rental_id" uuid,
	"level" "fuel_level" NOT NULL,
	"liters_x100" integer,
	"cost_cents" bigint,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" uuid,
	"source" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mileage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"rental_id" uuid,
	"km" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" uuid,
	"source" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"rental_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"authorized_from" timestamp with time zone NOT NULL,
	"authorized_until" timestamp with time zone,
	"authorized_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(12) NOT NULL,
	"reservation_id" uuid,
	"customer_id" uuid NOT NULL,
	"main_driver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"expected_return_at" timestamp with time zone NOT NULL,
	"actual_return_at" timestamp with time zone,
	"period" "rental_period" DEFAULT 'DAILY' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"deposit_cents" bigint DEFAULT 0 NOT NULL,
	"km_out" integer,
	"km_in" integer,
	"km_allowance" integer,
	"fuel_out" "fuel_level",
	"fuel_in" "fuel_level",
	"status" "rental_status" DEFAULT 'SCHEDULED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(12) NOT NULL,
	"customer_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"category_id" uuid,
	"representative_listing_id" uuid,
	"pickup_location_id" uuid,
	"return_location_id" uuid,
	"pickup_at" timestamp with time zone NOT NULL,
	"return_at" timestamp with time zone NOT NULL,
	"period" "rental_period" DEFAULT 'DAILY' NOT NULL,
	"quantity" smallint DEFAULT 1 NOT NULL,
	"price_cents" bigint NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"fees_cents" bigint DEFAULT 0 NOT NULL,
	"representative_margin_cents" bigint DEFAULT 0 NOT NULL,
	"deposit_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint NOT NULL,
	"status" "reservation_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"rental_id" uuid NOT NULL,
	"direction" varchar(20) NOT NULL,
	"rating" smallint NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"comment" text,
	"author_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"rental_id" uuid,
	"driver_id" uuid,
	"infraction_at" timestamp with time zone NOT NULL,
	"place" text,
	"infraction_code" varchar(20),
	"description" text,
	"amount_cents" bigint NOT NULL,
	"document_key" text,
	"status" "fine_status" DEFAULT 'RECEIVED' NOT NULL,
	"responsibility" varchar(20) DEFAULT 'UNDEFINED' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" "maintenance_type" NOT NULL,
	"status" "maintenance_status" DEFAULT 'SCHEDULED' NOT NULL,
	"performed_at" timestamp with time zone,
	"km" integer,
	"workshop" text,
	"service" text NOT NULL,
	"parts_cents" bigint DEFAULT 0 NOT NULL,
	"labor_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"invoice_key" text,
	"photo_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_date" date,
	"next_km" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "maintenance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"maintenance_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"rental_id" uuid,
	"customer_id" uuid,
	"driver_id" uuid,
	"kind" varchar(30) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"place" text,
	"description" text NOT NULL,
	"photo_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"document_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cost_cents" bigint,
	"responsible_user_id" uuid,
	"status" "occurrence_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" varchar(10) NOT NULL,
	"geometry" jsonb NOT NULL,
	"alert_on_enter" boolean DEFAULT false NOT NULL,
	"alert_on_exit" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gps_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"provider" varchar(40) NOT NULL,
	"external_id" text NOT NULL,
	"imei" varchar(20),
	"model" text,
	"supports_remote_block" boolean DEFAULT false NOT NULL,
	"supports_ignition" boolean DEFAULT false NOT NULL,
	"last_communication_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gps_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"type" varchar(40) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gps_positions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "gps_positions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"company_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"speed_kmh" real,
	"heading" real,
	"ignition" boolean,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"device_id" uuid,
	"geofence_id" uuid,
	"type" "security_alert_type" NOT NULL,
	"status" "security_alert_status" DEFAULT 'NEW' NOT NULL,
	"severity" varchar(10) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"assigned_to" uuid,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telematics_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"command" "telematics_command" NOT NULL,
	"status" "telematics_command_status" DEFAULT 'REQUESTED' NOT NULL,
	"reason" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"confirmed_by" uuid,
	"security_alert_id" uuid,
	"vehicle_state_at_request" jsonb,
	"provider_request_id" text,
	"provider_response" jsonb,
	"sent_at" timestamp with time zone,
	"result_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_chargebacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reason" text,
	"status" varchar(20) NOT NULL,
	"provider_chargeback_id" text,
	"dispute_deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"from_status" "payment_status",
	"to_status" "payment_status" NOT NULL,
	"source" varchar(20) NOT NULL,
	"webhook_id" uuid,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"kind" varchar(30) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_gateway_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider" varchar(30) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"secret_ref" text NOT NULL,
	"max_installments" smallint DEFAULT 1 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"provider" varchar(30) NOT NULL,
	"provider_token" text NOT NULL,
	"brand" varchar(20),
	"last4" varchar(4),
	"exp_month" smallint,
	"exp_year" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" "payment_status" DEFAULT 'PROCESSING' NOT NULL,
	"provider_refund_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"operation" varchar(20) NOT NULL,
	"status" "payment_status" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"provider_transaction_id" text,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"provider" varchar(30) NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"signature_valid" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"reservation_id" uuid,
	"rental_id" uuid,
	"purpose" varchar(30) NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"installments" smallint DEFAULT 1 NOT NULL,
	"provider" varchar(30) NOT NULL,
	"provider_payment_id" text,
	"idempotency_key" varchar(64) NOT NULL,
	"pix_qr_code" text,
	"checkout_url" text,
	"expires_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"label" text NOT NULL,
	"bank_code" varchar(5) NOT NULL,
	"branch" varchar(10) NOT NULL,
	"account_number_encrypted" text NOT NULL,
	"account_number_last4" varchar(4) NOT NULL,
	"pix_key_encrypted" text,
	"holder_name" text NOT NULL,
	"holder_document_masked" varchar(20),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"amount_cents" bigint NOT NULL,
	"description" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"deposit_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reason" text,
	"damage_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"rental_id" uuid,
	"reservation_id" uuid,
	"customer_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"retained_cents" bigint DEFAULT 0 NOT NULL,
	"status" "deposit_status" DEFAULT 'PENDING' NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" varchar(20) NOT NULL,
	"bank_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"direction" "financial_direction" NOT NULL,
	"category" "financial_category" NOT NULL,
	"status" varchar(12) DEFAULT 'PENDING' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"competence_date" date NOT NULL,
	"settled_at" timestamp with time zone,
	"financial_account_id" uuid,
	"vehicle_id" uuid,
	"customer_id" uuid,
	"reservation_id" uuid,
	"rental_id" uuid,
	"payment_id" uuid,
	"source_table" varchar(60),
	"source_id" uuid,
	"reverses_id" uuid,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "reconciliation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_id" uuid,
	"financial_transaction_id" uuid,
	"bank_transaction_id" uuid,
	"status" varchar(20) NOT NULL,
	"difference_cents" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "rental_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"rental_id" uuid NOT NULL,
	"category" "financial_category" NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" varchar(12) DEFAULT 'OPEN' NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "representative_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"representative_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"slug" varchar(80) NOT NULL,
	"margin_cents" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "representatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"document" varchar(14),
	"max_margin_cents" bigint DEFAULT 0 NOT NULL,
	"status" varchar(12) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" "wallet_tx_status" DEFAULT 'PENDING' NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"reservation_id" uuid,
	"rental_id" uuid,
	"withdrawal_request_id" uuid,
	"available_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"representative_id" uuid NOT NULL,
	"available_cents" bigint DEFAULT 0 NOT NULL,
	"pending_cents" bigint DEFAULT 0 NOT NULL,
	"total_earned_cents" bigint DEFAULT 0 NOT NULL,
	"total_withdrawn_cents" bigint DEFAULT 0 NOT NULL,
	"total_invested_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"destination" varchar(20) NOT NULL,
	"destination_details_masked" text,
	"status" "withdrawal_status" DEFAULT 'REQUESTED' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"company_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(60) NOT NULL,
	"entity" varchar(60) NOT NULL,
	"entity_id" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"origin" varchar(20) NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "notification_channel" DEFAULT 'IN_APP' NOT NULL,
	"topic" varchar(30) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"status" varchar(12) DEFAULT 'QUEUED' NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_company_id_companies_id_fk" FOREIGN KEY ("active_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_alerts" ADD CONSTRAINT "availability_alerts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_alerts" ADD CONSTRAINT "availability_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_history" ADD CONSTRAINT "vehicle_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_history" ADD CONSTRAINT "vehicle_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_category_id_vehicle_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."vehicle_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damages" ADD CONSTRAINT "damages_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damages" ADD CONSTRAINT "damages_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damages" ADD CONSTRAINT "damages_detected_in_checklist_id_checklists_id_fk" FOREIGN KEY ("detected_in_checklist_id") REFERENCES "public"."checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damages" ADD CONSTRAINT "damages_responsible_customer_id_customers_id_fk" FOREIGN KEY ("responsible_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mileage_records" ADD CONSTRAINT "mileage_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mileage_records" ADD CONSTRAINT "mileage_records_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mileage_records" ADD CONSTRAINT "mileage_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_drivers" ADD CONSTRAINT "rental_drivers_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_drivers" ADD CONSTRAINT "rental_drivers_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_drivers" ADD CONSTRAINT "rental_drivers_authorized_by_users_id_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_main_driver_id_drivers_id_fk" FOREIGN KEY ("main_driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_category_id_vehicle_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."vehicle_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_pickup_location_id_locations_id_fk" FOREIGN KEY ("pickup_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_return_location_id_locations_id_fk" FOREIGN KEY ("return_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fines" ADD CONSTRAINT "fines_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fines" ADD CONSTRAINT "fines_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fines" ADD CONSTRAINT "fines_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_items" ADD CONSTRAINT "maintenance_items_maintenance_id_maintenance_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_responsible_user_id_users_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_devices" ADD CONSTRAINT "gps_devices_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_events" ADD CONSTRAINT "gps_events_device_id_gps_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."gps_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_events" ADD CONSTRAINT "gps_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_positions" ADD CONSTRAINT "gps_positions_device_id_gps_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."gps_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_positions" ADD CONSTRAINT "gps_positions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_device_id_gps_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."gps_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_geofence_id_geofences_id_fk" FOREIGN KEY ("geofence_id") REFERENCES "public"."geofences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telematics_commands" ADD CONSTRAINT "telematics_commands_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telematics_commands" ADD CONSTRAINT "telematics_commands_device_id_gps_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."gps_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telematics_commands" ADD CONSTRAINT "telematics_commands_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telematics_commands" ADD CONSTRAINT "telematics_commands_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telematics_commands" ADD CONSTRAINT "telematics_commands_security_alert_id_security_alerts_id_fk" FOREIGN KEY ("security_alert_id") REFERENCES "public"."security_alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_chargebacks" ADD CONSTRAINT "payment_chargebacks_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fees" ADD CONSTRAINT "payment_fees_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_movements" ADD CONSTRAINT "deposit_movements_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_financial_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("financial_transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "representative_listings" ADD CONSTRAINT "representative_listings_representative_id_representatives_id_fk" FOREIGN KEY ("representative_id") REFERENCES "public"."representatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "representative_listings" ADD CONSTRAINT "representative_listings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "representatives" ADD CONSTRAINT "representatives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_representative_id_representatives_id_fk" FOREIGN KEY ("representative_id") REFERENCES "public"."representatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_uq" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_slug_uq" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_domain_uq" ON "companies" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "company_members_uq" ON "company_members" USING btree ("company_id","user_id","role");--> statement-breakpoint
CREATE INDEX "company_members_user_idx" ON "company_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_company_key_uq" ON "roles" USING btree ("company_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "customer_documents_customer_idx" ON "customer_documents" USING btree ("customer_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_company_cpf_uq" ON "customers" USING btree ("company_id","cpf");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_company_user_uq" ON "customers" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "customers_company_name_idx" ON "customers" USING btree ("company_id","full_name");--> statement-breakpoint
CREATE INDEX "drivers_customer_idx" ON "drivers" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_company_cpf_uq" ON "drivers" USING btree ("company_id","cpf");--> statement-breakpoint
CREATE UNIQUE INDEX "availability_alerts_uq" ON "availability_alerts" USING btree ("vehicle_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_uq" ON "favorites" USING btree ("vehicle_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_categories_uq" ON "vehicle_categories" USING btree ("company_id","slug");--> statement-breakpoint
CREATE INDEX "vehicle_documents_expiry_idx" ON "vehicle_documents" USING btree ("company_id","expires_at");--> statement-breakpoint
CREATE INDEX "vehicle_events_timeline_idx" ON "vehicle_events" USING btree ("vehicle_id","occurred_at");--> statement-breakpoint
CREATE INDEX "vehicle_history_vehicle_idx" ON "vehicle_history" USING btree ("vehicle_id","created_at");--> statement-breakpoint
CREATE INDEX "vehicle_photos_vehicle_idx" ON "vehicle_photos" USING btree ("vehicle_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_company_plate_uq" ON "vehicles" USING btree ("company_id","plate");--> statement-breakpoint
CREATE INDEX "vehicles_showcase_idx" ON "vehicles" USING btree ("company_id","showcase_visible","status");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_items_uq" ON "checklist_items" USING btree ("checklist_id","item");--> statement-breakpoint
CREATE INDEX "checklists_rental_idx" ON "checklists" USING btree ("rental_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "checklists_client_mutation_uq" ON "checklists" USING btree ("company_id","client_mutation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_number_uq" ON "contracts" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "damages_vehicle_idx" ON "damages" USING btree ("vehicle_id","repaired_at");--> statement-breakpoint
CREATE INDEX "fuel_records_vehicle_idx" ON "fuel_records" USING btree ("vehicle_id","recorded_at");--> statement-breakpoint
CREATE INDEX "mileage_records_vehicle_idx" ON "mileage_records" USING btree ("vehicle_id","recorded_at");--> statement-breakpoint
CREATE INDEX "rental_drivers_rental_idx" ON "rental_drivers" USING btree ("rental_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rentals_code_uq" ON "rentals" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "rentals_vehicle_idx" ON "rentals" USING btree ("vehicle_id","start_at");--> statement-breakpoint
CREATE INDEX "rentals_customer_idx" ON "rentals" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_code_uq" ON "reservations" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "reservations_vehicle_period_idx" ON "reservations" USING btree ("vehicle_id","pickup_at","return_at");--> statement-breakpoint
CREATE INDEX "reservations_customer_idx" ON "reservations" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_uq" ON "reviews" USING btree ("rental_id","direction");--> statement-breakpoint
CREATE INDEX "fines_vehicle_idx" ON "fines" USING btree ("vehicle_id","infraction_at");--> statement-breakpoint
CREATE INDEX "maintenance_vehicle_idx" ON "maintenance" USING btree ("vehicle_id","performed_at");--> statement-breakpoint
CREATE INDEX "occurrences_vehicle_idx" ON "occurrences" USING btree ("vehicle_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gps_devices_provider_uq" ON "gps_devices" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "gps_events_vehicle_idx" ON "gps_events" USING btree ("vehicle_id","occurred_at");--> statement-breakpoint
CREATE INDEX "gps_positions_vehicle_time_idx" ON "gps_positions" USING btree ("vehicle_id","recorded_at");--> statement-breakpoint
CREATE INDEX "security_alerts_status_idx" ON "security_alerts" USING btree ("company_id","status","occurred_at");--> statement-breakpoint
CREATE INDEX "telematics_commands_vehicle_idx" ON "telematics_commands" USING btree ("vehicle_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_events_payment_idx" ON "payment_events" USING btree ("payment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhooks_event_uq" ON "payment_webhooks" USING btree ("provider","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_uq" ON "payments" USING btree ("company_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_uq" ON "payments" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_transactions_uq" ON "bank_transactions" USING btree ("bank_account_id","external_id");--> statement-breakpoint
CREATE INDEX "financial_tx_vehicle_idx" ON "financial_transactions" USING btree ("vehicle_id","competence_date");--> statement-breakpoint
CREATE INDEX "financial_tx_company_date_idx" ON "financial_transactions" USING btree ("company_id","competence_date");--> statement-breakpoint
CREATE UNIQUE INDEX "representative_listings_slug_uq" ON "representative_listings" USING btree ("company_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "representatives_user_uq" ON "representatives" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "wallet_tx_wallet_idx" ON "wallet_transactions" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_rep_uq" ON "wallets" USING btree ("representative_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("company_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_time_idx" ON "audit_logs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");