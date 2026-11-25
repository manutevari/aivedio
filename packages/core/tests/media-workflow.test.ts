import test from "node:test";
import assert from "node:assert/strict";
import {executeMediaWorkflow,chooseMediaExecutionMode,type MediaTaskContract} from "../src/media-workflow.js";
const task=(id:string,dependencies:string[]=[]):MediaTaskContract=>({id,projectId:"p",kind:"quality.analyze",mode:"sync",input:{},dependencies,timeoutMs:1000,maxRetries:0,requiresApproval:false});
test("selects sync, async and stream from workload",()=>{assert.equal(chooseMediaExecutionMode({durationSeconds:8}),"sync");assert.equal(chooseMediaExecutionMode({durationSeconds:90}),"async");assert.equal(chooseMediaExecutionMode({interactive:true}),"stream")});
test("executes workflow dependencies in order and reports completion",async()=>{const order:string[]=[];const handler={execute:async(t:MediaTaskContract)=>{order.push(t.id);return {ok:true}}};const out=await executeMediaWorkflow([task("a"),task("b",["a"])],{"quality.analyze":handler});assert.deepEqual(order,["a","b"]);assert.deepEqual(out.map(x=>x.status),["completed","completed"])});
test("rejects cyclic dependencies",async()=>{await assert.rejects(()=>executeMediaWorkflow([task("a",["b"]),task("b",["a"])],{}),/cycle/)});
test("blocks dependents after failed task",async()=>{const handler={execute:async()=>{throw new Error("nope")}};const out=await executeMediaWorkflow([task("a"),task("b",["a"])],{"quality.analyze":handler});assert.equal(out[0].status,"failed");assert.equal(out[1].status,"failed");assert.match(out[1].error??"",/Blocked/)});
