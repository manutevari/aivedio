#!/usr/bin/env python3
"""AIVEDIO Phase 13 technical QA worker. Safety classification is intentionally not simulated."""
import os,json,time,uuid,subprocess,shutil,statistics
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
DATABASE_URL=os.getenv("DATABASE_URL");MEDIA_ROOT=Path(os.getenv("MEDIA_ROOT","./media")).resolve()
POLL=float(os.getenv("QA_WORKER_POLL_SECONDS","5"));WORKER_ID=os.getenv("QA_WORKER_ID",f"qa-{uuid.uuid4()}")
def db():
 if not DATABASE_URL:raise RuntimeError("DATABASE_URL missing")
 return psycopg.connect(DATABASE_URL,row_factory=dict_row)
def safe_path(key):
 p=(MEDIA_ROOT/key).resolve()
 if not p.is_relative_to(MEDIA_ROOT):raise ValueError("unsafe media path")
 return p
def probe(path):
 if not shutil.which("ffprobe"):return None,"ffprobe unavailable"
 try:
  r=subprocess.run(["ffprobe","-v","error","-show_format","-show_streams","-of","json",str(path)],capture_output=True,text=True,timeout=30,check=True)
  return json.loads(r.stdout),None
 except Exception as e:return None,"probe error: "+type(e).__name__
def findings(profile,expected):
 out=[]
 def add(code,sev,msg,repair,meta=None):out.append({"code":code,"category":"technical","severity":sev,"message":msg,"confidence":1.0,"recommendedRepair":repair,"metadata":meta or {}})
 if not profile.get("fileReadable"):add("FILE_UNREADABLE","critical","File unreadable","Re-upload or regenerate")
 kind=profile.get("kind")
 if kind in ("video","image"):
  w,h=profile.get("width"),profile.get("height")
  if not w or not h:add("DIMENSIONS_UNKNOWN","warning","Dimensions unavailable","Probe metadata")
  if expected.get("width") and w and w!=expected["width"]:add("WIDTH_MISMATCH","warning",f"Expected {expected['width']} px, got {w}","Reframe to target",{"expected":expected["width"],"actual":w})
  if expected.get("height") and h and h!=expected["height"]:add("HEIGHT_MISMATCH","warning",f"Expected {expected['height']} px, got {h}","Reframe to target",{"expected":expected["height"],"actual":h})
 if kind=="video":
  if not profile.get("fps"):add("FPS_UNKNOWN","warning","Frame rate unavailable","Probe/normalize frame rate")
  if expected.get("fps") and profile.get("fps") and abs(profile["fps"]-expected["fps"])>.05:add("FPS_MISMATCH","warning","Frame rate differs from target","Normalize frame rate")
  if profile.get("blackFrameSeconds"):add("BLACK_FRAMES","error","Black frames detected","Review timestamps and trim/regenerate",{"timestamps":profile["blackFrameSeconds"]})
  if any(x.get("duration",0)>=2 for x in profile.get("frozenIntervals",[])):add("FROZEN_VIDEO","warning","Frozen interval at least 2 seconds","Check holds or regenerate",{"intervals":profile["frozenIntervals"]})
 if profile.get("hasAudio"):
  if any(x.get("duration",0)>=5 for x in profile.get("silenceIntervals",[])):add("LONG_SILENCE","warning","Silence interval >=5 seconds","Review audio coverage",{"intervals":profile["silenceIntervals"]})
 dur=profile.get("durationSeconds")
 if dur is not None and expected.get("minDurationSeconds") is not None and dur<expected["minDurationSeconds"]:add("DURATION_TOO_SHORT","error","Below minimum duration","Extend/regenerate")
 if dur is not None and expected.get("maxDurationSeconds") is not None and dur>expected["maxDurationSeconds"]:add("DURATION_TOO_LONG","warning","Exceeds maximum duration","Trim")
 return out
def analyze(path,asset,expected):
 profile={"kind":"video" if asset["mime_type"].startswith("video/") else "audio" if asset["mime_type"].startswith("audio/") else "image" if asset["mime_type"].startswith("image/") else "document","mimeType":asset["mime_type"],"fileReadable":path.exists(),"durationSeconds":None,"hasAudio":False}
 info,warning=probe(path)
 if info:
  fmt=info.get("format",{});profile["durationSeconds"]=float(fmt.get("duration",0)) or None
  for s in info.get("streams",[]):
   if s.get("codec_type")=="video":
    profile.update(width=s.get("width"),height=s.get("height"),fps=rate(s.get("avg_frame_rate") or s.get("r_frame_rate")),hasVideo=True)
   if s.get("codec_type")=="audio":profile.update(hasAudio=True,audioSampleRate=s.get("sample_rate"),audioChannels=s.get("channels"))
  if profile["kind"]=="video" and shutil.which("ffmpeg"):
   try:
    cmd=["ffmpeg","-hide_banner","-nostdin","-i",str(path),"-vf","blackdetect=d=0.1:pix_th=0.10","-an","-f","null","-"]
    res=subprocess.run(cmd,capture_output=True,text=True,timeout=120)
    import re
    profile["blackFrameSeconds"]=[float(m.group(1)) for m in re.finditer(r"black_start:([0-9.]+)",res.stderr)]
   except Exception:profile["blackFrameSeconds"]=[]
 if warning:profile["probeWarning"]=warning
 return profile,findings(profile,expected)
