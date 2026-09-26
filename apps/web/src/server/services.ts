import "server-only";
import { consoleMailer } from "@foccus/auth";
import { createStorage, type StorageProvider } from "@foccus/integrations";
import type { ServiceDeps } from "@foccus/services";
import { db } from "./db";

let storage: StorageProvider | undefined;

/** Storage criado sob demanda: a configuração é exigida em tempo de execução, não no build. */
export const deps: ServiceDeps = {
  db,
  get storage() {
    storage ??= createStorage();
    return storage;
  },
  mailer: consoleMailer,
};
