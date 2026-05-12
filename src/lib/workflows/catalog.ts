export type WorkflowId =
  | "outfit-grid"
  | "hairstyle-grid"
  | "ecommerce-product"
  | "campaign-poster"
  | "brand-key-visual"
  | "social-cover"
  | "product-scene"
  | "detail-page-hero";

export type WorkflowInputSlot = {
  id: string;
  label: string;
  description: string;
  minFiles: number;
  maxFiles: number;
};

export type WorkflowOptionChoice = {
  id: string;
  label: string;
  description: string;
};

export type WorkflowOptionGroup = {
  id: string;
  label: string;
  choices: WorkflowOptionChoice[];
  defaultChoiceId?: string;
};

export type WorkflowRunOptions = Record<string, string | undefined>;

export type WorkflowApp = {
  id: WorkflowId;
  name: string;
  category: string;
  summary: string;
  inputLabel: string;
  inputSlots: WorkflowInputSlot[];
  optionGroups?: WorkflowOptionGroup[];
  outputLabel: string;
  notesPlaceholder: string;
  runLabel: string;
};

const personPhotoSlot: WorkflowInputSlot = {
  id: "subject",
  label: "人物照片",
  description: "上传或粘贴 1 张清晰人物图",
  minFiles: 1,
  maxFiles: 1,
};

const styleReferenceSlot: WorkflowInputSlot = {
  id: "styleReference",
  label: "参考图",
  description: "可选：粘贴目标风格、构图、版式或场景参考",
  minFiles: 0,
  maxFiles: 1,
};

const productSlot: WorkflowInputSlot = {
  id: "product",
  label: "产品图",
  description: "上传或粘贴 1-2 张自己的产品图",
  minFiles: 1,
  maxFiles: 2,
};

const marketingAssetSlot: WorkflowInputSlot = {
  id: "marketingAsset",
  label: "产品/品牌素材",
  description: "上传或粘贴 1-2 张产品、Logo、人物或品牌素材",
  minFiles: 1,
  maxFiles: 2,
};

const subjectAssetSlot: WorkflowInputSlot = {
  id: "subjectAsset",
  label: "主题素材",
  description: "上传或粘贴 1-2 张人物、产品、场景或主题图",
  minFiles: 1,
  maxFiles: 2,
};

export const ecommerceReferenceModes: WorkflowOptionChoice[] = [
  {
    id: "smart",
    label: "智能匹配",
    description: "判断参考图该借鉴版式、风格、场景还是构图",
  },
  {
    id: "layout",
    label: "复刻版式",
    description: "借鉴标题、卖点、CTA、信息区和产品位置",
  },
  {
    id: "photoStyle",
    label: "摄影风格",
    description: "只借鉴光影、色调、质感和商业摄影氛围",
  },
  {
    id: "scene",
    label: "场景道具",
    description: "借鉴背景、桌面、道具、手部和使用环境",
  },
  {
    id: "composition",
    label: "构图机位",
    description: "借鉴产品角度、画面比例、远近和留白",
  },
];

export const ecommerceOutputTypes: WorkflowOptionChoice[] = [
  {
    id: "hero",
    label: "商品主图",
    description: "突出单个商品，适合列表、首图和投放素材",
  },
  {
    id: "lifestyle",
    label: "场景图",
    description: "让商品自然进入使用场景，偏真实生活方式",
  },
  {
    id: "poster",
    label: "广告海报",
    description: "带清晰层级、卖点区域和电商广告感",
  },
  {
    id: "detailLead",
    label: "详情页首屏",
    description: "适合商品详情页开头，信息更丰富但不过密",
  },
];

