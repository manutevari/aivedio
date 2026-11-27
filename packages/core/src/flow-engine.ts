export type SceneStatus = "draft" | "planned" | "approved" | "generating" | "generated" | "failed";

export interface CharacterAsset {
  id: string; name: string; description: string; referenceIds: string[];
  consistencyNotes: string; attributes: Record<string, string>;
}
export interface ReferenceAsset {
  id: string; kind: "image" | "video" | "audio" | "text"; uri: string; label: string; tags: string[];
}
export interface ProducerPlan {
  budgetNotes?: string; scheduleNotes?: string; resourceNotes?: string; deliverables?: string[];
}
export interface DirectorBrief {
  creativeVision?: string; storyIntent?: string; performanceDirection?: string;
}
export interface CinematographyDesign {
  shotType?: string; lens?: string; cameraMovement?: string; lighting?: string; framing?: string; colorPalette?: string;
}
export interface FlowScene {
  id: string; order: number; title: string; logline: string; prompt: string; durationSeconds: number;
  camera: string; lighting: string; composition: string; action: string; dialogue: string;
  characters: string[]; locations: string[]; props: string[]; referenceIds: string[];
  status: SceneStatus; version: number; continuityNotes: string[];
  producerPlan?: ProducerPlan; directorBrief?: DirectorBrief; cinematographyDesign?: CinematographyDesign;
}
export interface FlowProject {
  title: string; creativeBrief: string; styleBible: string; aspectRatio: string;
  targetDurationSeconds: number; scenes: FlowScene[]; characters: CharacterAsset[]; references: ReferenceAsset[];
}

export type ProductionRole = "human_supervisor" | "producer" | "director" | "cinematography_designer" | "qa_reviewer";
export type ProductionTaskType =
  | "hitl_preflight" | "producer" | "director" | "cinematography" | "script" | "image" | "video" | "voice"
  | "music" | "sfx" | "qa" | "director_review" | "producer_approval" | "hitl_final";
export type ProductionTaskStatus = "pending" | "ready" | "running" | "paused" | "completed" | "failed" | "awaiting_approval";
export interface ProductionTask {
  id: string; sceneId: string; taskType: ProductionTaskType; role?: ProductionRole;
  dependsOn: string[]; status: ProductionTaskStatus; attempts: number; input: Record<string, unknown>;
  checkpoint: boolean; requiresApproval: boolean;
  notifyHumanOn: Array<"ready" | "started" | "completed" | "failed" | "blocked" | "approval_required">;
  notificationChannel: "workflow_event";
}

export function createScene(order: number, title = "New Scene"): FlowScene {
  return { id: crypto.randomUUID(), order, title, logline: "", prompt: "", durationSeconds: 10, camera: "",
    lighting: "", composition: "", action: "", dialogue: "", characters: [], locations: [], props: [],
    referenceIds: [], status: "draft", version: 1, continuityNotes: [] };
}
export function reorderScenes(scenes: FlowScene[], orderedIds: string[]) {
  const map = new Map(scenes.map((scene) => [scene.id, scene]));
  return orderedIds.map((id, index) => { const scene = map.get(id); if (!scene) throw new Error("Unknown scene id: " + id); return { ...scene, order: index + 1 }; });
}
export function splitScene(scene: FlowScene, atSeconds: number) {
  if (!Number.isFinite(atSeconds) || atSeconds <= 0 || atSeconds >= scene.durationSeconds) throw new Error("Split point must be a finite value inside scene duration");
  const first = { ...scene, durationSeconds: atSeconds, version: scene.version + 1 };
  const second: FlowScene = {
    ...createScene(scene.order + 1, scene.title + " — Part 2"),
    prompt: scene.prompt, action: scene.action, dialogue: scene.dialogue, characters: [...scene.characters],
    locations: [...scene.locations], props: [...scene.props], referenceIds: [...scene.referenceIds],
    durationSeconds: scene.durationSeconds - atSeconds, continuityNotes: ["Continue seamlessly from preceding scene"],
    ...(scene.producerPlan ? { producerPlan: { ...scene.producerPlan, ...(scene.producerPlan.deliverables ? { deliverables: [...scene.producerPlan.deliverables] } : {}) } } : {}),
    ...(scene.directorBrief ? { directorBrief: { ...scene.directorBrief } } : {}),
    ...(scene.cinematographyDesign ? { cinematographyDesign: { ...scene.cinematographyDesign } } : {}),
  };
  return [first, second];
}

