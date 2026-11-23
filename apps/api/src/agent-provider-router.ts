export type AgentProviderId="openrouter"|"openai"|"google"|"deepseek"|"groq"|"mistral"|"huggingface"|"ollama";
export interface AgentProviderConfig {id:AgentProviderId;apiKey:string;baseURL:string;model:string;label:string}
type Env=Record<string,string|undefined>;
const specs:Record<AgentProviderId,{key:string;url:string;modelEnv:string;fallbackModel:string;label:string}>={
 openrouter:{key:"OPENROUTER_API_KEY",url:"https://openrouter.ai/api/v1",modelEnv:"OPENROUTER_AGENT_MODEL",fallbackModel:"openrouter/auto",label:"OpenRouter"},
 openai:{key:"OPENAI_API_KEY",url:"https://api.openai.com/v1",modelEnv:"OPENAI_AGENT_MODEL",fallbackModel:"gpt-4o-mini",label:"OpenAI"},
 google:{key:"GOOGLE_API_KEY",url:"https://generativelanguage.googleapis.com/v1beta/openai/",modelEnv:"GOOGLE_AGENT_MODEL",fallbackModel:"gemini-2.5-flash",label:"Google Gemini"},
 deepseek:{key:"DEEPSEEK_API_KEY",url:"https://api.deepseek.com/v1",modelEnv:"DEEPSEEK_AGENT_MODEL",fallbackModel:"deepseek-chat",label:"DeepSeek"},
 groq:{key:"GROQ_API_KEY",url:"https://api.groq.com/openai/v1",modelEnv:"GROQ_AGENT_MODEL",fallbackModel:"llama-3.3-70b-versatile",label:"Groq"},
 mistral:{key:"MISTRAL_API_KEY",url:"https://api.mistral.ai/v1",modelEnv:"MISTRAL_AGENT_MODEL",fallbackModel:"mistral-small-latest",label:"Mistral"},
 huggingface:{key:"HF_API_KEY",url:"https://router.huggingface.co/v1",modelEnv:"HF_AGENT_MODEL",fallbackModel:"Qwen/Qwen2.5-72B-Instruct",label:"Hugging Face"},
 ollama:{key:"OLLAMA_API_KEY",url:"http://localhost:11434/v1",modelEnv:"OLLAMA_AGENT_MODEL",fallbackModel:"llama3.2",label:"Ollama"}
};
function normalized(v?:string){return v?.trim()||""}
export function configuredAgentProviders(env:Env=process.env):AgentProviderId[]{return (Object.keys(specs) as AgentProviderId[]).filter(id=>normalized(env[specs[id].key]))}
export function getAgentProviderConfig(id:AgentProviderId,env:Env=process.env):AgentProviderConfig|undefined{
 const s=specs[id],key=normalized(env[s.key]);if(!key)return undefined;
 return{id,apiKey:key,baseURL:normalized(env[id.toUpperCase()+"_BASE_URL"])||s.url,model:normalized(env[s.modelEnv])||s.fallbackModel,label:s.label};
}
export function resolveAgentProvider(env:Env=process.env):AgentProviderConfig{
 const configured=configuredAgentProviders(env);
 const preference=normalized(env.AIVEDIO_AGENT_PROVIDER).toLowerCase();
 if(preference&&preference!=="auto"){
  if(!configured.includes(preference as AgentProviderId))throw new Error("AIVEDIO_AGENT_PROVIDER="+preference+" selected but its API key is not configured");
  return getAgentProviderConfig(preference as AgentProviderId,env)!;
 }
 const order:AgentProviderId[]=["openrouter","openai","google","deepseek","groq","mistral","huggingface","ollama"];
 const selected=order.find(id=>configured.includes(id));
 if(!selected)throw new Error("No supported agent provider key configured. Set OPENROUTER_API_KEY or another provider key.");
 return getAgentProviderConfig(selected,env)!;
}
export function agentProviderStatus(env:Env=process.env){return (Object.keys(specs) as AgentProviderId[]).map(id=>({id,label:specs[id].label,configured:!!normalized(env[specs[id].key]),model:normalized(env[specs[id].modelEnv])||specs[id].fallbackModel,baseURL:normalized(env[id.toUpperCase()+"_BASE_URL"])||specs[id].url}))}
