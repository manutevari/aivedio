import test from "node:test";
import assert from "node:assert/strict";
import {createCreativePlan,validateCreativePlan} from "../src/creative-director.js";

test("creative plans allocate exact positive scene and shot durations at minimum target",()=>{
 for(const format of ["general","advertisement","explainer","documentary","music_video","animation"] as const){
  for(const targetDurationSeconds of [10,11,30,60,43200]){
   const plan=createCreativePlan({projectTitle:"Duration test",brief:"A simple fictional story.",format,targetDurationSeconds});
   const validation=validateCreativePlan(plan);
   assert.equal(validation.valid,true,`${format} at ${targetDurationSeconds}s: ${validation.errors.join("; ")}`);
   assert.equal(plan.scenes.reduce((sum,scene)=>sum+scene.durationSeconds,0),targetDurationSeconds);
   for(const scene of plan.scenes){
    assert.ok(scene.durationSeconds>0);
    assert.equal(scene.shots.reduce((sum,shot)=>sum+shot.durationSeconds,0),scene.durationSeconds);
    assert.ok(scene.shots.every(shot=>shot.durationSeconds>0));
   }
  }
 }
});

test("creative plan creation rejects non-finite numeric input",()=>{
 assert.throws(()=>createCreativePlan({projectTitle:"Bad duration",brief:"Test",targetDurationSeconds:Number.NaN}),/finite number/);
 assert.throws(()=>createCreativePlan({projectTitle:"Bad fps",brief:"Test",fps:Number.POSITIVE_INFINITY}),/FPS/);
 const plan=createCreativePlan({projectTitle:"Validation",brief:"Test"});
 plan.targetDurationSeconds=Number.NaN;
 assert.equal(validateCreativePlan(plan).valid,false);
});