/** Human supervisor is the top-level authority. No production task is executable until preflight approval. */
export function buildProductionGraph(scenes: FlowScene[]): ProductionTask[] {
  const tasks: ProductionTask[] = [];
  const add = (scene: FlowScene, taskType: ProductionTaskType, role: ProductionRole | undefined,
    dependsOn: string[], input: Record<string, unknown>,
    options: { ready?: boolean; checkpoint?: boolean; requiresApproval?: boolean; status?: ProductionTaskStatus } = {}) => {
    tasks.push({
      id: scene.id + ":" + taskType, sceneId: scene.id, taskType, ...(role ? { role } : {}),
      dependsOn, status: options.status ?? (options.ready ? "ready" : "pending"), attempts: 0, input,
      checkpoint: options.checkpoint ?? false, requiresApproval: options.requiresApproval ?? false,
      notifyHumanOn: ["ready", "started", "completed", "failed", "blocked", "approval_required"],
      notificationChannel: "workflow_event",
    });
  };

  for (const scene of scenes) {
    const hitlPreflight = scene.id + ":hitl_preflight";
    const producerId = scene.id + ":producer";
    const directorId = scene.id + ":director";
    const cinematographyId = scene.id + ":cinematography";
    const scriptId = scene.id + ":script";
    const imageId = scene.id + ":image";
    const videoId = scene.id + ":video";
    const voiceId = scene.id + ":voice";
    const qaId = scene.id + ":qa";
    const directorReviewId = scene.id + ":director_review";
    const producerApprovalId = scene.id + ":producer_approval";

    add(scene, "hitl_preflight", "human_supervisor", [], {
      gate: "production_authorization", message: "Human approval required before producer planning and agent execution",
      scope: ["creative_brief", "budget_envelope", "schedule", "safety", "deliverables"],
    }, { checkpoint: true, requiresApproval: true, status: "awaiting_approval" });
    add(scene, "producer", "producer", [hitlPreflight], {
      title: scene.title, durationSeconds: scene.durationSeconds, plan: scene.producerPlan ?? {},
    }, { checkpoint: true });
    add(scene, "director", "director", [producerId], {
      logline: scene.logline, prompt: scene.prompt, brief: scene.directorBrief ?? {},
      characters: scene.characters, locations: scene.locations, action: scene.action, dialogue: scene.dialogue,
    }, { checkpoint: true });
    add(scene, "cinematography", "cinematography_designer", [directorId], {
      design: scene.cinematographyDesign ?? {}, camera: scene.camera, lighting: scene.lighting,
      composition: scene.composition, references: scene.referenceIds,
    }, { checkpoint: true });
    add(scene, "script", undefined, [directorId], {
      prompt: scene.prompt, dialogue: scene.dialogue, storyIntent: scene.directorBrief?.storyIntent ?? "",
    });
    add(scene, "image", undefined, [scriptId, cinematographyId], {
      camera: scene.camera, lighting: scene.lighting, composition: scene.composition,
      design: scene.cinematographyDesign ?? {}, referenceIds: scene.referenceIds,
    });
    add(scene, "video", undefined, [imageId, cinematographyId], {
      action: scene.action, durationSeconds: scene.durationSeconds,
      cameraMovement: scene.cinematographyDesign?.cameraMovement ?? "",
    });
    add(scene, "voice", undefined, [scriptId], { dialogue: scene.dialogue });
    add(scene, "qa", "qa_reviewer", [videoId, voiceId], {
      continuityNotes: scene.continuityNotes, expectedDurationSeconds: scene.durationSeconds,
    }, { checkpoint: true });
    add(scene, "director_review", "director", [qaId], {
      reviewScope: ["story", "performance", "visual_intent", "continuity"],
    }, { checkpoint: true, requiresApproval: true, status: "awaiting_approval" });
    add(scene, "producer_approval", "producer", [directorReviewId], {
      reviewScope: ["budget", "schedule", "deliverables", "final_acceptance"],
    }, { checkpoint: true, requiresApproval: true, status: "awaiting_approval" });
    add(scene, "hitl_final", "human_supervisor", [producerApprovalId], {
      gate: "final_release_authorization", message: "Human supervisor must authorize final delivery",
    }, { checkpoint: true, requiresApproval: true, status: "awaiting_approval" });
  }
  return tasks;
}

export function continuityChecklist(scenes: FlowScene[]) {
  const issues: { sceneId: string; issue: string; severity: "warning" | "blocking" }[] = [];
  const characterSet = new Set<string>();
  for (const scene of scenes) {
    for (const character of scene.characters) characterSet.add(character);
    if (!scene.prompt.trim()) issues.push({ sceneId: scene.id, issue: "Missing scene prompt", severity: "blocking" });
    if (!Number.isFinite(scene.durationSeconds) || scene.durationSeconds <= 0) issues.push({ sceneId: scene.id, issue: "Invalid duration", severity: "blocking" });
    if (scene.order < 1) issues.push({ sceneId: scene.id, issue: "Scene order must be positive", severity: "blocking" });
  }
  return { sceneCount: scenes.length, characters: [...characterSet], issues, ready: issues.every((issue) => issue.severity !== "blocking") };
}
