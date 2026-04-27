export type ProviderImage = {
  b64Json?: string;
  url?: string;
  mimeType?: string;
  revisedPrompt?: string;
};

export type ImageParams = {
  model: string;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  background?: "transparent" | "opaque" | "auto";
  n?: number;
  seed?: number;
};

export type EditableImage = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

export type GenerateImageInput = {
  prompt: string;
  params: ImageParams;
  userId: string;
};

export type EditImageInput = GenerateImageInput & {
  images: EditableImage[];
  mask?: EditableImage;
};

export type ProviderResult = {
  requestId?: string;
  revisedPrompt?: string;
  images: ProviderImage[];
};

export interface ImageProvider {
  name: string;
  generate(input: GenerateImageInput): Promise<ProviderResult>;
  edit(input: EditImageInput): Promise<ProviderResult>;
}
