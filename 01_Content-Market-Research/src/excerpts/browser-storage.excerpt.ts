// 静态源码选摘，不是可独立运行模块。未收录的类型、连接器和依赖见 README。
// 请勿把此文件接入生产服务；本展示包的离线测试不会导入本文件。

// 源文件 app/lib/storage.ts，第 7 行：databaseRequest
async function databaseRequest<T>(url: string, init?: RequestInit): Promise<T> {
  // Opening a page may race the local MySQL startup. Retry reads only; never replay writes.
  const readOnly = (init?.method ?? "GET").toUpperCase() === "GET";
  const retryDelays = [1000, 2000, 4000, 8000, 15000];
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { cache: "no-store", ...init, ...(readOnly ? { signal: init?.signal ?? AbortSignal.timeout(10000) } : {}) });
      if (readOnly && [502, 503, 504].includes(response.status)) {
        // A proxy may return HTML while the service is starting; do not parse it as JSON.
        throw new TypeError("MySQL 暂时不可用，正在自动连接");
      }
      const payload = await response.json() as T & { ok?: boolean; error?: string };
      if (!response.ok || payload.ok === false) throw Object.assign(new Error(payload.error || "MySQL 数据库未连接"), { status: response.status });
      return payload;
    } catch (error) {
      const transient = error instanceof TypeError || (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name));
      if (!readOnly || !transient || init?.signal?.aborted || attempt >= retryDelays.length) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, retryDelays[attempt]));
    }
  }
}

// 源文件 app/lib/storage.ts，第 29 行：operation
async function operation<T = { ok: true }>(name: string, body: Record<string, unknown> = {}) {
  return databaseRequest<T>("/api/database", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: name, ...body }) });
}

// 源文件 app/lib/storage.ts，第 37 行：loadWorkbenchCoreState
export async function loadWorkbenchCoreState(): Promise<WorkbenchState | null> {
  return (await databaseRequest<{ ok: true; state: WorkbenchState | null }>("/api/database?resource=state")).state;
}

// 源文件 app/lib/storage.ts，第 94 行：saveWorkbenchState
export async function saveWorkbenchState(state: WorkbenchState): Promise<SaveResult> {
  const saved = await operation<SaveResult>("save-state", { state: workbenchSavePayload(state) });
  if (!Number.isSafeInteger(saved.revision) || saved.revision < 0) throw new Error("保存后的数据版本未确认，请保留修改并刷新页面。");
  // New samples and keywords use the same review path as the historical backfill.
  try {
    const response = await fetch("/api/ai-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("AI 复核暂时不可用");
    return saved;
  } catch { return { ...saved, reviewWarning: "数据已保存；AI 复核暂未启动，请稍后从复核入口继续。" }; }
}
