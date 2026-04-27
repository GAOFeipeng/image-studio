"use client";

import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Download,
  Edit3,
  ImageIcon,
  Layers,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Upload,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Role = "USER" | "ADMIN";
type User = {
  id: string;
  email: string;
  role: Role;
  status: string;
  createdAt: string;
};

type Session = {
  id: string;
  title: string;
  updatedAt: string;
  _count?: { turns: number; assets: number };
};

type Asset = {
  id: string;
  kind: "INPUT" | "OUTPUT" | "MASK" | "REFERENCE";
  source: "UPLOAD" | "GENERATION" | "EDIT";
  mimeType: string;
  sizeBytes: number;
  originalFilename?: string | null;
  createdByTurnId?: string | null;
  createdAt: string;
  url: string;
};

type Turn = {
  id: string;
  type: "GENERATION" | "EDIT";
  status: "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  prompt: string;
  providerModel: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  latencyMs?: number | null;
  outputAssetIds: string[];
  createdAt: string;
};

type Analytics = {
  metrics: {
    todayTasks: number;
    sevenDayTasks: number;
    totalUsers: number;
    activeUsers30d: number;
    successCount: number;
    failedCount: number;
    sevenDaySuccessCount: number;
    sevenDayFailedCount: number;
    successRate: number;
    failedRate: number;
    sevenDaySuccessRate: number;
    sevenDayFailedRate: number;
    averageLatencyMs: number;
    sevenDayAverageLatencyMs: number;
  };
  daily: Array<{ date: string; generation: number; edit: number; failed: number }>;
  models: Array<{ name: string; value: number }>;
  failedTurns: Array<{
    id: string;
    prompt: string;
    type: string;
    providerModel: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    errorStatus?: number | null;
    latencyMs?: number | null;
    createdAt: string;
    user?: { email: string } | null;
  }>;
  recentTasks: Array<{
    id: string;
    prompt: string;
    type: string;
    status: Turn["status"];
    providerModel: string;
    latencyMs?: number | null;
    createdAt: string;
    user?: { email: string } | null;
  }>;
  userUsage: Array<{
    userId: string;
    email: string;
    tasks: number;
    succeeded: number;
    failed: number;
    averageLatencyMs: number;
  }>;
};

type AdminTask = Turn & {
  user: { email: string };
  session: { title: string };
};

type AdminUser = User & {
  _count: { sessions: number; turns: number; assets: number };
};

type AuditLog = {
  id: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  createdAt: string;
  actor?: { email: string } | null;
};

type ProviderSettings = {
  provider: "openai-compatible" | "mock";
  apiBaseUrl: string;
  generationPath: string;
  editPath: string;
  defaultModel: string;
  defaultSize: string;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
};

type ApiError = {
  error?: { message?: string; code?: string };
};

type UploadPreview = {
  id: string;
  name: string;
  size: number;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
  }
}

const defaultModel = "gpt-image-2";
const sizes = ["1024x1024", "1024x1536", "1536x1024"];
const acceptedUploadTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxEditInputs = 4;

