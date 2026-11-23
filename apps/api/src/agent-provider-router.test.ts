import test from "node:test";
import assert from "node:assert/strict";
import {configuredAgentProviders,resolveAgentProvider,agentProviderStatus} from "./agent-provider-router.js";
test("provider discovery only returns configured keys",()=>{assert.deepEqual(configuredAgentProviders({GROQ_API_KEY:"g",OPENAI_API_KEY:""}),["groq"])});
test("auto route prefers OpenRouter then provider priority",()=>{assert.equal(resolveAgentProvider({GROQ_API_KEY:"g",OPENAI_API_KEY:"o"}).id,"openai");assert.equal(resolveAgentProvider({OPENROUTER_API_KEY:"r",GROQ_API_KEY:"g"}).id,"openrouter")});
test("manual route requires configured provider and accepts model override",()=>{assert.throws(()=>resolveAgentProvider({AIVEDIO_AGENT_PROVIDER:"mistral",OPENAI_API_KEY:"x"}),/not configured/);const c=resolveAgentProvider({AIVEDIO_AGENT_PROVIDER:"groq",GROQ_API_KEY:"g",GROQ_AGENT_MODEL:"custom-model"});assert.equal(c.model,"custom-model");assert.equal(c.id,"groq")});
test("status never exposes secret values",()=>{const s=agentProviderStatus({OPENAI_API_KEY:"secret"});assert.equal(s.find(x=>x.id==="openai")?.configured,true);assert.ok(!JSON.stringify(s).includes("secret"))});
