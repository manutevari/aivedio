import test from "node:test";
import assert from "node:assert/strict";
import { buildProductionGraph, createScene, splitScene } from "../src/flow-engine.js";

test("production graph includes producer, director and cinematography checkpoints", () => {
  const scene = createScene(1, "Opening");
  scene.prompt = "A quiet sunrise over the city";
  scene.producerPlan = { budgetNotes: "Use existing locations", deliverables: ["4K master"] };
  scene.directorBrief = { creativeVision: "Restrained and intimate", storyIntent: "Introduce the lead" };
  scene.cinematographyDesign = { shotType: "Wide", lens: "35mm", cameraMovement: "Slow dolly", lighting: "Golden hour", framing: "Rule of thirds" };

  const graph = buildProductionGraph([scene]);
  const byType = new Map(graph.map((task) => [task.taskType, task]));

  assert.deepEqual(byType.get("producer")?.dependsOn, []);
  assert.equal(byType.get("producer")?.status, "ready");
  assert.equal(byType.get("producer")?.checkpoint, true);
  assert.deepEqual(byType.get("director")?.dependsOn, [scene.id + ":producer"]);
  assert.deepEqual(byType.get("cinematography")?.dependsOn, [scene.id + ":director"]);
  assert.deepEqual(byType.get("script")?.dependsOn, [scene.id + ":director"]);
  assert.deepEqual(byType.get("image")?.dependsOn, [scene.id + ":script", scene.id + ":cinematography"]);
  assert.deepEqual(byType.get("video")?.dependsOn, [scene.id + ":image", scene.id + ":cinematography"]);
  assert.deepEqual(byType.get("qa")?.dependsOn, [scene.id + ":video", scene.id + ":voice"]);
  assert.equal(byType.get("director_review")?.requiresApproval, true);
  assert.equal(byType.get("producer_approval")?.requiresApproval, true);
  assert.deepEqual(byType.get("producer_approval")?.dependsOn, [scene.id + ":director_review"]);
  assert.equal(byType.get("cinematography")?.input.design && (byType.get("cinematography")?.input.design as { lens: string }).lens, "35mm");
});

test("production graph creates independent role and approval tasks per scene", () => {
  const scenes = [createScene(1, "One"), createScene(2, "Two")];
  const graph = buildProductionGraph(scenes);
  assert.equal(graph.length, 20);
  for (const scene of scenes) {
    assert.ok(graph.some((task) => task.id === scene.id + ":producer"));
    assert.ok(graph.some((task) => task.id === scene.id + ":director"));
    assert.ok(graph.some((task) => task.id === scene.id + ":cinematography"));
    assert.ok(graph.some((task) => task.id === scene.id + ":producer_approval"));
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
