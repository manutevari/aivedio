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

import {dbToEditManifest,validateEditManifest} from "../src/editing.js";
import {TimelineClip,TimelineTrack,splitTimelineClip} from "../src/timeline.js";

test("edit manifest includes image clips and preserves timeline gaps",()=>{
 const track:TimelineTrack={id:"track",projectId:"project",name:"Visual",kind:"video",order:0,muted:false,locked:false,gainDb:0,metadata:{}};
 const base:TimelineClip={id:"video",trackId:"track",assetId:"asset-video",kind:"video",title:"Video",timelineStartMs:0,timelineDurationMs:1000,sourceStartMs:0,sourceDurationMs:1000,playbackRate:1,volume:1,opacity:1,zIndex:0,metadata:{}};
 const image:TimelineClip={...base,id:"image",assetId:"asset-image",kind:"image",title:"Still",timelineStartMs:5000,timelineDurationMs:2000,sourceDurationMs:2000};
 const manifest=dbToEditManifest("project",{container:"mp4",videoCodec:"h264",audioCodec:"aac",width:1920,height:1080,fps:24,quality:"standard",audioSampleRate:48000},[track],[base,image]);
 assert.equal(manifest.videoClips.length,2);
 assert.equal(manifest.durationMs,7000);
 assert.equal(validateEditManifest(manifest).valid,true);
});

test("timeline split rejects NaN offset",()=>{
 const clip:TimelineClip={id:"clip",trackId:"track",kind:"video",title:"Clip",timelineStartMs:0,timelineDurationMs:1000,sourceStartMs:0,sourceDurationMs:1000,playbackRate:1,volume:1,opacity:1,zIndex:0,metadata:{}};
 assert.throws(()=>splitTimelineClip(clip,Number.NaN),/finite/);
});