export const workflowApps: WorkflowApp[] = [
  {
    id: "outfit-grid",
    name: "换衣服九宫格",
    category: "形象",
    summary: "上传一张人物图，输出一张 3x3 穿搭方案图。",
    inputLabel: "人物照片",
    inputSlots: [personPhotoSlot],
    outputLabel: "9 套不同穿搭",
    notesPlaceholder: "可选：通勤、约会、户外、轻奢、街头等偏好",
    runLabel: "生成穿搭",
  },
  {
    id: "hairstyle-grid",
    name: "换发型九宫格",
    category: "形象",
    summary: "上传一张人物图，输出一张 3x3 发型方案图。",
    inputLabel: "人物照片",
    inputSlots: [personPhotoSlot],
    outputLabel: "9 款不同发型",
    notesPlaceholder: "可选：短发、卷发、刘海、商务、少年感等偏好",
    runLabel: "生成发型",
  },
  {
    id: "ecommerce-product",
    name: "电商商品图",
    category: "商业",
    summary: "上传 1 张参考图，再上传 1-2 张产品图，输出一张可用的电商主图。",
    inputLabel: "参考图 + 产品图",
    inputSlots: [
      {
        ...styleReferenceSlot,
        label: "风格布局参考图",
        description: "粘贴目标风格、构图、版式或场景参考",
        minFiles: 1,
      },
      productSlot,
    ],
    optionGroups: [
      {
        id: "referenceMode",
        label: "参考方式",
        defaultChoiceId: "smart",
        choices: ecommerceReferenceModes,
      },
      {
        id: "outputType",
        label: "输出类型",
        defaultChoiceId: "hero",
        choices: ecommerceOutputTypes,
      },
    ],
    outputLabel: "1 张电商成片",
    notesPlaceholder: "可选：平台尺寸、目标人群、促销氛围、材质质感、背景要求",
    runLabel: "生成商品图",
  },
  {
    id: "campaign-poster",
    name: "活动海报",
    category: "营销",
    summary: "上传产品或品牌素材，生成新品、促销、节日或直播短文案海报。",
    inputLabel: "产品/品牌素材 + 可选参考图",
    inputSlots: [marketingAssetSlot, styleReferenceSlot],
    optionGroups: [
      {
        id: "campaignType",
        label: "活动类型",
        defaultChoiceId: "newLaunch",
        choices: [
          { id: "newLaunch", label: "新品发布", description: "突出新品亮点和首发氛围" },
          { id: "promo", label: "促销活动", description: "强调优惠、限时和转化" },
          { id: "festival", label: "节日节点", description: "贴合节日情绪和礼赠场景" },
          { id: "live", label: "直播预告", description: "适合直播间预约和开播提醒" },
        ],
      },
      {
        id: "visualStyle",
        label: "视觉风格",
        defaultChoiceId: "premium",
        choices: [
          { id: "premium", label: "高级质感", description: "克制、精致、品牌感强" },
          { id: "playful", label: "活泼吸睛", description: "色彩更强，适合社媒传播" },
          { id: "tech", label: "科技未来", description: "适合数码、工具、功能型产品" },
          { id: "minimal", label: "极简留白", description: "干净留白，突出主体和标题" },
        ],
      },
      {
        id: "copyTone",
        label: "文案语气",
        defaultChoiceId: "direct",
        choices: [
          { id: "direct", label: "直接卖点", description: "短标题 + 1-3 个直接卖点" },
          { id: "brand", label: "品牌表达", description: "更像品牌广告和主视觉口号" },
          { id: "emotional", label: "情绪种草", description: "更生活化、更有使用想象" },
          { id: "urgent", label: "限时转化", description: "更强调立即行动和稀缺感" },
        ],
      },
    ],
    outputLabel: "1 张活动海报",
    notesPlaceholder: "可选：活动名称、折扣、节日、标题、卖点、CTA",
    runLabel: "生成海报",
  },
  {
    id: "brand-key-visual",
    name: "品牌KV",
    category: "营销",
    summary: "上传品牌或产品主视觉素材，生成品牌主视觉、活动KV或官网首屏视觉。",
    inputLabel: "品牌/产品素材 + 可选参考图",
    inputSlots: [marketingAssetSlot, styleReferenceSlot],
    optionGroups: [
      {
        id: "kvUse",
        label: "使用场景",
        defaultChoiceId: "brand",
        choices: [
          { id: "brand", label: "品牌主视觉", description: "强化品牌调性和核心识别" },
          { id: "event", label: "活动主视觉", description: "适合发布会、Campaign、专题页" },
          { id: "website", label: "官网首屏", description: "适合网站首屏和落地页头图" },
        ],
      },
      {
        id: "brandMood",
        label: "品牌气质",
        defaultChoiceId: "premium",
        choices: [
          { id: "premium", label: "高级", description: "精致、留白、质感" },
          { id: "young", label: "年轻", description: "鲜明、潮流、社媒感" },
          { id: "tech", label: "科技", description: "理性、未来、功能感" },
          { id: "natural", label: "自然", description: "温和、生活、亲近" },
        ],
      },
      {
        id: "layoutDensity",
        label: "画面密度",
        defaultChoiceId: "balanced",
        choices: [
          { id: "clean", label: "留白", description: "画面更干净，适合后续叠字" },
          { id: "balanced", label: "均衡", description: "主体、标题和氛围平衡" },
          { id: "impact", label: "强冲击", description: "更大主体、更强视觉记忆点" },
        ],
      },
    ],
    outputLabel: "1 张品牌主视觉",
    notesPlaceholder: "可选：品牌名、Slogan、活动主题、核心气质、禁用颜色",
    runLabel: "生成 KV",
  },
  {
    id: "social-cover",
    name: "社媒封面",
    category: "营销",
    summary: "上传人物、产品或主题图，生成小红书、抖音、公众号、Instagram 风格封面。",
    inputLabel: "主题素材 + 可选参考图",
    inputSlots: [subjectAssetSlot, styleReferenceSlot],
    optionGroups: [
      {
        id: "platform",
        label: "平台",
        defaultChoiceId: "xiaohongshu",
        choices: [
          { id: "xiaohongshu", label: "小红书", description: "醒目标题、种草感、封面点击率" },
          { id: "douyin", label: "抖音", description: "强对比、大主体、短视频封面感" },
          { id: "wechat", label: "公众号", description: "横向信息层级更清晰，偏内容封面" },
          { id: "instagram", label: "Instagram", description: "更注重审美、氛围和视觉统一" },
        ],
      },
      {
        id: "coverGoal",
        label: "封面目标",
        defaultChoiceId: "click",
        choices: [
          { id: "click", label: "提高点击", description: "标题更醒目，信息更直接" },
          { id: "save", label: "收藏种草", description: "更像教程、清单或推荐" },
          { id: "brand", label: "品牌曝光", description: "更克制，更强调识别度" },
          { id: "product", label: "产品转化", description: "更突出商品和核心卖点" },
        ],
      },
      {
        id: "coverStyle",
        label: "封面风格",
        defaultChoiceId: "clean",
        choices: [
          { id: "clean", label: "干净清爽", description: "信息少，主体明确" },
          { id: "viral", label: "爆款感", description: "更强标题、更高对比" },
          { id: "editorial", label: "杂志感", description: "排版精致，审美更强" },
          { id: "lifestyle", label: "生活方式", description: "氛围自然，适合种草" },
        ],
      },
    ],
    outputLabel: "1 张社媒封面",
    notesPlaceholder: "可选：标题、账号调性、目标人群、平台尺寸、禁用元素",
    runLabel: "生成封面",
  },
  {
    id: "product-scene",
    name: "产品场景图",
    category: "营销",
    summary: "上传 1-2 张产品图，可选场景参考图，生成桌面、居家、户外或摄影棚产品图。",
    inputLabel: "产品图 + 可选场景参考",
    inputSlots: [
      productSlot,
      {
        ...styleReferenceSlot,
        label: "场景参考图",
        description: "可选：粘贴桌面、家居、户外或摄影棚场景参考",
      },
    ],
    optionGroups: [
      {
        id: "sceneType",
        label: "场景类型",
        defaultChoiceId: "desktop",
        choices: [
          { id: "desktop", label: "桌面", description: "适合工具、数码、办公和美妆" },
          { id: "home", label: "居家", description: "温暖生活化，强调使用氛围" },
          { id: "outdoor", label: "户外", description: "自然光、旅行、运动和场景故事" },
          { id: "studio", label: "摄影棚", description: "干净可控，强调产品质感" },
        ],
      },
      {
        id: "referenceMode",
        label: "参考方式",
        defaultChoiceId: "smart",
        choices: ecommerceReferenceModes,
      },
      {
        id: "sceneMood",
        label: "画面氛围",
        defaultChoiceId: "premium",
        choices: [
          { id: "warm", label: "温暖", description: "柔和、亲近、生活感" },
          { id: "premium", label: "高级", description: "质感、克制、商业摄影" },
          { id: "fresh", label: "清新", description: "明亮、轻盈、干净" },
          { id: "tech", label: "科技", description: "冷静、功能、未来感" },
        ],
      },
    ],
    outputLabel: "1 张产品场景图",
    notesPlaceholder: "可选：使用场景、目标人群、道具、材质、背景要求",
    runLabel: "生成场景图",
  },
  {
    id: "detail-page-hero",
    name: "详情页首屏",
    category: "营销",
    summary: "上传 1-2 张产品图，可选参考图，生成短标题、核心卖点和产品主视觉。",
    inputLabel: "产品图 + 可选参考图",
    inputSlots: [productSlot, styleReferenceSlot],
    optionGroups: [
      {
        id: "detailFocus",
        label: "信息重点",
        defaultChoiceId: "sellingPoints",
        choices: [
          { id: "sellingPoints", label: "核心卖点", description: "围绕 2-4 个关键利益点" },
          { id: "texture", label: "材质质感", description: "强调工艺、材料、细节和高级感" },
          { id: "usage", label: "使用场景", description: "强调怎么用、在哪里用、给谁用" },
          { id: "comparison", label: "对比优势", description: "用短文案表达差异化优势" },
        ],
      },
      {
        id: "layoutStyle",
        label: "版式风格",
        defaultChoiceId: "cleanRich",
        choices: [
          { id: "cleanRich", label: "清爽信息", description: "信息完整但不拥挤" },
          { id: "premium", label: "高级大图", description: "大主体、少文字、强质感" },
          { id: "tech", label: "参数科技", description: "适合功能型和数码工具产品" },
          { id: "soft", label: "柔和种草", description: "更生活化、更有亲和力" },
        ],
      },
      {
        id: "copyDensity",
        label: "文案密度",
        defaultChoiceId: "short",
        choices: [
          { id: "short", label: "短文案", description: "短标题 + 少量卖点，最稳" },
          { id: "medium", label: "适中", description: "增加 2-4 个短卖点区" },
          { id: "visual", label: "少字大图", description: "更重视觉，文字更少" },
        ],
      },
    ],
    outputLabel: "1 张详情页首屏",
    notesPlaceholder: "可选：标题、核心卖点、适用人群、详情页风格、禁用文案",
    runLabel: "生成首屏",
  },
];

export function getWorkflowApp(id: string) {
  return workflowApps.find((workflow) => workflow.id === id) ?? null;
}
