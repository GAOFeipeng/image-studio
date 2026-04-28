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
  Maximize2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
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
  params?: TurnParams | null;
  inputAssetIds?: string[] | null;
  maskAssetId?: string | null;
  providerModel: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  latencyMs?: number | null;
  outputAssetIds: string[];
  createdAt: string;
};

type TurnParams = {
  model?: string;
  size?: string;
  quality?: "auto" | "low" | "medium" | "high";
  background?: "transparent" | "opaque" | "auto";
  n?: number;
  seed?: number;
};

type PendingTurn = {
  id: string;
  sessionId: string;
  type: Turn["type"];
  prompt: string;
  providerModel: string;
  startedAt: number;
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
  defaultQuality: "auto" | "low" | "medium" | "high";
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  source?: "global" | "user";
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
type SizePreset = {
  ratio: string;
  label: string;
  size: string;
  useCase: string;
};

const sizePresets: SizePreset[] = [
  { ratio: "1:1", label: "Square", size: "1024x1024", useCase: "头像、商品图、社媒方图" },
  { ratio: "9:16", label: "Vertical", size: "1152x2048", useCase: "短视频、故事、手机壁纸" },
  { ratio: "16:9", label: "Widescreen", size: "2048x1152", useCase: "横幅、封面、演示大图" },
  { ratio: "4:3", label: "Landscape", size: "1536x1152", useCase: "文章配图、演示页、场景图" },
  { ratio: "3:4", label: "Portrait", size: "1152x1536", useCase: "人物海报、商品详情、竖版构图" },
  { ratio: "2:3", label: "Tall", size: "1024x1536", useCase: "海报、人物、竖版插画" },
  { ratio: "3:2", label: "Wide", size: "1536x1024", useCase: "封面、产品场景、宽幅构图" },
];
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
  const [view, setView] = useState<"studio" | "assets" | "settings" | "admin">("studio");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [size, setSize] = useState(sizePresets[0].size);
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
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
  const [retryingTurnIds, setRetryingTurnIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedSessionIdRef = useRef<string | null>(null);
  const retryingTurnIdsRef = useRef<Set<string>>(new Set());
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
    selectedSessionIdRef.current = selectedSessionId;
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
  }, [selectedSessionId]);

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

    if (selectedSessionIdRef.current !== sessionId) {
      return;
    }

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
  }

  async function refreshProviderDefaults() {
    const data = await request<{ settings: ProviderSettings }>("/api/provider-settings");
    setProviderSettings(data.settings);
    setModel(data.settings.defaultModel);
    setSize(data.settings.defaultSize);
    setQuality(data.settings.defaultQuality);
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
    setSelectedAssetIds([]);
    setPendingTurn(null);
  }

  async function createNewSession() {
    const title = window.prompt("创作标题", "新创作")?.trim() || "新创作";
    const data = await request<{ session: Session }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    setSessions((current) => [data.session, ...current]);
    setSelectedSessionId(data.session.id);
    setSelectedAssetIds([]);
    setView("studio");
  }

  async function deleteSession(session: Session) {
    const confirmed = window.confirm(`删除会话「${session.title}」？会话内的任务和图片资产也会被删除。`);
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);

    try {
      await request<{ ok: true }>(`/api/sessions/${session.id}`, { method: "DELETE" });
      const remaining = sessions.filter((item) => item.id !== session.id);

      if (remaining.length === 0) {
        const created = await request<{ session: Session }>("/api/sessions", {
          method: "POST",
          body: JSON.stringify({ title: "新创作" }),
        });
        setSessions([created.session]);
        setSelectedSessionId(created.session.id);
        setAssets([]);
        setTurns([]);
      } else {
        setSessions(remaining);
        if (selectedSessionId === session.id) {
          setSelectedSessionId(remaining[0].id);
          setAssets([]);
          setTurns([]);
        }
      }

      setSelectedAssetIds([]);
      setPendingTurn((current) => (current?.sessionId === session.id ? null : current));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除会话失败");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | File[] | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length || !selectedSessionId) return;

    const imageFiles = selectedFiles.filter((file) => acceptedUploadTypes.has(file.type));
    const rejectedCount = selectedFiles.length - imageFiles.length;
    if (rejectedCount > 0) {
      setMessage("仅支持 PNG、JPEG 和 WebP 图片。");
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
        form.set("kind", "INPUT");
        try {
          const data = await request<{ asset: Asset }>(`/api/sessions/${selectedSessionId}/assets/upload`, {
            method: "POST",
            body: form,
          });
          setAssets((current) => [data.asset, ...current]);
          setSelectedAssetIds((current) => Array.from(new Set([data.asset.id, ...current])).slice(0, maxEditInputs));
          setUploadPreviews((current) =>
            current.map((preview) => (preview.id === previewId ? { ...preview, status: "done" } : preview)),
          );
        } catch (error) {
          const uploadError = error instanceof Error ? error.message : "上传失败";
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
    const sessionId = selectedSessionId;
    const promptText = prompt;
    if (!sessionId || !promptText.trim()) return;
    if (providerSettings?.provider !== "openai-compatible" || !providerSettings.hasApiKey) {
      setMessage("请先在个人设置里配置自己的 OpenAI-compatible Provider 和 API key。");
      return;
    }

    const inputAssetIds = selectedAssetIds.slice(0, maxEditInputs);
    const hasInputImages = inputAssetIds.length > 0;
    const pending: PendingTurn = {
      id: `pending-${crypto.randomUUID()}`,
      sessionId,
      type: hasInputImages ? "EDIT" : "GENERATION",
      prompt: promptText,
      providerModel: model,
      startedAt: Date.now(),
    };

    setPendingTurn(pending);
    setBusy(true);
    setMessage(null);

    try {
      const endpoint =
        hasInputImages
          ? `/api/sessions/${sessionId}/turns/edit`
          : `/api/sessions/${sessionId}/turns/generation`;
      const body =
        hasInputImages
          ? { prompt: promptText, params: { model, size, quality, n: count }, inputAssetIds }
          : { prompt: promptText, params: { model, size, quality, n: count } };

      const data = await request<{ turn: Turn; assets: Asset[] }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (selectedSessionIdRef.current === sessionId) {
        setTurns((current) => [...current, data.turn]);
        setAssets((current) => [...data.assets, ...current]);
      }
      setPrompt((current) => (current === promptText ? "" : current));
      await refreshSessions();
      if (user?.role === "ADMIN") await refreshAdmin();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image task failed");
      if (selectedSessionIdRef.current === sessionId) await refreshSessionData(sessionId);
    } finally {
      setPendingTurn((current) => (current?.id === pending.id ? null : current));
      setBusy(false);
    }
  }

  async function retryTurn(turn: Turn) {
    const sessionId = selectedSessionId;
    if (!sessionId || retryingTurnIdsRef.current.has(turn.id)) return;
    if (providerSettings?.provider !== "openai-compatible" || !providerSettings.hasApiKey) {
      setMessage("请先在个人设置里配置自己的 OpenAI-compatible Provider 和 API key。");
      return;
    }

    retryingTurnIdsRef.current.add(turn.id);
    setRetryingTurnIds(new Set(retryingTurnIdsRef.current));
    setBusy(true);
    setMessage(null);
    setTurns((current) => current.filter((item) => item.id !== turn.id));

    const params: TurnParams = {
      model: turn.params?.model ?? model,
      size: turn.params?.size ?? size,
      quality: turn.params?.quality ?? quality,
      n: turn.params?.n ?? count,
    };
    if (turn.params?.background) params.background = turn.params.background;
    if (turn.params?.seed !== undefined) params.seed = turn.params.seed;

    const inputAssetIds = (turn.inputAssetIds ?? []).slice(0, maxEditInputs);
    const hasInputImages = turn.type === "EDIT" && inputAssetIds.length > 0;
    const pending: PendingTurn = {
      id: `pending-${crypto.randomUUID()}`,
      sessionId,
      type: hasInputImages ? "EDIT" : "GENERATION",
      prompt: turn.prompt,
      providerModel: params.model ?? model,
      startedAt: Date.now(),
    };

    setPendingTurn(pending);

    try {
      await request<{ ok: true }>(`/api/turns/${turn.id}`, { method: "DELETE" });
      const endpoint =
        hasInputImages
          ? `/api/sessions/${sessionId}/turns/edit`
          : `/api/sessions/${sessionId}/turns/generation`;
      const body =
        hasInputImages
          ? { prompt: turn.prompt, params, inputAssetIds, maskAssetId: turn.maskAssetId }
          : { prompt: turn.prompt, params };
      const data = await request<{ turn: Turn; assets: Asset[] }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (selectedSessionIdRef.current === sessionId) {
        setTurns((current) => [...current.filter((item) => item.id !== turn.id), data.turn]);
        setAssets((current) => [...data.assets, ...current]);
      }
      await refreshSessions();
      if (user?.role === "ADMIN") await refreshAdmin();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重新创作失败");
      if (selectedSessionIdRef.current === sessionId) await refreshSessionData(sessionId);
    } finally {
      retryingTurnIdsRef.current.delete(turn.id);
      setRetryingTurnIds(new Set(retryingTurnIdsRef.current));
      setPendingTurn((current) => (current?.id === pending.id ? null : current));
      setBusy(false);
    }
  }

  function continueEditing(asset: Asset) {
    setView("studio");
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
                {requiresBootstrap ? "当前没有用户，请先注册管理员账号。" : "图像创作与多轮工作台"}
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
          <SidebarButton active={view === "settings"} icon={<Settings2 size={19} />} label="个人设置" onClick={() => setView("settings")} />
          {user.role === "ADMIN" ? (
            <SidebarButton active={view === "admin"} icon={<BarChart3 size={19} />} label="管理员" onClick={() => setView("admin")} />
          ) : null}
        </nav>

        <div className="px-5 pb-2 pt-5 text-xs uppercase tracking-wide text-zinc-500">会话</div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-1 rounded-md ${
                selectedSessionId === session.id ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              <button
                onClick={() => {
                  if (session.id !== selectedSessionId) setSelectedAssetIds([]);
                  setSelectedSessionId(session.id);
                  setView("studio");
                }}
                className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
              >
                <div className="truncate font-medium">{session.title}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {session._count?.turns ?? 0} 轮 / {session._count?.assets ?? 0} 图
                </div>
              </button>
              <button
                type="button"
                onClick={() => deleteSession(session)}
                disabled={busy}
                className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-500 opacity-100 hover:bg-zinc-800 hover:text-red-300 disabled:opacity-40 md:opacity-0 md:transition md:group-hover:opacity-100"
                title="删除会话"
              >
                <Trash2 size={15} />
              </button>
            </div>
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
              {view === "studio"
                ? selectedSession?.title ?? "工作台"
                : view === "assets"
                  ? "资产池"
                  : view === "settings"
                    ? "个人设置"
                    : "管理员控制台"}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {view === "studio"
                ? "提示词、输入图和资产复用"
                : view === "assets"
                  ? "上传图和创作结果集中管理"
                  : view === "settings"
                    ? "配置自己的图像供应商和 API key"
                    : "使用情况、任务健康和审计"}
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
            <button
              onClick={() => setView("settings")}
              className="grid h-9 w-9 place-items-center rounded-md text-zinc-300 hover:bg-zinc-800"
              title="个人设置"
            >
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
            pendingTurn={pendingTurn?.sessionId === selectedSessionId ? pendingTurn : null}
            assetById={assetById}
            prompt={prompt}
            setPrompt={setPrompt}
            model={model}
            size={size}
            setSize={setSize}
            count={count}
            setCount={setCount}
            selectedAssetIds={selectedAssetIds}
            setSelectedAssetIds={setSelectedAssetIds}
            submitTurn={submitTurn}
            retryTurn={retryTurn}
            retryingTurnIds={retryingTurnIds}
            continueEditing={continueEditing}
            openUploadPicker={openUploadPicker}
            uploadFiles={uploadFiles}
            providerSettings={providerSettings}
            busy={busy}
          />
        ) : null}

        {view === "assets" ? (
          <AssetPool
            assets={assets}
            selectedAssetIds={selectedAssetIds}
            setSelectedAssetIds={setSelectedAssetIds}
            continueEditing={continueEditing}
          />
        ) : null}

        {view === "settings" ? (
          <SettingsView
            providerSettings={providerSettings}
            request={request}
            setMessage={setMessage}
            onProviderSettingsSaved={(settings) => {
              setProviderSettings(settings);
              setModel(settings.defaultModel);
              setSize(settings.defaultSize);
              setQuality(settings.defaultQuality);
            }}
          />
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
  pendingTurn: PendingTurn | null;
  assetById: Map<string, Asset>;
  prompt: string;
  setPrompt: (value: string) => void;
  model: string;
  size: string;
  setSize: (value: string) => void;
  count: number;
  setCount: (value: number) => void;
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  submitTurn: () => Promise<void>;
  retryTurn: (turn: Turn) => Promise<void>;
  retryingTurnIds: Set<string>;
  continueEditing: (asset: Asset) => void;
  openUploadPicker: () => void;
  uploadFiles: (files: FileList | File[] | null) => Promise<void>;
  providerSettings: ProviderSettings | null;
  busy: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [openPicker, setOpenPicker] = useState<"size" | "count" | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const messagesScrollRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const providerReady = props.providerSettings?.provider === "openai-compatible" && props.providerSettings.hasApiKey;
  const providerWarning = !props.providerSettings
    ? "正在读取图像供应商配置。"
    : props.providerSettings.provider === "mock"
      ? "当前是 mock provider，不会调用真实文生图接口。请在个人设置里切换到 OpenAI-compatible。"
      : !props.providerSettings.hasApiKey
        ? "OpenAI-compatible provider 尚未配置个人 API key。请在个人设置里填写后再创作。"
        : null;
  const hasMessages = props.turns.length > 0 || Boolean(props.pendingTurn);
  const pendingTurnId = props.pendingTurn?.id ?? null;
  const pendingStartedAt = props.pendingTurn?.startedAt ?? null;
  const selectedSizePreset = sizePresets.find((preset) => preset.size === props.size);
  const selectedAssets = props.selectedAssetIds
    .map((id) => props.assetById.get(id))
    .filter((asset): asset is Asset => Boolean(asset));
  const sizePillRatio = selectedSizePreset?.ratio ?? "Size";
  const sizePillDetail = selectedSizePreset?.size ?? props.size;
  const turnVersion = useMemo(
    () =>
      props.turns
        .map((turn) => `${turn.id}:${turn.status}:${turn.outputAssetIds.length}:${turn.latencyMs ?? ""}`)
        .join("|"),
    [props.turns],
  );

  useEffect(() => {
    if (!pendingStartedAt) return;

    const intervalId = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [pendingStartedAt]);

  useEffect(() => {
    if (!hasMessages) return;
    if (!pendingTurnId && !shouldAutoScrollRef.current) return;
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [hasMessages, pendingTurnId, turnVersion]);

  function handleMessagesScroll() {
    const element = messagesScrollRef.current;
    if (!element) return;

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 180;
  }

  function toggleInputAsset(assetId: string) {
    props.setSelectedAssetIds((current) => {
      if (current.includes(assetId)) return current.filter((id) => id !== assetId);
      if (current.length >= maxEditInputs) return current;
      return [...current, assetId];
    });
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section
          ref={messagesScrollRef}
          onScroll={handleMessagesScroll}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7"
        >
          {!hasMessages ? (
            <div className="grid min-h-[50vh] place-items-center text-center">
              <div>
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-white text-black">
                  <ImageIcon size={26} />
                </div>
                <h2 className="text-3xl font-semibold">gpt-image-2</h2>
                <p className="mt-2 text-zinc-500">输入提示词，或先添加图片。</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl space-y-5">
              {props.turns.map((turn) => {
                const isRetrying = props.retryingTurnIds.has(turn.id);
                const outputAssets = turn.outputAssetIds
                  .map((id) => props.assetById.get(id))
                  .filter((asset): asset is Asset => Boolean(asset));

                return (
                  <article key={turn.id} className="rounded-lg border border-zinc-800 bg-[#181818] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
                          {turn.type === "EDIT" ? "含输入图" : "纯文本"}
                        </span>
                        <span className={statusClass(turn.status)}>{turn.status}</span>
                        <span className="text-xs text-zinc-500">{turn.providerModel}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        {turn.latencyMs ? `${Math.round(turn.latencyMs / 1000)}s` : null}
                        {turn.status === "FAILED" ? (
                          <button
                            disabled={isRetrying || props.busy}
                            onClick={() => props.retryTurn(turn)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2 py-1 text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isRetrying ? <Loader2 className="animate-spin" size={12} /> : null}
                            {isRetrying ? "重试中" : "重试"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <p className="mb-4 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{turn.prompt}</p>
                    {turn.errorMessage ? <p className="mb-4 text-sm text-red-300">{turn.errorMessage}</p> : null}
                    {outputAssets.length ? (
                      <div className={outputAssets.length === 1 ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
                        {outputAssets.map((asset) => (
                          <ResultImageCard
                            key={asset.id}
                            asset={asset}
                            continueEditing={props.continueEditing}
                            onPreview={setPreviewAsset}
                          />
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {props.pendingTurn ? (
                <PendingTurnCard turn={props.pendingTurn} elapsedMs={Math.max(0, timerNow - props.pendingTurn.startedAt)} />
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        <aside className="shrink-0 border-t border-zinc-900 bg-[#151515]/95 px-3 py-3 backdrop-blur md:px-7">
          <div className="mx-auto flex max-w-5xl flex-col">
            {providerWarning ? (
              <div className="mb-3 rounded-md border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-100">
                {providerWarning}
              </div>
            ) : null}

            <div
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
              className={`order-2 rounded-lg border bg-zinc-950 transition ${
                dragActive ? "border-sky-400 ring-2 ring-sky-500/20" : "border-zinc-700"
              }`}
            >
              {selectedAssets.length ? (
                <div className="flex gap-2 overflow-x-auto border-b border-zinc-800 px-3 py-2">
                  {selectedAssets.map((asset) => (
                    <div key={asset.id} className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-black/30">
                      <button
                        type="button"
                        onClick={() => setPreviewAsset(asset)}
                        className="block h-full w-full"
                        title="预览输入图"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt="" className="h-full w-full object-cover" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleInputAsset(asset.id)}
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded bg-black/75 text-white opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100"
                        title="移除输入图"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <textarea
                value={props.prompt}
                onChange={(event) => props.setPrompt(event.target.value)}
                placeholder="有什么我能帮您画的吗？"
                className="min-h-24 max-h-40 w-full resize-none border-0 bg-transparent p-3 text-sm text-white outline-none placeholder:text-zinc-500 md:min-h-28"
              />

              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 px-3 py-2">
                <button
                  type="button"
                  onClick={props.openUploadPicker}
                  className="grid h-9 w-9 place-items-center rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                  title="上传图片"
                >
                  <Upload size={17} />
                </button>
                {openPicker ? (
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="关闭选择器"
                    onClick={() => setOpenPicker(null)}
                  />
                ) : null}
                <div className="relative z-20">
                  <button
                    type="button"
                    onClick={() => setOpenPicker((current) => (current === "size" ? null : "size"))}
                    className="h-9 rounded-md border border-zinc-700 px-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    title={`尺寸预设：${sizePillDetail}`}
                    aria-expanded={openPicker === "size"}
                    aria-haspopup="menu"
                  >
                    {sizePillRatio}
                  </button>
                  {openPicker === "size" ? (
                    <div className="absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 p-1 shadow-2xl">
                      {sizePresets.map((preset) => (
                        <button
                          key={preset.size}
                          type="button"
                          onClick={() => {
                            props.setSize(preset.size);
                            setOpenPicker(null);
                          }}
                          className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${
                            props.size === preset.size ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-900"
                          }`}
                        >
                          <span className="font-medium">{preset.ratio}</span>
                          <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">{preset.label}</span>
                          <span className="text-[11px] text-zinc-500">{preset.size}</span>
                        </button>
                      ))}
                      {!selectedSizePreset ? (
                        <button
                          type="button"
                          onClick={() => setOpenPicker(null)}
                          className="flex w-full items-center justify-between gap-3 rounded-md bg-zinc-800 px-3 py-2 text-left text-sm text-white"
                        >
                          <span className="font-medium">{sizePillRatio}</span>
                          <span className="text-[11px] text-zinc-500">{props.size}</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="relative z-20">
                  <button
                    type="button"
                    onClick={() => setOpenPicker((current) => (current === "count" ? null : "count"))}
                    className="h-9 rounded-md border border-zinc-700 px-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    title="生成数量"
                    aria-expanded={openPicker === "count"}
                    aria-haspopup="menu"
                  >
                    {props.count} 张
                  </button>
                  {openPicker === "count" ? (
                    <div className="absolute bottom-full left-0 z-20 mb-2 w-24 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 p-1 shadow-2xl">
                      {[1, 2, 3, 4].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            props.setCount(item);
                            setOpenPicker(null);
                          }}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                            props.count === item ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-900"
                          }`}
                        >
                          {item} 张
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  disabled={props.busy || !providerReady || !props.prompt.trim()}
                  onClick={props.submitTurn}
                  className="ml-auto flex h-9 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-black disabled:opacity-50"
                >
                  {props.busy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  {providerReady ? "开始创作" : "先配置 Provider"}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
      {previewAsset ? <ImagePreviewOverlay asset={previewAsset} onClose={() => setPreviewAsset(null)} /> : null}
    </>
  );
}

function PendingTurnCard(props: { turn: PendingTurn; elapsedMs: number }) {
  const modeLabel = props.turn.type === "EDIT" ? "含输入图" : "纯文本";

  return (
    <article
      className="rounded-lg border border-sky-900/70 bg-[#181818] p-4 shadow-[0_0_0_1px_rgba(14,165,233,0.08)]"
      aria-live="polite"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400">{modeLabel}</span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-950 px-2 py-1 text-xs text-sky-300">
            <Loader2 className="animate-spin" size={13} />
            创作中
          </span>
          <span className="text-xs text-zinc-500">{props.turn.providerModel}</span>
        </div>
        <div className="text-xs text-zinc-400">已耗时 {formatDuration(props.elapsedMs)}</div>
      </div>
      <p className="mb-4 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{props.turn.prompt}</p>
      <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-400">
        <Loader2 className="shrink-0 animate-spin text-sky-300" size={16} />
        <span>创作中，结果完成后会显示在这里。</span>
      </div>
    </article>
  );
}

function ResultImageCard(props: {
  asset: Asset;
  continueEditing: (asset: Asset) => void;
  onPreview: (asset: Asset) => void;
}) {
  const label = props.asset.originalFilename ?? props.asset.kind;

  return (
    <div className="w-fit max-w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <button
        type="button"
        onClick={() => props.onPreview(props.asset)}
        className="group relative flex max-w-full items-center justify-center bg-zinc-950 text-left"
        aria-label="Preview result image"
        title="Preview image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.asset.url} alt={label} className="block max-h-[min(64vh,760px)] max-w-full object-contain" />
        <span className="pointer-events-none absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md bg-black/70 text-zinc-100 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 size={16} />
        </span>
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
            title="Download"
          >
            <Download size={16} />
          </a>
          <button
            type="button"
            onClick={() => props.continueEditing(props.asset)}
            className="grid h-8 w-8 place-items-center rounded-md text-zinc-300 hover:bg-zinc-800"
            title="作为输入图继续创作"
          >
            <Edit3 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ImagePreviewOverlay(props: { asset: Asset; onClose: () => void }) {
  const label = props.asset.originalFilename ?? props.asset.kind;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <a
          href={props.asset.url}
          download
          onClick={(event) => event.stopPropagation()}
          className="grid h-10 w-10 place-items-center rounded-md border border-white/15 bg-black/60 text-zinc-100 hover:bg-zinc-900"
          title="Download"
        >
          <Download size={18} />
        </a>
        <button
          type="button"
          onClick={props.onClose}
          className="grid h-10 w-10 place-items-center rounded-md border border-white/15 bg-black/60 text-zinc-100 hover:bg-zinc-900"
          aria-label="Close image preview"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>
      <button
        type="button"
        onClick={props.onClose}
        className="flex max-h-full max-w-full cursor-zoom-out items-center justify-center"
        aria-label="Close image preview"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.asset.url}
          alt={label}
          className="max-h-[calc(100vh-5rem)] max-w-[calc(100vw-2rem)] rounded-md object-contain shadow-2xl"
        />
      </button>
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
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  return (
    <>
      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7">
        <div className="mb-5 flex max-w-5xl items-center gap-3 rounded-lg border border-zinc-800 bg-[#181818] px-3 py-2">
          <Search size={18} className="text-zinc-500" />
          <span className="text-sm text-zinc-500">资产池展示当前会话的全部上传图和创作结果。</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {props.assets.map((asset) => (
            <ImageCard
              key={asset.id}
              asset={asset}
              continueEditing={props.continueEditing}
              selectable
              selected={props.selectedAssetIds.includes(asset.id)}
              onPreview={setPreviewAsset}
              onSelect={() =>
                props.setSelectedAssetIds((current) =>
                  current.includes(asset.id)
                    ? current.filter((id) => id !== asset.id)
                    : current.length >= maxEditInputs
                      ? current
                      : [...current, asset.id],
                )
              }
            />
          ))}
        </div>
      </section>
      {previewAsset ? <ImagePreviewOverlay asset={previewAsset} onClose={() => setPreviewAsset(null)} /> : null}
    </>
  );
}

function ImageCard(props: {
  asset: Asset;
  continueEditing: (asset: Asset) => void;
  selectable: boolean;
  selected?: boolean;
  onPreview?: (asset: Asset) => void;
  onSelect?: () => void;
}) {
  return (
    <div className={`overflow-hidden rounded-lg border bg-zinc-950 ${props.selected ? "border-sky-400" : "border-zinc-800"}`}>
      <button
        type="button"
        onClick={() => props.onPreview?.(props.asset)}
        className="group relative flex aspect-square w-full cursor-zoom-in items-center justify-center bg-black/30 p-2 text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.asset.url} alt="" className="h-full w-full object-contain" />
        <span className="pointer-events-none absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md bg-black/70 text-zinc-100 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 size={16} />
        </span>
      </button>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-200">{props.asset.kind}</div>
          <div className="text-xs text-zinc-500">{formatBytes(props.asset.sizeBytes)}</div>
        </div>
        <div className="flex items-center gap-1">
          {props.selectable ? (
            <button
              type="button"
              onClick={props.onSelect}
              className={`grid h-8 w-8 place-items-center rounded-md ${
                props.selected ? "bg-sky-500 text-white" : "text-zinc-300 hover:bg-zinc-800"
              }`}
              title={props.selected ? "取消输入图" : "作为输入图"}
            >
              <CheckCircle2 size={16} />
            </button>
          ) : null}
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
            title="作为输入图继续创作"
          >
            <Edit3 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsView(props: {
  providerSettings: ProviderSettings | null;
  request: <T>(url: string, init?: RequestInit) => Promise<T>;
  setMessage: (message: string | null) => void;
  onProviderSettingsSaved: (settings: ProviderSettings) => void;
}) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7">
      <div className="mx-auto max-w-5xl">
        {props.providerSettings ? (
          <ProviderSettingsForm
            key={[
              "user",
              props.providerSettings.apiBaseUrl,
              props.providerSettings.provider,
              props.providerSettings.generationPath,
              props.providerSettings.editPath,
              props.providerSettings.defaultModel,
              props.providerSettings.defaultSize,
              props.providerSettings.defaultQuality,
              props.providerSettings.apiKeyPreview,
            ].join("|")}
            title="个人 Provider"
            description={`每个用户独立保存自己的 API key。当前 key：${props.providerSettings.apiKeyPreview ?? "未配置"}。`}
            endpoint="/api/provider-settings"
            settings={props.providerSettings}
            request={props.request}
            onSaved={props.onProviderSettingsSaved}
            setMessage={props.setMessage}
          />
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-[#181818] p-4 text-sm text-zinc-400">
            正在读取个人 Provider 配置。
          </div>
        )}
      </div>
    </section>
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
            "admin",
            props.data.providerSettings.apiBaseUrl,
            props.data.providerSettings.provider,
            props.data.providerSettings.generationPath,
            props.data.providerSettings.editPath,
            props.data.providerSettings.defaultModel,
            props.data.providerSettings.defaultSize,
            props.data.providerSettings.defaultQuality,
            props.data.providerSettings.apiKeyPreview,
          ].join("|")}
          title="全局 Provider 默认值"
          description={`这里配置站点默认参数。用户出图仍使用个人 API key；全局 key 当前为 ${
            props.data.providerSettings.apiKeyPreview ?? "未配置"
          }。`}
          endpoint="/api/admin/provider-settings"
          settings={props.data.providerSettings}
          request={props.request}
          onSaved={async () => {
            await props.refreshAdmin();
          }}
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
  title: string;
  description: string;
  endpoint: string;
  settings: ProviderSettings;
  request: <T>(url: string, init?: RequestInit) => Promise<T>;
  onSaved: (settings: ProviderSettings) => Promise<void> | void;
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
    defaultQuality: props.settings.defaultQuality,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  async function saveProviderSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    props.setMessage(null);

    try {
      const data = await props.request<{ settings: ProviderSettings }>(props.endpoint, {
        method: "PUT",
        body: JSON.stringify(settingsForm),
      });
      await props.onSaved(data.settings);
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
          <h2 className="text-sm font-medium text-zinc-200">{props.title}</h2>
          <p className="mt-1 text-xs text-zinc-500">{props.description}</p>
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
        <Field label="Default quality">
          <select
            value={settingsForm.defaultQuality}
            onChange={(event) =>
              setSettingsForm((current) => ({
                ...current,
                defaultQuality: event.target.value as ProviderSettings["defaultQuality"],
              }))
            }
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none"
          >
            {["auto", "low", "medium", "high"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
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
