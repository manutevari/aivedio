#!/usr/bin/env python3
import os, json, time, uuid, mimetypes, hashlib, subprocess
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
DATABASE_URL=os.getenv("DATABASE_URL"); MEDIA_ROOT=Path(os.getenv("MEDIA_ROOT","./media")).resolve(); POLL=float(os.getenv("ASSET_WORKER_POLL_SECONDS","4")); WORKER_ID=os.getenv("ASSET_WORKER_ID",f"asset-worker-{uuid.uuid4()}"); MAX_BYTES=int(os.getenv("ASSET_MAX_BYTES",100*1024*1024))
def db():
 if not DATABASE_URL: raise RuntimeError("DATABASE_URL not configured")
 return psycopg.connect(DATABASE_URL,row_factory=dict_row)
def safe_path(key):
 p=(MEDIA_ROOT/key).resolve()
 if not p.is_relative_to(MEDIA_ROOT): raise ValueError("storage key escapes MEDIA_ROOT")
 return p
def meta(path,asset):
 return {"filename":asset.get("original_name") or path.name,"mimeType":asset.get("mime_type") or mimetypes.guess_type(path.name)[0] or "application/octet-stream","sizeBytes":path.stat().st_size,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"extension":path.suffix.lower()}
def text_extract(path,mime):
 chunks=[];warnings=[]
 try:
  if mime.startswith("text/") or mime in ("application/json","text/csv"):
   text=path.read_text(errors="replace")
   if mime=="text/html":
    import re
    text=re.sub(r"<script[^>]*>.*?</script>|<style[^>]*>.*?</style>"," ",text,flags=re.I|re.S);text=re.sub(r"<[^>]+>"," ",text)
   if text.strip():chunks.append({"kind":"text","content":text[:500000],"metadata":{"extractor":"stdlib"}})
  elif mime=="application/pdf":
   from pypdf import PdfReader
   for i,page in enumerate(PdfReader(str(path)).pages):
    text=page.extract_text() or ""
    if text.strip():chunks.append({"kind":"text","content":text[:20000],"page":i+1,"metadata":{"extractor":"pypdf"}})
  elif mime.endswith("wordprocessingml.document"):
   from docx import Document
   doc=Document(str(path));text="\n".join(p.text for p in doc.paragraphs)
   for table in doc.tables:text+="\n"+"\n".join(" | ".join(c.text for c in row.cells) for row in table.rows)
   if text.strip():chunks.append({"kind":"text","content":text[:500000],"metadata":{"extractor":"python-docx"}})
  elif mime.endswith("spreadsheetml.sheet"):
   import openpyxl
   wb=openpyxl.load_workbook(path,read_only=True,data_only=True)
   for ws in wb.worksheets:
    rows=[]
    for row in ws.iter_rows(values_only=True):
     vals=[str(v) if v is not None else "" for v in row]
     if any(vals):rows.append(" | ".join(vals))
    if rows:chunks.append({"kind":"text","content":"Sheet: "+ws.title+"\n"+"\n".join(rows)[:100000],"metadata":{"extractor":"openpyxl","sheet":ws.title}})
 except ImportError as e:warnings.append(f"Text extraction dependency unavailable: {e.name}")
 except Exception as e:warnings.append(f"Text extraction failed: {type(e).__name__}: {e}")
 return chunks,warnings
def ocr(path):
 try:
  import pytesseract
  from PIL import Image
  return pytesseract.image_to_string(Image.open(path)),None
 except ImportError:return None,"OCR wrapper unavailable"
 except Exception as e:return None,f"OCR unavailable or failed: {type(e).__name__}"
def which(cmd):
 import shutil
 return shutil.which(cmd)
def probe(path):
 try:return json.loads(subprocess.run(["ffprobe","-v","quiet","-print_format","json","-show_format","-show_streams",str(path)],capture_output=True,text=True,timeout=30,check=True).stdout),None
 except FileNotFoundError:return None,"ffprobe unavailable"
 except Exception as e:return None,f"ffprobe failed: {type(e).__name__}"
def extract_keyframes(path,asset_id):
 if not which("ffmpeg"):return [],"FFmpeg unavailable"
 info,w=probe(path);duration=float(info.get("format",{}).get("duration",0)) if info else 0
 if duration<=0:return [],w or "Duration unavailable"
 times=sorted(set([0.0,duration*.25,duration*.5,duration*.75,max(0,duration-.1)]));rows=[]
 for t in times:
  key=f"analysis/keyframes/{asset_id}/{int(t*1000)}.jpg";dest=safe_path(key);dest.parent.mkdir(parents=True,exist_ok=True)
  try:
   subprocess.run(["ffmpeg","-nostdin","-y","-ss",str(t),"-i",str(path),"-frames:v","1","-vf","scale='min(1280,iw)':-2",str(dest)],capture_output=True,timeout=60,check=True)
   rows.append({"timestamp_seconds":t,"storage_key":key,"metadata":{"method":"ffmpeg","sourceTimestamp":t}})
  except Exception:pass
 return rows,None
def claim():
 with db() as conn:
  with conn.cursor() as cur:
   cur.execute("WITH c AS (SELECT id FROM asset_analysis_jobs WHERE status='queued' AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE asset_analysis_jobs j SET status='processing',attempt=attempt+1,lease_owner=%s,lease_expires_at=now()+interval '10 minutes',updated_at=now() FROM c WHERE j.id=c.id RETURNING j.*",(WORKER_ID,));return cur.fetchone()
