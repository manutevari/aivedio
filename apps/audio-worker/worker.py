#!/usr/bin/env python3
"""AIVEDIO Phase 15 audio analysis worker; no automatic safety clearance or audio repair."""
import os,time,uuid,json,subprocess,shutil,re,math
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
DATABASE_URL=os.getenv("DATABASE_URL");MEDIA_ROOT=Path(os.getenv("MEDIA_ROOT","./media")).resolve();POLL=float(os.getenv("AUDIO_WORKER_POLL_SECONDS","5"));WORKER_ID=os.getenv("AUDIO_WORKER_ID",f"audio-{uuid.uuid4()}")
def db():
 if not DATABASE_URL:raise RuntimeError("DATABASE_URL missing")
 return psycopg.connect(DATABASE_URL,row_factory=dict_row)
def safe_path(key):
 p=(MEDIA_ROOT/key).resolve()
 if not p.is_relative_to(MEDIA_ROOT):raise ValueError("unsafe storage key")
 return p
def run(cmd,timeout=180):
 return subprocess.run(cmd,capture_output=True,text=True,timeout=timeout,check=False)
def analyze(path):
 metrics={"durationSeconds":None,"sampleRate":None,"channels":None,"integratedLufs":None,"loudnessRangeLufs":None,"truePeakDbtp":None,"samplePeakDbfs":None,"rmsDbfs":None,"clippingSamples":None,"silenceIntervals":[],"syncOffsetMs":None,"analysisAvailable":False,"warnings":[]}
 if not shutil.which("ffprobe"):metrics["warnings"].append("ffprobe unavailable");return metrics
 p=run(["ffprobe","-v","error","-show_format","-show_streams","-of","json",str(path)],30)
 if p.returncode!=0:metrics["warnings"].append("ffprobe failed");return metrics
 info=json.loads(p.stdout);metrics["durationSeconds"]=float(info.get("format",{}).get("duration",0)) or None
 audio=[s for s in info.get("streams",[]) if s.get("codec_type")=="audio"]
 if not audio:metrics["warnings"].append("No audio stream");return metrics
 s=audio[0];metrics["sampleRate"]=int(s.get("sample_rate",0)) or None;metrics["channels"]=s.get("channels")
 if not shutil.which("ffmpeg"):metrics["warnings"].append("ffmpeg unavailable");return metrics
 # Loudness and peak/rms via ebur128 + astats
 e=run(["ffmpeg","-hide_banner","-nostdin","-i",str(path),"-filter_complex","ebur128=peak=true","-f","null","-"],180)
 a=run(["ffmpeg","-hide_banner","-nostdin","-i",str(path),"-af","astats=metadata=1:reset=0","-f","null","-"],180)
 sil=run(["ffmpeg","-hide_banner","-nostdin","-i",str(path),"-af","silencedetect=noise=-45dB:d=1","-f","null","-"],180)
 text=e.stderr+"\n"+a.stderr
 def last(pattern):
  m=list(re.finditer(pattern,text,re.I))
  return float(m[-1].group(1)) if m else None
 metrics["integratedLufs"]=last(r"Integrated loudness:\s*I:\s*(-?[0-9.]+) LUFS")
 metrics["loudnessRangeLufs"]=last(r"Loudness range:\s*LRA:\s*([0-9.]+) LU")
 metrics["truePeakDbtp"]=last(r"True peak:\s*Peak:\s*(-?[0-9.]+) dBFS")
 metrics["samplePeakDbfs"]=last(r"Peak level dB:\s*(-?[0-9.]+)")
 metrics["rmsDbfs"]=last(r" RMS level dB:\s*(-?[0-9.]+)")
 cl=last(r"Number of samples clipped:\s*([0-9.]+)")
 metrics["clippingSamples"]=int(cl) if cl is not None else None
 starts=re.findall(r"silence_start:\s*([0-9.]+)",sil.stderr);ends=re.findall(r"silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)",sil.stderr)
 for i,(end,dur) in enumerate(ends):
  start=float(starts[i]) if i<len(starts) else max(0,float(end)-float(dur))
  metrics["silenceIntervals"].append({"start":start,"end":float(end),"duration":float(dur)})
 metrics["analysisAvailable"]=e.returncode==0 and a.returncode==0 and sil.returncode==0
 if not metrics["analysisAvailable"]:metrics["warnings"].append("One or more FFmpeg analysis passes failed")
 if metrics["integratedLufs"] is None:metrics["warnings"].append("Integrated loudness not parsed")
 if metrics["truePeakDbtp"] is None:metrics["warnings"].append("True peak not parsed")
 return metrics
