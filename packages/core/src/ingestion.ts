export type IngestSourceKind="image"|"video"|"audio"|"pdf"|"document"|"spreadsheet"|"text"|"unknown";
export type IngestJobStatus="queued"|"processing"|"awaiting_review"|"completed"|"failed"|"cancelled";
export type ExtractedChunkKind="text"|"table"|"transcript"|"ocr"|"scene"|"keyframe"|"code"|"metadata";
export interface AssetIngestJob{id:string;projectId:string;assetId:string;status:IngestJobStatus;attempt:number;maxAttempts:number;stage:string;error?:string;createdAt:string}
export interface ExtractedChunk{id?:string;assetId:string;projectId:string;kind:ExtractedChunkKind;ordinal:number;content:string;pageNumber?:number;startMs?:number;endMs?:number;speaker?:string;metadata:Record<string,unknown>}
export interface TranscriptSegment{startMs:number;endMs:number;text:string;speaker?:string;confidence?:number}
export interface VideoKeyframe{timestampMs:number;storageKey:string;width?:number;height?:number}
export interface AssetAnalysis{assetId:string;sourceKind:IngestSourceKind;mimeType:string;sizeBytes:number;sha256?:string;metadata:Record<string,unknown>;chunks:ExtractedChunk[];transcript:TranscriptSegment[];keyframes:VideoKeyframe[];warnings:string[];capabilities:{textExtracted:boolean;ocr:"completed"|"disabled"|"unavailable"|"failed";transcription:"completed"|"disabled"|"unavailable"|"failed";vision:"completed"|"disabled"|"unavailable"|"failed";embeddings:"completed"|"disabled"|"unavailable"|"failed"}}
export const INGEST_MAX_BYTES=512*1024*1024;
export function classifyIngestKind(mimeType:string,filename:string):IngestSourceKind{
 const m=mimeType.toLowerCase(),f=filename.toLowerCase();
 if(m.startsWith("image/"))return"image";if(m.startsWith("video/"))return"video";if(m.startsWith("audio/"))return"audio";
 if(m==="application/pdf"||f.endsWith(".pdf"))return"pdf";
 if(/spreadsheet|excel|csv/.test(m)||/\.(csv|xlsx?|ods)$/.test(f))return"spreadsheet";
 if(/word|officedocument/.test(m)||/\.(docx|doc|odt)$/.test(f))return"document";
 if(/text\//.test(m)||/\.(txt|md|markdown|json|xml|html)$/.test(f))return"text";
 return"unknown";
}
export function validateIngestRequest(input:{mimeType:string;filename:string;sizeBytes:number;storageKey:string}){
 const errors:string[]=[];if(!input.filename.trim()||input.filename.length>255)errors.push("Invalid filename");
 if(!input.mimeType.includes("/"))errors.push("Invalid MIME type");
 if(!Number.isSafeInteger(input.sizeBytes)||input.sizeBytes<=0||input.sizeBytes>INGEST_MAX_BYTES)errors.push("File size must be between 1 byte and 512 MiB");
 if(!input.storageKey.trim()||input.storageKey.startsWith("/")||input.storageKey.split(/[\\/]/).includes(".."))errors.push("Unsafe storage key");
 const kind=classifyIngestKind(input.mimeType,input.filename);if(kind==="unknown")errors.push("Unsupported file type");
 return{valid:errors.length===0,errors,kind};
}
export function chunkText(content:string,maxChars=1800,overlap=180):string[]{
 const text=content.replace(/\r\n/g,"\n").trim();if(!text)return[];const size=Math.max(300,Math.min(8000,maxChars)),over=Math.max(0,Math.min(size-1,overlap));
 const paragraphs=text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);const chunks:string[]=[];let current="";
 for(const p of paragraphs){if(p.length>size){if(current){chunks.push(current);current=""}let start=0;while(start<p.length){const part=p.slice(start,start+size).trim();if(part)chunks.push(part);if(start+size>=p.length)break;start+=size-over}continue}
  if(current&&current.length+2+p.length>size){chunks.push(current);const tail=current.slice(-over);current=tail?tail+"\n\n"+p:p}else current=current?current+"\n\n"+p:p;
 }
 if(current.trim())chunks.push(current.trim());return chunks;
}