def process(job):
 with db() as conn:
  with conn.cursor() as cur:cur.execute("SELECT * FROM media_assets WHERE id=%s AND project_id=%s",(job["asset_id"],job["project_id"]));asset=cur.fetchone()
 if not asset:raise RuntimeError("Asset missing")
 path=safe_path(asset["storage_key"])
 if not path.exists():raise RuntimeError("File missing from MEDIA_ROOT")
 if path.stat().st_size>MAX_BYTES:raise RuntimeError("Asset exceeds size limit")
 mime=asset["mime_type"];requested=job["requested_kinds"] or ["metadata","text"];warnings=[];chunks=[];extracts=[];frames=[]
 metadata=meta(path,asset);extracts.append(("metadata","completed",None,metadata,"stdlib",1.0))
 if "text" in requested:
  c,w=text_extract(path,mime);chunks+=c;warnings+=w;extracts.append(("text","completed" if c else "unavailable",None,{"chunks":len(c)},"built-in",1.0 if c else None))
 if "ocr" in requested and (mime.startswith("image/") or mime=="application/pdf"):
  text,w=ocr(path)
  if w:warnings.append(w)
  if text and text.strip():chunks.append({"kind":"ocr","content":text[:100000],"metadata":{"extractor":"pytesseract"}})
  extracts.append(("ocr","completed" if text else "unavailable",text[:100000] if text else None,{}, "pytesseract" if text else None,None))
 if "transcription" in requested and mime.startswith(("audio/","video/")):
  warnings.append("Transcription adapter not configured");extracts.append(("transcription","unavailable",None,{"reason":"adapter not configured"},None,None))
 if "vision" in requested and mime.startswith("image/"):
  warnings.append("Vision adapter not configured");extracts.append(("vision","unavailable",None,{"reason":"adapter not configured"},None,None))
 if mime.startswith(("audio/","video/")):
  info,w=probe(path)
  if info:metadata["probe"]=info
  if w:warnings.append(w)
  extracts.append(("metadata","completed" if info else "partial",None,metadata,"ffprobe" if info else "stdlib",1.0 if info else None))
 if mime.startswith("video/"):
  if "keyframes" in requested:
   frames,w=extract_keyframes(path,asset["id"])
   if w:warnings.append(w)
   extracts.append(("keyframes","completed" if frames else "unavailable",None,{"count":len(frames)},"ffmpeg" if frames else None,None))
  if "scene_detection" in requested:
   warnings.append("Scene boundary detection adapter not configured; sampled keyframes are not scene boundaries");extracts.append(("scene_detection","unavailable",None,{"reason":"not configured"},None,None))
 status="completed" if not warnings else "partial" if chunks or frames else "unavailable"
 with db() as conn:
  with conn.cursor() as cur:
   for x in extracts:cur.execute("INSERT INTO asset_extractions(asset_id,job_id,kind,status,content,structured,tool_name,confidence) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",(asset["id"],job["id"],x[0],x[1],x[2],json.dumps(x[3]),x[4],x[5]))
   for i,c in enumerate(chunks):cur.execute("INSERT INTO media_chunks(asset_id,project_id,kind,content,ordinal,page,start_seconds,end_seconds,metadata) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)",(asset["id"],asset["project_id"],c["kind"],c["content"],i,c.get("page"),c.get("start_seconds"),c.get("end_seconds"),json.dumps(c.get("metadata",{}))))
   for f in frames:cur.execute("INSERT INTO media_keyframes(asset_id,project_id,timestamp_seconds,storage_key,metadata) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(asset_id,timestamp_seconds) DO UPDATE SET storage_key=excluded.storage_key,metadata=excluded.metadata",(asset["id"],asset["project_id"],f["timestamp_seconds"],f["storage_key"],json.dumps(f["metadata"])))
   cur.execute("UPDATE media_assets SET analysis_status=%s,analysis_metadata=%s WHERE id=%s",(status,json.dumps({"warnings":warnings,"metadata":metadata,"chunkCount":len(chunks),"keyframeCount":len(frames)}),asset["id"]))
   cur.execute("UPDATE asset_analysis_jobs SET status=%s,error=%s,lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=%s",(status,"; ".join(warnings) if warnings else None,job["id"]))
def fail(job,error):
 with db() as conn:
  with conn.cursor() as cur:
   state="queued" if job["attempt"]<job["max_attempts"] else "failed"
   cur.execute("UPDATE asset_analysis_jobs SET status=%s,error=%s,lease_owner=NULL,lease_expires_at=NULL,available_at=now()+interval '15 seconds',updated_at=now() WHERE id=%s",(state,str(error)[:2000],job["id"]))
   cur.execute("UPDATE media_assets SET analysis_status=%s WHERE id=%s",(state,job["asset_id"]))
def main():
 print("AIVEDIO asset analysis worker started",WORKER_ID)
 while True:
  try:
   job=claim()
   if job:
    try:process(job)
    except Exception as e:fail(job,e);print("job failed",job["id"],repr(e))
    continue
  except Exception as e:print("poll error",repr(e))
  time.sleep(POLL)
if __name__=="__main__":main()