def claim():
 with db() as c:
  with c.cursor() as cur:
   cur.execute("WITH q AS(SELECT id FROM audio_analysis_jobs WHERE status='queued' AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE audio_analysis_jobs j SET status='processing',attempt=attempt+1,lease_owner=%s,lease_expires_at=now()+interval '10 minutes',updated_at=now() FROM q WHERE j.id=q.id RETURNING j.*",(WORKER_ID,));return cur.fetchone()
def findings(metrics,thresholds):
 out=[]
 def add(code,severity,msg,metadata=None):out.append({"code":code,"severity":severity,"message":msg,"confidence":1.0,"metadata":metadata or {}})
 if not metrics["analysisAvailable"]:add("ANALYSIS_UNAVAILABLE","warning","Configured FFmpeg analysis unavailable")
 if metrics["clippingSamples"] is not None and metrics["clippingSamples"]>thresholds.get("maxClippingSamples",0):add("AUDIO_CLIPPING","error","Clipped samples detected",{"count":metrics["clippingSamples"]})
 if metrics["truePeakDbtp"] is not None and thresholds.get("maxTruePeakDbtp") is not None and metrics["truePeakDbtp"]>thresholds["maxTruePeakDbtp"]:add("TRUE_PEAK_ABOVE_TARGET","warning","True peak exceeds target",{"peak":metrics["truePeakDbtp"]})
 if metrics["rmsDbfs"] is not None and thresholds.get("minRmsDbfs") is not None and metrics["rmsDbfs"]<thresholds["minRmsDbfs"]:add("AUDIO_LEVEL_BELOW_TARGET","warning","RMS below target",{"rms":metrics["rmsDbfs"]})
 for s in metrics["silenceIntervals"]:
  if s["duration"]>=thresholds.get("maxSilenceSeconds",5):add("LONG_AUDIO_SILENCE","warning","Long silence detected",s)
 return out
def process(job):
 with db() as c:
  with c.cursor() as cur:cur.execute("SELECT * FROM media_assets WHERE id=%s AND project_id=%s",(job["asset_id"],job["project_id"]));asset=cur.fetchone()
 if not asset:raise RuntimeError("asset missing")
 path=safe_path(asset["storage_key"])
 if not path.exists():raise RuntimeError("media file missing")
 metrics=analyze(path);fs=findings(metrics,job["thresholds"] or {})
 score=max(0,100-sum(25 if f["severity"]=="error" else 8 for f in fs))
 status="fail" if any(f["severity"]=="error" for f in fs) else "warning" if fs else "pass"
 with db() as c:
  with c.cursor() as cur:
   cur.execute("INSERT INTO audio_analysis_reports(project_id,asset_id,job_id,status,score,metrics,findings,thresholds) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",(job["project_id"],asset["id"],job["id"],status,score,json.dumps(metrics),json.dumps(fs),json.dumps(job["thresholds"] or {})))
   cur.execute("UPDATE audio_analysis_jobs SET status='completed',lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=%s",(job["id"],))
def fail(j,e):
 with db() as c:
  with c.cursor() as cur:
   status="queued" if j["attempt"]<j["max_attempts"] else "failed"
   cur.execute("UPDATE audio_analysis_jobs SET status=%s,error=%s,lease_owner=NULL,lease_expires_at=NULL,available_at=now()+interval '20 seconds',updated_at=now() WHERE id=%s",(status,str(e)[:1000],j["id"]))
def main():
 print("AIVEDIO Audio QA worker",WORKER_ID)
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