export function AppShell() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [requiresBootstrap, setRequiresBootstrap] = useState(false);
  const [databaseUnavailable, setDatabaseUnavailable] = useState(false);
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [view, setView] = useState<"studio" | "assets" | "admin">("studio");
  const [mode, setMode] = useState<"generation" | "edit">("generation");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [size, setSize] = useState(sizes[0]);
  const [quality, setQuality] = useState<"auto" | "low" | "medium" | "high">("auto");
  const [count, setCount] = useState(1);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [admin, setAdmin] = useState<{
    analytics?: Analytics;
    tasks: AdminTask[];
    users: AdminUser[];
    auditLogs: AuditLog[];
    providerSettings?: ProviderSettings;
  }>({ tasks: [], users: [], auditLogs: [] });
  const [providerSettings, setProviderSettings] = useState<ProviderSettings | null>(null);
  const [uploadPreviews, setUploadPreviews] = useState<UploadPreview[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPreviewUrls = useRef<string[]>([]);

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);

  useEffect(() => {
    void refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      void refreshProviderDefaults();
      void refreshSessions();
      if (user.role === "ADMIN") {
        void refreshAdmin();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedSessionId) {
      void refreshSessionData(selectedSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

  useEffect(() => {
    function pasteImages(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      void uploadFiles(files);
    }

    window.addEventListener("paste", pasteImages);
    return () => window.removeEventListener("paste", pasteImages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId, mode]);

  useEffect(() => {
    uploadPreviewUrls.current = uploadPreviews.map((preview) => preview.previewUrl);
  }, [uploadPreviews]);

  useEffect(() => {
    return () => {
      uploadPreviewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      credentials: "include",
      headers:
        init?.body instanceof FormData
          ? init.headers
          : { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
    const data = (await response.json().catch(() => ({}))) as T & ApiError;

    if (!response.ok) {
      throw new ApiRequestError(
        data.error?.message ?? `Request failed with ${response.status}`,
        data.error?.code,
        response.status,
      );
    }

    return data;
  }

  async function refreshMe() {
    try {
      const [me, bootstrap] = await Promise.all([
        request<{ user: User | null }>("/api/auth/me"),
        request<{ requiresBootstrap: boolean }>("/api/auth/bootstrap"),
      ]);
      setUser(me.user);
      setRequiresBootstrap(bootstrap.requiresBootstrap);
      setDatabaseUnavailable(false);
      if (!me.user && bootstrap.requiresBootstrap) {
        setAuthMode("register");
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "database_unavailable") {
        setDatabaseUnavailable(true);
      }
      setMessage(error instanceof Error ? error.message : "Could not initialize app");
    }
  }

  async function refreshSessions() {
    const data = await request<{ sessions: Session[] }>("/api/sessions");
    let nextSessions = data.sessions;

    if (nextSessions.length === 0) {
      const created = await request<{ session: Session }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ title: "新创作" }),
      });
      nextSessions = [created.session];
    }

    setSessions(nextSessions);
    setSelectedSessionId((current) => current ?? nextSessions[0]?.id ?? null);
  }

  async function refreshSessionData(sessionId: string) {
    const [assetData, turnData] = await Promise.all([
      request<{ assets: Asset[] }>(`/api/sessions/${sessionId}/assets`),
      request<{ turns: Turn[] }>(`/api/sessions/${sessionId}/turns`),
    ]);
    setAssets(assetData.assets);
    setTurns(turnData.turns);
  }

  async function refreshAdmin() {
    const [analytics, tasks, users, auditLogs, providerSettings] = await Promise.all([
      request<Analytics>("/api/admin/analytics"),
      request<{ tasks: AdminTask[] }>("/api/admin/tasks"),
      request<{ users: AdminUser[] }>("/api/admin/users"),
      request<{ auditLogs: AuditLog[] }>("/api/admin/audit-logs"),
      request<{ settings: ProviderSettings }>("/api/admin/provider-settings"),
    ]);
    setAdmin({
      analytics,
      tasks: tasks.tasks,
      users: users.users,
      auditLogs: auditLogs.auditLogs,
      providerSettings: providerSettings.settings,
    });
    setProviderSettings(providerSettings.settings);
    setModel(providerSettings.settings.defaultModel);
    setSize(providerSettings.settings.defaultSize);
  }

  async function refreshProviderDefaults() {
    const data = await request<{ settings: ProviderSettings }>("/api/provider-settings");
    setProviderSettings(data.settings);
    setModel(data.settings.defaultModel);
    setSize(data.settings.defaultSize);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("请输入邮箱");
      return;
    }
    if (!password) {
      setMessage("请输入密码");
      return;
    }
    if (authMode === "register" && password.length < 8) {
      setMessage("密码至少需要 8 位");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const data = await request<{ user: User }>(`/api/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      setUser(data.user);
      setRequiresBootstrap(false);
      setDatabaseUnavailable(false);
      setPassword("");
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "database_unavailable") {
        setDatabaseUnavailable(true);
      }
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await request("/api/auth/logout", { method: "POST" });
    setUser(null);
    setSessions([]);
    setSelectedSessionId(null);
    setAssets([]);
    setTurns([]);
  }

  async function createNewSession() {
    const title = window.prompt("创作标题", "新创作")?.trim() || "新创作";
    const data = await request<{ session: Session }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    setSessions((current) => [data.session, ...current]);
    setSelectedSessionId(data.session.id);
    setView("studio");
  }

  async function uploadFiles(files: FileList | File[] | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length || !selectedSessionId) return;

    const imageFiles = selectedFiles.filter((file) => acceptedUploadTypes.has(file.type));
    const rejectedCount = selectedFiles.length - imageFiles.length;
    if (rejectedCount > 0) {
      setMessage("Only PNG, JPEG, and WebP images can be uploaded.");
    }
    if (imageFiles.length === 0) return;

    const queued = imageFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      name: file.name || "pasted-image.png",
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      status: "queued" as const,
    }));
    setUploadPreviews((current) => [...queued, ...current].slice(0, 12));
    setBusy(true);
    if (rejectedCount === 0) setMessage(null);

    try {
      for (const [index, file] of imageFiles.entries()) {
        const previewId = queued[index].id;
        setUploadPreviews((current) =>
          current.map((preview) => (preview.id === previewId ? { ...preview, status: "uploading" } : preview)),
        );
        const form = new FormData();
        form.set("file", file);
        form.set("kind", mode === "edit" ? "INPUT" : "REFERENCE");
        try {
          const data = await request<{ asset: Asset }>(`/api/sessions/${selectedSessionId}/assets/upload`, {
            method: "POST",
            body: form,
          });
          setAssets((current) => [data.asset, ...current]);
          if (mode === "edit") {
            setSelectedAssetIds((current) => Array.from(new Set([...current, data.asset.id])).slice(0, maxEditInputs));
          }
          setUploadPreviews((current) =>
            current.map((preview) => (preview.id === previewId ? { ...preview, status: "done" } : preview)),
          );
        } catch (error) {
          const uploadError = error instanceof Error ? error.message : "Upload failed";
          setUploadPreviews((current) =>
            current.map((preview) =>
              preview.id === previewId ? { ...preview, status: "error", error: uploadError } : preview,
            ),
          );
          setMessage(uploadError);
        }
      }
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function submitTurn() {
    if (!selectedSessionId || !prompt.trim()) return;
    if (providerSettings?.provider !== "openai-compatible" || !providerSettings.hasApiKey) {
      setMessage("请先在管理员端配置真实 OpenAI-compatible Provider 和 API key。");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const endpoint =
        mode === "generation"
          ? `/api/sessions/${selectedSessionId}/turns/generation`
          : `/api/sessions/${selectedSessionId}/turns/edit`;
      const body =
        mode === "generation"
          ? { prompt, params: { model, size, quality, n: count } }
          : { prompt, params: { model, size, quality, n: count }, inputAssetIds: selectedAssetIds };

      const data = await request<{ turn: Turn; assets: Asset[] }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setTurns((current) => [...current, data.turn]);
      setAssets((current) => [...data.assets, ...current]);
      setPrompt("");
      await refreshSessions();
      if (user?.role === "ADMIN") await refreshAdmin();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image task failed");
      if (selectedSessionId) await refreshSessionData(selectedSessionId);
    } finally {
      setBusy(false);
    }
  }

  async function retryTurn(turnId: string) {
    setBusy(true);
    setMessage(null);

    try {
      const data = await request<{ turn: Turn; assets: Asset[] }>(`/api/turns/${turnId}/retry`, {
        method: "POST",
      });
      setTurns((current) => [...current, data.turn]);
      setAssets((current) => [...data.assets, ...current]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  function continueEditing(asset: Asset) {
    setView("studio");
    setMode("edit");
    setSelectedAssetIds([asset.id]);
    setPrompt("");
  }

  function openUploadPicker() {
    fileInputRef.current?.click();
  }

  if (!user) {
    if (databaseUnavailable) {
      return <DatabaseSetup message={message} refresh={refreshMe} busy={busy} />;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111111] px-4">
        <form
          onSubmit={submitAuth}
          className="w-full max-w-md rounded-lg border border-zinc-800 bg-[#181818] p-6 shadow-2xl"
        >
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-white text-lg font-black text-black">
              oi
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                {requiresBootstrap ? "创建首个管理员" : "Image Studio"}
              </h1>
              <p className="text-sm text-zinc-400">
                {requiresBootstrap ? "当前没有用户，请先注册管理员账号。" : "图像生成与多轮编辑工作台"}
              </p>
            </div>
          </div>

          {requiresBootstrap ? null : (
            <div className="mb-5 grid grid-cols-2 rounded-md bg-zinc-900 p-1 text-sm">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`rounded px-3 py-2 ${authMode === "login" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                className={`rounded px-3 py-2 ${authMode === "register" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
              >
                注册
              </button>
            </div>
          )}

          <label className="mb-2 block text-sm text-zinc-300">邮箱</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mb-4 h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-zinc-400"
          />
          <label className="mb-2 block text-sm text-zinc-300">密码</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mb-4 h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-zinc-400"
          />
          {message ? (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              <AlertCircle size={16} />
              {message}
            </div>
          ) : null}
          <button
            disabled={busy || !email.trim() || !password || (authMode === "register" && password.length < 8)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-black disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            {requiresBootstrap ? "创建管理员账号" : authMode === "login" ? "进入工作台" : "创建账号"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#111111] text-zinc-100">
      <aside className="hidden w-[300px] shrink-0 flex-col border-r border-zinc-900 bg-[#0d0d0d] md:flex">
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-white text-xs font-black text-black">oi</div>
            <span className="font-semibold">Image Studio</span>
          </div>
          <button
            onClick={createNewSession}
            className="grid h-8 w-8 place-items-center rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white"
            title="新建创作"
          >
            <Plus size={18} />
          </button>
        </div>

        <nav className="space-y-1 px-3 py-2">
          <SidebarButton active={view === "studio"} icon={<Edit3 size={19} />} label="工作台" onClick={() => setView("studio")} />
          <SidebarButton active={view === "assets"} icon={<Layers size={19} />} label="资产池" onClick={() => setView("assets")} />
          {user.role === "ADMIN" ? (
            <SidebarButton active={view === "admin"} icon={<BarChart3 size={19} />} label="管理员" onClick={() => setView("admin")} />
          ) : null}
        </nav>

        <div className="px-5 pb-2 pt-5 text-xs uppercase tracking-wide text-zinc-500">会话</div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                setSelectedSessionId(session.id);
                setView("studio");
              }}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                selectedSessionId === session.id ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              <div className="truncate font-medium">{session.title}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {session._count?.turns ?? 0} 轮 / {session._count?.assets ?? 0} 图
              </div>
            </button>
          ))}
        </div>

        <div className="border-t border-zinc-900 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-amber-500 text-sm font-bold text-black">
              {user.email[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user.email}</div>
              <div className="text-xs text-zinc-500">{user.role}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            <LogOut size={16} />
            退出
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-900 px-4 md:px-7">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold md:text-2xl">
              {view === "studio" ? selectedSession?.title ?? "工作台" : view === "assets" ? "资产池" : "管理员控制台"}
              {view === "studio" ? <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400">{model}</span> : null}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {view === "studio" ? "多轮生成、编辑和资产复用" : view === "assets" ? "上传、生成和编辑结果集中管理" : "使用情况、任务健康和审计"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => selectedSessionId && refreshSessionData(selectedSessionId)}
              className="grid h-9 w-9 place-items-center rounded-md text-zinc-300 hover:bg-zinc-800"
              title="刷新"
            >
              <RefreshCw size={17} />
            </button>
            <button className="grid h-9 w-9 place-items-center rounded-md text-zinc-300 hover:bg-zinc-800" title="设置">
              <Settings2 size={17} />
            </button>
          </div>
        </header>

        {message ? (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200 md:mx-7">
            <AlertCircle size={16} />
            {message}
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(event) => uploadFiles(event.target.files)}
          className="hidden"
        />

        {view === "studio" ? (
          <StudioView
            assets={assets}
            turns={turns}
            assetById={assetById}
            mode={mode}
            setMode={setMode}
            prompt={prompt}
            setPrompt={setPrompt}
            model={model}
            setModel={setModel}
            size={size}
            setSize={setSize}
            quality={quality}
            setQuality={setQuality}
            count={count}
            setCount={setCount}
            selectedAssetIds={selectedAssetIds}
            setSelectedAssetIds={setSelectedAssetIds}
            submitTurn={submitTurn}
            retryTurn={retryTurn}
            continueEditing={continueEditing}
            openUploadPicker={openUploadPicker}
            uploadFiles={uploadFiles}
            uploadPreviews={uploadPreviews}
            providerSettings={providerSettings}
            busy={busy}
          />
        ) : null}

        {view === "assets" ? (
          <AssetPool assets={assets} selectedAssetIds={selectedAssetIds} setSelectedAssetIds={setSelectedAssetIds} continueEditing={continueEditing} />
        ) : null}

        {view === "admin" && user.role === "ADMIN" ? (
          <AdminView data={admin} refreshAdmin={refreshAdmin} request={request} setMessage={setMessage} />
        ) : null}
      </main>
    </div>
  );
}

function DatabaseSetup(props: { message: string | null; refresh: () => Promise<void>; busy: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111111] px-4">
      <section className="w-full max-w-xl rounded-lg border border-zinc-800 bg-[#181818] p-6 shadow-2xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-red-500/15 text-red-300">
            <AlertCircle size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">数据库未就绪</h1>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              应用已经启动，但 PostgreSQL 没有连接成功，或 Prisma schema 还没有迁移。先完成数据库初始化，再创建首个管理员账号。
            </p>
          </div>
        </div>

        {props.message ? (
          <div className="mb-4 rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {props.message}
          </div>
        ) : null}

        <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
          <p className="font-medium text-zinc-100">本地开发：</p>
          <pre className="overflow-x-auto rounded bg-black/50 p-3 text-xs text-zinc-300">
{`docker compose up -d postgres
npm run db:push`}
          </pre>
          <p className="font-medium text-zinc-100">Ubuntu / Docker 部署：</p>
          <pre className="overflow-x-auto rounded bg-black/50 p-3 text-xs text-zinc-300">
{`docker compose up -d --build`}
          </pre>
        </div>

        <button
          onClick={props.refresh}
          disabled={props.busy}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-black disabled:opacity-60"
        >
          {props.busy ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          重新检测数据库
        </button>
      </section>
    </main>
  );
}

function SidebarButton(props: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${
        props.active ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
      }`}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

function StudioView(props: {
  assets: Asset[];
  turns: Turn[];
  assetById: Map<string, Asset>;
  mode: "generation" | "edit";
  setMode: (mode: "generation" | "edit") => void;
  prompt: string;
  setPrompt: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  size: string;
  setSize: (value: string) => void;
  quality: "auto" | "low" | "medium" | "high";
  setQuality: (value: "auto" | "low" | "medium" | "high") => void;
  count: number;
  setCount: (value: number) => void;
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  submitTurn: () => Promise<void>;
  retryTurn: (id: string) => Promise<void>;
  continueEditing: (asset: Asset) => void;
  openUploadPicker: () => void;
  uploadFiles: (files: FileList | File[] | null) => Promise<void>;
  uploadPreviews: UploadPreview[];
  providerSettings: ProviderSettings | null;
  busy: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);
  const providerReady = props.providerSettings?.provider === "openai-compatible" && props.providerSettings.hasApiKey;
  const providerWarning = !props.providerSettings
    ? "正在读取图像供应商配置。"
    : props.providerSettings.provider === "mock"
      ? "当前是开发 mock provider，不会调用真实文生图接口。请在管理员端切换到 OpenAI-compatible。"
      : !props.providerSettings.hasApiKey
        ? "OpenAI-compatible provider 尚未配置 API key。请在管理员端填写后再生成。"
        : null;

  function toggleInputAsset(assetId: string) {
    props.setSelectedAssetIds((current) => {
      if (current.includes(assetId)) return current.filter((id) => id !== assetId);
      if (current.length >= maxEditInputs) return current;
      return [...current, assetId];
    });
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-h-0 overflow-y-auto px-4 py-5 md:px-7">
        {props.turns.length === 0 ? (
          <div className="grid min-h-[50vh] place-items-center text-center">
            <div>
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-white text-black">
                <ImageIcon size={26} />
              </div>
              <h2 className="text-3xl font-semibold">gpt-image-2</h2>
              <p className="mt-2 text-zinc-500">从一个提示词或参考图开始。</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-5">
            {props.turns.map((turn) => {
              const outputAssets = turn.outputAssetIds
                .map((id) => props.assetById.get(id))
                .filter((asset): asset is Asset => Boolean(asset));

              return (
                <article key={turn.id} className="rounded-lg border border-zinc-800 bg-[#181818] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400">{turn.type}</span>
                      <span className={statusClass(turn.status)}>{turn.status}</span>
                      <span className="text-xs text-zinc-500">{turn.providerModel}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      {turn.latencyMs ? `${Math.round(turn.latencyMs / 1000)}s` : null}
                      {turn.status === "FAILED" ? (
                        <button onClick={() => props.retryTurn(turn.id)} className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-200 hover:bg-zinc-800">
                          重试
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mb-4 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{turn.prompt}</p>
                  {turn.errorMessage ? <p className="mb-4 text-sm text-red-300">{turn.errorMessage}</p> : null}
                  {outputAssets.length ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {outputAssets.map((asset) => (
                        <ImageCard key={asset.id} asset={asset} continueEditing={props.continueEditing} selectable={false} />
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className="border-t border-zinc-900 bg-[#151515] p-4 lg:border-l lg:border-t-0">
        {providerWarning ? (
          <div className="mb-4 rounded-md border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-100">
            {providerWarning}
          </div>
        ) : null}

        <div className="mb-4 grid grid-cols-2 rounded-md bg-zinc-900 p-1 text-sm">
          <button
            onClick={() => props.setMode("generation")}
            className={`rounded px-3 py-2 ${props.mode === "generation" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
          >
            生成
          </button>
          <button
            onClick={() => props.setMode("edit")}
            className={`rounded px-3 py-2 ${props.mode === "edit" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
          >
            编辑
          </button>
        </div>

        <textarea
          value={props.prompt}
          onChange={(event) => props.setPrompt(event.target.value)}
          placeholder="有什么我能帮您画的吗？"
          className="min-h-32 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-white outline-none focus:border-zinc-400"
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="模型">
            <input
              value={props.model}
              onChange={(event) => props.setModel(event.target.value)}
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
            />
          </Field>
          <Field label="尺寸">
            <select
              value={props.size}
              onChange={(event) => props.setSize(event.target.value)}
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
            >
              {sizes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="质量">
            <select
              value={props.quality}
              onChange={(event) => props.setQuality(event.target.value as "auto" | "low" | "medium" | "high")}
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
            >
              {["auto", "low", "medium", "high"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="数量">
            <input
              type="number"
              min={1}
              max={4}
              value={props.count}
              onChange={(event) => props.setCount(Number(event.target.value))}
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
            />
          </Field>
        </div>

        {props.mode === "edit" ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-300">输入图片</span>
              <span className="text-xs text-zinc-500">{props.selectedAssetIds.length} 已选</span>
            </div>
            <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto">
              {props.assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => toggleInputAsset(asset.id)}
                  className={`overflow-hidden rounded-md border text-left ${
                    props.selectedAssetIds.includes(asset.id) ? "border-sky-400" : "border-zinc-800"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.url} alt="" className="aspect-square w-full object-cover" />
                  <div className="space-y-0.5 px-1.5 py-1">
                    <div className="truncate text-[11px] text-zinc-300">{asset.originalFilename ?? asset.kind}</div>
                    <div className="text-[10px] text-zinc-500">{formatBytes(asset.sizeBytes)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          onClick={props.openUploadPicker}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            void props.uploadFiles(event.dataTransfer.files);
          }}
          className={`mt-4 cursor-pointer rounded-lg border border-dashed p-3 transition ${
            dragActive ? "border-sky-400 bg-sky-950/30" : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-zinc-900 text-zinc-200">
              <Upload size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-100">Upload images</div>
              <div className="truncate text-xs text-zinc-500">Click, drop, or paste PNG, JPEG, WebP.</div>
            </div>
          </div>

          {props.uploadPreviews.length ? (
            <div className="mt-3 space-y-2" onClick={(event) => event.stopPropagation()}>
              {props.uploadPreviews.map((preview) => (
                <UploadPreviewRow key={preview.id} preview={preview} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={props.openUploadPicker}
            className="grid h-11 w-11 place-items-center rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            title="上传图片"
          >
            <Upload size={18} />
          </button>
          <button
            disabled={
              props.busy ||
              !providerReady ||
              !props.prompt.trim() ||
              (props.mode === "edit" && props.selectedAssetIds.length === 0)
            }
            onClick={props.submitTurn}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-black disabled:opacity-50"
          >
            {props.busy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            {providerReady ? (props.mode === "generation" ? "生成图片" : "编辑图片") : "先配置真实 Provider"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function UploadPreviewRow({ preview }: { preview: UploadPreview }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview.previewUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-zinc-200">{preview.name}</div>
        <div className="mt-0.5 text-[11px] text-zinc-500">{formatBytes(preview.size)}</div>
        {preview.error ? <div className="mt-1 truncate text-[11px] text-red-300">{preview.error}</div> : null}
      </div>
      <div className="shrink-0 text-zinc-400">
        {preview.status === "uploading" || preview.status === "queued" ? (
          <Loader2 className="animate-spin" size={16} />
        ) : preview.status === "done" ? (
          <CheckCircle2 className="text-emerald-300" size={16} />
        ) : (
          <AlertCircle className="text-red-300" size={16} />
        )}
      </div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500">{props.label}</span>
      {props.children}
    </label>
  );
}

function AssetPool(props: {
  assets: Asset[];
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  continueEditing: (asset: Asset) => void;
}) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7">
      <div className="mb-5 flex max-w-5xl items-center gap-3 rounded-lg border border-zinc-800 bg-[#181818] px-3 py-2">
        <Search size={18} className="text-zinc-500" />
        <span className="text-sm text-zinc-500">资产池展示当前会话的全部上传图、生成图和编辑结果。</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {props.assets.map((asset) => (
          <ImageCard
            key={asset.id}
            asset={asset}
            continueEditing={props.continueEditing}
            selectable
            selected={props.selectedAssetIds.includes(asset.id)}
            onSelect={() =>
              props.setSelectedAssetIds((current) =>
                current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id],
              )
            }
          />
        ))}
      </div>
    </section>
  );
}

function ImageCard(props: {
  asset: Asset;
  continueEditing: (asset: Asset) => void;
  selectable: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div className={`overflow-hidden rounded-lg border bg-zinc-950 ${props.selected ? "border-sky-400" : "border-zinc-800"}`}>
      <button onClick={props.onSelect} className="block w-full cursor-pointer text-left" disabled={!props.selectable}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.asset.url} alt="" className="aspect-square w-full object-cover" />
      </button>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-200">{props.asset.kind}</div>
          <div className="text-xs text-zinc-500">{formatBytes(props.asset.sizeBytes)}</div>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={props.asset.url}
            download
            className="grid h-8 w-8 place-items-center rounded-md text-zinc-300 hover:bg-zinc-800"
            title="下载"
          >
            <Download size={16} />
          </a>
          <button
            onClick={() => props.continueEditing(props.asset)}
            className="grid h-8 w-8 place-items-center rounded-md text-zinc-300 hover:bg-zinc-800"
            title="继续编辑"
          >
            <Edit3 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminView(props: {
  data: {
    analytics?: Analytics;
    tasks: AdminTask[];
    users: AdminUser[];
    auditLogs: AuditLog[];
    providerSettings?: ProviderSettings;
  };
  refreshAdmin: () => Promise<void>;
  request: <T>(url: string, init?: RequestInit) => Promise<T>;
  setMessage: (message: string | null) => void;
}) {
  const analytics = props.data.analytics;
  const recentTasks = analytics?.recentTasks.length ? analytics.recentTasks : props.data.tasks.slice(0, 10);

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7">
      <div className="mb-5 flex justify-end">
        <button
          onClick={props.refreshAdmin}
          className="flex items-center gap-2 rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          <RefreshCw size={16} />
          Refresh data
        </button>
      </div>
      {props.data.providerSettings ? (
        <ProviderSettingsForm
          key={[
            props.data.providerSettings.apiBaseUrl,
            props.data.providerSettings.provider,
            props.data.providerSettings.generationPath,
            props.data.providerSettings.editPath,
            props.data.providerSettings.defaultModel,
            props.data.providerSettings.defaultSize,
            props.data.providerSettings.apiKeyPreview,
          ].join("|")}
          settings={props.data.providerSettings}
          request={props.request}
          refreshAdmin={props.refreshAdmin}
          setMessage={props.setMessage}
        />
      ) : null}
      {analytics ? (
        <>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric label="Today tasks" value={analytics.metrics.todayTasks} />
            <Metric label="7-day tasks" value={analytics.metrics.sevenDayTasks} />
            <Metric label="7-day success" value={`${analytics.metrics.sevenDaySuccessRate}%`} />
            <Metric label="7-day failed" value={`${analytics.metrics.sevenDayFailedRate}%`} />
            <Metric label="Avg latency" value={formatDuration(analytics.metrics.sevenDayAverageLatencyMs)} />
            <Metric label="30-day users" value={analytics.metrics.activeUsers30d} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <ChartPanel title="30-day task trend">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={analytics.daily}>
                  <CartesianGrid stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
                  <Line type="monotone" dataKey="generation" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="edit" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="failed" stroke="#f87171" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
            <ChartPanel title="Model distribution">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics.models}>
                  <CartesianGrid stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
                  <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>
        </>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <TablePanel title="Recent tasks">
          {recentTasks.map((task) => (
            <Row
              key={task.id}
              left={task.prompt}
              right={`${task.status} / ${task.user?.email ?? "unknown"} / ${formatDuration(task.latencyMs ?? 0)}`}
            />
          ))}
        </TablePanel>
        <TablePanel title="User usage">
          {(analytics?.userUsage ?? []).map((user) => (
            <Row
              key={user.userId}
              left={user.email}
              right={`${user.tasks} tasks / ${user.succeeded} ok / ${user.failed} failed`}
            />
          ))}
        </TablePanel>
        <TablePanel title="Recent failures">
          {analytics?.failedTurns.map((turn) => (
            <Row
              key={turn.id}
              left={turn.prompt}
              right={`${turn.errorCode ?? "failed"} / ${turn.user?.email ?? "unknown"} / ${formatDuration(turn.latencyMs ?? 0)}`}
            />
          ))}
        </TablePanel>
        <TablePanel title="Audit logs">
          {props.data.auditLogs.slice(0, 8).map((log) => (
            <Row key={log.id} left={log.action} right={log.actor?.email ?? "system"} />
          ))}
        </TablePanel>
      </div>
    </section>
  );
}

function ProviderSettingsForm(props: {
  settings: ProviderSettings;
  request: <T>(url: string, init?: RequestInit) => Promise<T>;
  refreshAdmin: () => Promise<void>;
  setMessage: (message: string | null) => void;
}) {
  const [settingsForm, setSettingsForm] = useState({
    provider: props.settings.provider,
    apiBaseUrl: props.settings.apiBaseUrl,
    generationPath: props.settings.generationPath,
    editPath: props.settings.editPath,
    apiKey: "",
    clearApiKey: false,
    defaultModel: props.settings.defaultModel,
    defaultSize: props.settings.defaultSize,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  async function saveProviderSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    props.setMessage(null);

    try {
      await props.request<{ settings: ProviderSettings }>("/api/admin/provider-settings", {
        method: "PUT",
        body: JSON.stringify(settingsForm),
      });
      await props.refreshAdmin();
    } catch (error) {
      props.setMessage(error instanceof Error ? error.message : "Could not save provider settings");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <form onSubmit={saveProviderSettings} className="mb-5 rounded-lg border border-zinc-800 bg-[#181818] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Provider settings</h2>
          <p className="mt-1 text-xs text-zinc-500">
            API key is stored encrypted and only shown as {props.settings.apiKeyPreview ?? "not configured"}.
          </p>
        </div>
        <button
          disabled={savingSettings}
          className="flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-black disabled:opacity-60"
        >
          {savingSettings ? <Loader2 className="animate-spin" size={16} /> : <Settings2 size={16} />}
          Save
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Provider">
          <select
            value={settingsForm.provider}
            onChange={(event) =>
              setSettingsForm((current) => ({
                ...current,
                provider: event.target.value as ProviderSettings["provider"],
              }))
            }
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
          >
            <option value="openai-compatible">OpenAI-compatible</option>
            <option value="mock">Mock provider</option>
          </select>
        </Field>
        <Field label="Base URL">
          <input
            value={settingsForm.apiBaseUrl}
            onChange={(event) => setSettingsForm((current) => ({ ...current, apiBaseUrl: event.target.value }))}
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
            placeholder="https://api.example.com"
          />
        </Field>
        <Field label="Generation path">
          <input
            value={settingsForm.generationPath}
            onChange={(event) => setSettingsForm((current) => ({ ...current, generationPath: event.target.value }))}
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
            placeholder="/v1/images/generations"
          />
        </Field>
        <Field label="Edit path">
          <input
            value={settingsForm.editPath}
            onChange={(event) => setSettingsForm((current) => ({ ...current, editPath: event.target.value }))}
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
            placeholder="/v1/images/edits"
          />
        </Field>
        <Field label="Default model">
          <input
            value={settingsForm.defaultModel}
            onChange={(event) => setSettingsForm((current) => ({ ...current, defaultModel: event.target.value }))}
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
          />
        </Field>
        <Field label="Default size">
          <input
            value={settingsForm.defaultSize}
            onChange={(event) => setSettingsForm((current) => ({ ...current, defaultSize: event.target.value }))}
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
          />
        </Field>
        <Field label="API key">
          <input
            type="password"
            value={settingsForm.apiKey}
            onChange={(event) => setSettingsForm((current) => ({ ...current, apiKey: event.target.value }))}
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
            placeholder={props.settings.hasApiKey ? "Leave blank to keep current key" : "Not configured"}
          />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={settingsForm.clearApiKey}
          onChange={(event) => setSettingsForm((current) => ({ ...current, clearApiKey: event.target.checked }))}
        />
        Clear saved API key
      </label>
    </form>
  );
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#181818] p-4">
      <div className="text-xs text-zinc-500">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{props.value}</div>
    </div>
  );
}

function ChartPanel(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#181818] p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-300">{props.title}</h3>
      {props.children}
    </div>
  );
}

function TablePanel(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#181818] p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-300">{props.title}</h3>
      <div className="divide-y divide-zinc-800">{props.children}</div>
    </div>
  );
}

function Row(props: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 truncate text-zinc-300">{props.left}</span>
      <span className="shrink-0 text-xs text-zinc-500">{props.right}</span>
    </div>
  );
}

function statusClass(status: Turn["status"]) {
  const base = "rounded-md px-2 py-1 text-xs";
  if (status === "SUCCEEDED") return `${base} bg-emerald-950 text-emerald-300`;
  if (status === "FAILED") return `${base} bg-red-950 text-red-300`;
  if (status === "PROCESSING" || status === "QUEUED") return `${base} bg-sky-950 text-sky-300`;
  return `${base} bg-zinc-900 text-zinc-400`;
}

function formatDuration(ms: number) {
  if (!ms) return "0s";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
