interface CloudflareWorkersModule {
  env?: CloudflareEnv;
}

export interface CloudflareEnvLoaders {
  loadCloudflareWorkersEnv: () => Promise<CloudflareEnv | undefined>;
  loadGlobalEnvOverride: () => CloudflareEnv | undefined;
}

const cloudflareWorkersModuleId = "cloudflare:workers";
const cloudflareEnvOverrideKey = "__DOOM_INDEX_CLOUDFLARE_ENV__";

type CloudflareEnvOverrideGlobal = typeof globalThis & {
  __DOOM_INDEX_CLOUDFLARE_ENV__?: CloudflareEnv;
};

async function importCloudflareWorkersModule(): Promise<CloudflareWorkersModule> {
  return (await import(
    /* @vite-ignore */
    cloudflareWorkersModuleId
  )) as CloudflareWorkersModule;
}

async function loadCloudflareWorkersEnv(): Promise<CloudflareEnv | undefined> {
  try {
    const cloudflareWorkersModule = await importCloudflareWorkersModule();
    return cloudflareWorkersModule.env;
  } catch {
    return undefined;
  }
}

function loadGlobalEnvOverride(): CloudflareEnv | undefined {
  return (globalThis as CloudflareEnvOverrideGlobal)[cloudflareEnvOverrideKey];
}

export async function resolveCloudflareEnvFromLoaders({
  loadCloudflareWorkersEnv,
  loadGlobalEnvOverride,
}: CloudflareEnvLoaders): Promise<CloudflareEnv | undefined> {
  const workersEnv = await loadCloudflareWorkersEnv();
  if (workersEnv) {
    return workersEnv;
  }

  return loadGlobalEnvOverride();
}

export async function resolveCloudflareEnv(): Promise<CloudflareEnv | undefined> {
  return resolveCloudflareEnvFromLoaders({
    loadCloudflareWorkersEnv,
    loadGlobalEnvOverride,
  });
}
