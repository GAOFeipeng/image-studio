import { AssetKind } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleError, HttpError, ok } from "@/lib/http";
import { applyImageParamDefaults } from "@/lib/settings";
import { runEdit, uploadSessionAsset } from "@/lib/services/image-workflow";
import { getWorkflowDefinition, normalizeWorkflowOptions } from "@/lib/workflows/server";
import type { WorkflowInputSlot, WorkflowRunOptions } from "@/lib/workflows/catalog";

type Params = { params: Promise<{ sessionId: string; workflowId: string }> };

export async function POST(request: Request, context: Params) {
  try {
    const user = await requireUser();
    const { sessionId, workflowId } = await context.params;
    const { app, definition } = getWorkflowDefinition(workflowId);
    const form = await request.formData();
    const notes = form.get("notes")?.toString().trim();
    const workflowOptions = normalizeWorkflowOptions(app.id, getWorkflowOptions(form));
    const inputFiles = getWorkflowInputFiles(form, app.inputSlots);

    const inputAssets = [];
    for (const file of inputFiles) {
      inputAssets.push(
        await uploadSessionAsset({
          user,
          sessionId,
          file,
          kind: AssetKind.INPUT,
        }),
      );
    }
    const prompt = definition.buildPrompt(notes, workflowOptions);
    const result = await runEdit({
      user,
      sessionId,
      prompt,
      params: await applyImageParamDefaults(
        {
          size: definition.size,
          quality: "auto",
          n: 1,
        },
        user,
      ),
      inputAssetIds: inputAssets.map((asset) => asset.id),
    });

    return ok({
      workflow: app,
      inputAsset: inputAssets[0],
      inputAssets,
      ...result,
    });
  } catch (error) {
    return handleError(error);
  }
}

function getWorkflowOptions(form: FormData): WorkflowRunOptions {
  const options: WorkflowRunOptions = {};

  for (const [key, value] of form.entries()) {
    if (key.startsWith("options.") && typeof value === "string") {
      options[key.slice("options.".length)] = value;
    }
  }

  const legacyReferenceMode = stringValue(form.get("referenceMode"));
  const legacyOutputType = stringValue(form.get("outputType"));
  if (legacyReferenceMode && !options.referenceMode) options.referenceMode = legacyReferenceMode;
  if (legacyOutputType && !options.outputType) options.outputType = legacyOutputType;

  return options;
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

function getWorkflowInputFiles(form: FormData, slots: WorkflowInputSlot[]) {
  const files: File[] = [];

  for (const [index, slot] of slots.entries()) {
    const slotFiles = form
      .getAll(`files.${slot.id}`)
      .filter((value): value is File => value instanceof File);
    const legacyFile = index === 0 && form.get("file") instanceof File ? [form.get("file") as File] : [];
    const selectedFiles = slotFiles.length ? slotFiles : legacyFile;

    if (selectedFiles.length < slot.minFiles) {
      return missingFile(slot.label);
    }
    if (selectedFiles.length > slot.maxFiles) {
      return tooManyFiles(slot.label, slot.maxFiles);
    }

    files.push(...selectedFiles);
  }

  return files;
}

function missingFile(label: string): never {
  throw new HttpError(400, `Missing ${label}`, "missing_file");
}

function tooManyFiles(label: string, maxFiles: number): never {
  throw new HttpError(400, `${label} supports up to ${maxFiles} image(s)`, "too_many_files");
}