def rate(v):
 try:
  a,b=v.split("/")
  return float(a)/float(b) if float(b) else None
 except:return None
def claim():
 with db() as c:
  with c.cursor() as cur:
   cur.execute("UPDATE quality_jobs SET status='failed',error=COALESCE(error,'Worker lease expired after maximum attempts'),lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE status='processing' AND lease_expires_at<now() AND attempt>=max_attempts")
   cur.execute("WITH q AS(SELECT id FROM quality_jobs WHERE ((status='queued' AND available_at<=now()) OR (status='processing' AND lease_expires_at<now() AND attempt<max_attempts)) ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE quality_jobs j SET status='processing',attempt=attempt+1,lease_owner=%s,lease_expires_at=now()+interval '10 minutes',updated_at=now() FROM q WHERE j.id=q.id RETURNING j.*",(WORKER_ID,));return cur.fetchone()
def score(fs):return max(0,100-sum({"info":0,"warning":5,"error":18,"critical":40}.get(x["severity"],0) for x in fs))
def status(fs):return "fail" if any(x["severity"] in ("error","critical") for x in fs) else "warning" if any(x["severity"]=="warning" for x in fs) else "pass"
def process(j):
 with db() as c:
  with c.cursor() as cur:cur.execute("SELECT * FROM media_assets WHERE id=%s AND project_id=%s",(j["asset_id"],j["project_id"]));a=cur.fetchone()
 if not a:raise RuntimeError("asset missing")
 path=safe_path(a["storage_key"])
 if not path.exists():raise RuntimeError("asset file missing")
 profile,fs=analyze(path,a,j["expected_profile"] or {})
 st=status(fs);sc=score(fs)
 # Safety remains unavailable: no fake classifier result. Human review required.
 safety={"verdict":"unavailable","stage":"asset","policyVersion":"phase13-no-classifier-v1","reasonCodes":["SAFETY_CLASSIFIER_NOT_CONFIGURED"],"confidence":None,"reviewRequired":True}
 action="BLOCK" if st=="fail" and any(x["severity"]=="critical" for x in fs) else "HITL_REVIEW"
 report={"status":st,"score":sc,"findings":fs,"metrics":profile,"safety":safety,"decision":{"action":action,"reasons":["Safety classifier not configured; human review required"]}}
 with db() as c:
  with c.cursor() as cur:
   cur.execute("SELECT status,lease_owner FROM quality_jobs WHERE id=%s FOR UPDATE",(j["id"],))
   lease=cur.fetchone()
   if not lease or lease["status"]!="processing" or lease["lease_owner"]!=WORKER_ID:raise RuntimeError("Quality worker lease lost")
   cur.execute("INSERT INTO quality_reports(project_id,asset_id,job_id,stage,status,score,action,safety_verdict,report) VALUES(%s,%s,%s,'technical',%s,%s,%s,%s,%s) RETURNING id",(j["project_id"],a["id"],j["id"],st,sc,action,safety["verdict"],json.dumps(report)))
   rid=cur.fetchone()["id"]
   cur.execute("INSERT INTO safety_reviews(project_id,asset_id,report_id,stage,verdict,reason_codes,policy_version) VALUES(%s,%s,%s,%s,%s,%s,%s)",(j["project_id"],a["id"],rid,"asset",safety["verdict"],json.dumps(safety["reasonCodes"]),safety["policyVersion"]))
   cur.execute("UPDATE quality_jobs SET status='completed',lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=%s AND lease_owner=%s",(j["id"],WORKER_ID))
   if cur.rowcount!=1:raise RuntimeError("Quality worker lease lost during persistence")
def fail(j,e):
 with db() as c:
  with c.cursor() as cur:
   st="queued" if j["attempt"]<j["max_attempts"] else "failed"
   cur.execute("UPDATE quality_jobs SET status=%s,error=%s,lease_owner=NULL,lease_expires_at=NULL,available_at=now()+interval '20 seconds',updated_at=now() WHERE id=%s",(st,str(e)[:1000],j["id"]))
def main():
 print("AIVEDIO Phase 13 QA worker",WORKER_ID)
 while True:
  try:
   j=claim()
   if j:
    try:process(j)
    except Exception as e:fail(j,e);print("job error",repr(e))
    continue
  except Exception as e:print("poll error",repr(e))
  time.sleep(POLL)
if __name__=="__main__":main()
