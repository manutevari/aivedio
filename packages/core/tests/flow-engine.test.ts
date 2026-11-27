import test from "node:test";
import assert from "node:assert/strict";
import { buildProductionGraph, createScene, splitScene } from "../src/flow-engine.js";

test("HITL is the top-level gate before producer and every agent task", () => {
  const scene = createScene(1, "Opening");
  scene.prompt = "A quiet sunrise over the city";
  const graph = buildProductionGraph([scene]);
  const byType = new Map(graph.map((task) => [task.taskType, task]));

  const hitl = byType.get("hitl_preflight")!;
  assert.equal(hitl.role, "human_supervisor");
  assert.equal(hitl.status, "awaiting_approval");
  assert.equal(hitl.requiresApproval, true);
  assert.deepEqual(byType.get("producer")?.dependsOn, [hitl.id]);
  assert.equal(byType.get("producer")?.status, "pending");
  assert.deepEqual(byType.get("director")?.dependsOn, [scene.id + ":producer"]);
  assert.deepEqual(byType.get("cinematography")?.dependsOn, [scene.id + ":director"]);
  assert.deepEqual(byType.get("script")?.dependsOn, [scene.id + ":director"]);
  assert.deepEqual(byType.get("image")?.dependsOn, [scene.id + ":script", scene.id + ":cinematography"]);
  assert.deepEqual(byType.get("video")?.dependsOn, [scene.id + ":image", scene.id + ":cinematography"]);
  assert.deepEqual(byType.get("voice")?.dependsOn, [scene.id + ":script"]);
  assert.deepEqual(byType.get("qa")?.dependsOn, [scene.id + ":video", scene.id + ":voice"]);
});

test("director, producer and final HITL approvals are explicit gates", () => {
  const scene = createScene(1, "Approval");
  const graph = buildProductionGraph([scene]);
  const byType = new Map(graph.map((task) => [task.taskType, task]));

  for (const type of ["director_review", "producer_approval", "hitl_final"] as const) {
    assert.equal(byType.get(type)?.requiresApproval, true);
    assert.equal(byType.get(type)?.checkpoint, true);
    assert.equal(byType.get(type)?.status, "awaiting_approval");
  }
  assert.deepEqual(byType.get("producer_approval")?.dependsOn, [scene.id + ":director_review"]);
  assert.deepEqual(byType.get("hitl_final")?.dependsOn, [scene.id + ":producer_approval"]);
});

test("all tasks expose durable HITL notification events", () => {
  const graph = buildProductionGraph([createScene(1)]);
  for (const task of graph) {
    assert.equal(task.notificationChannel, "workflow_event");
    assert.deepEqual(task.notifyHumanOn, ["ready", "started", "completed", "failed", "blocked", "approval_required"]);
  }
});

test("production graph creates independent role and approval tasks per scene", () => {
  const scenes = [createScene(1, "One"), createScene(2, "Two")];
  const graph = buildProductionGraph(scenes);
  assert.equal(graph.length, 24);
  for (const scene of scenes) {
    for (const suffix of ["hitl_preflight", "producer", "director", "cinematography", "director_review", "producer_approval", "hitl_final"]) {
      assert.ok(graph.some((task) => task.id === scene.id + ":" + suffix));
    }
  }
});

test("split scene preserves creative role briefs without sharing mutable nested data", () => {
  const scene = createScene(1, "Split me");
  scene.durationSeconds = 12;
  scene.producerPlan = { deliverables: ["master"] };
  scene.directorBrief = { creativeVision: "Naturalistic" };
  scene.cinematographyDesign = { lens: "50mm" };
  const [, second] = splitScene(scene, 5);
  assert.deepEqual(second.producerPlan?.deliverables, ["master"]);
  assert.notEqual(second.producerPlan, scene.producerPlan);
  assert.notEqual(second.directorBrief, scene.directorBrief);
  assert.notEqual(second.cinematographyDesign, scene.cinematographyDesign);
});

test("split scene rejects non-finite and out-of-range offsets", () => {
  const scene = createScene(1);
  scene.durationSeconds = 10;
  assert.throws(() => splitScene(scene, Number.NaN), /finite/);
  assert.throws(() => splitScene(scene, 0), /finite/);
  assert.throws(() => splitScene(scene, 10), /finite/);
});
