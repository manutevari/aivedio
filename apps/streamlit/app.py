import os, requests, streamlit as st
API=os.getenv("AIVEDIO_API_URL","http://localhost:3000").rstrip("/")
st.set_page_config(page_title="AIVEDIO Studio",page_icon="🎬",layout="wide")
st.markdown("""<style>.stApp{background:#080b14;color:#e7eaf5}[data-testid=stSidebar]{background:#0b0f1a}div[data-testid=stMetric]{background:#111827;border:1px solid #273149;padding:12px;border-radius:12px}.stButton>button{border-radius:8px}</style>""",unsafe_allow_html=True)
def api(path,method="GET",data=None):
 r=requests.request(method,API+path,json=data,timeout=20);r.raise_for_status();return r.json() if r.content else None
def safe(path,default):
 try:return api(path)
 except Exception:return default
if "project" not in st.session_state:st.session_state.project=None
if "scene_id" not in st.session_state:st.session_state.scene_id=None
if "plan_id" not in st.session_state:st.session_state.plan_id=None
if "script_id" not in st.session_state:st.session_state.script_id=None
if "cut_id" not in st.session_state:st.session_state.cut_id=None
if "audio_id" not in st.session_state:st.session_state.audio_id=None
with st.sidebar:
 st.title("🎬 AIVEDIO");st.caption("Universal AI Creative Studio")
 try:st.success(api("/health").get("status","connected"))
 except Exception:st.error("API offline · persistence disabled")
 page=st.radio("Workspace",["Overview","Creative Plan","Script","Storyboard","Assets","Flow Library","Timeline","Audio","Quality & Safety","Renders","Generation Jobs"])
 st.divider();title=st.text_input("New production title")
 brief=st.text_area("Creative brief",height=100)
 if st.button("＋ Create project",use_container_width=True) and title:
  try:st.session_state.project=api("/v1/projects","POST",{"title":title,"mode":"flow","creativeBrief":brief});st.success("Project created")
  except Exception as e:st.error(str(e))
projects=safe("/v1/projects",[])
if projects:
 choices={p["title"]:p["id"] for p in projects}
 selected=st.selectbox("Project",list(choices),index=list(choices.values()).index(st.session_state.project["id"]) if st.session_state.project and st.session_state.project["id"] in choices.values() else 0)
 project_id=choices[selected];st.session_state.project=next(p for p in projects if p["id"]==project_id)
else:project_id=None
st.title("AIVEDIO · "+(st.session_state.project.get("title","Studio") if st.session_state.project else "Studio"))
if not project_id:st.info("Create or select a production to start.")
else:
 scenes=safe(f"/v1/projects/{project_id}/scenes",[])
 assets=safe(f"/v1/assets?projectId={project_id}",[])
 jobs=safe(f"/v1/generation-jobs?projectId={project_id}",[])
 timeline=safe(f"/v1/projects/{project_id}/timeline",{"tracks":[],"clips":[]})
 plans=safe(f"/v1/projects/{project_id}/creative-plans",[])
 scripts=safe(f"/v1/projects/{project_id}/script-packages",[])
 cuts=safe(f"/v1/projects/{project_id}/production-cuts",[])
 audio_plans=safe(f"/v1/projects/{project_id}/audio-plans",[])
 quality=safe(f"/v1/projects/{project_id}/quality/reports",[])
 safety=safe(f"/v1/projects/{project_id}/safety/reviews",[])
 renders=safe(f"/v1/projects/{project_id}/render-jobs",[])
 refs=safe(f"/v1/projects/{project_id}/flow/references",[])
 characters=safe(f"/v1/projects/{project_id}/flow/characters",[])
 reviewer=st.text_input("Reviewer identity",value="Streamlit reviewer",key="reviewer")
 if page=="Overview":
  a,b,c,d=st.columns(4);a.metric("Scenes",len(scenes));b.metric("Assets",len(assets));c.metric("Generation jobs",len(jobs));d.metric("Render jobs",len(renders))
  st.subheader("Production pipeline")
  for name,count in [("Creative Plan",len(plans)),("Script Packages",len(scripts)),("Storyboard",len(scenes)),("Assets",len(assets)),("Timeline Clips",len(timeline.get("clips",[]))),("Audio Plans",len(audio_plans)),("QA Reports",len(quality)),("Renders",len(renders))]:
   st.write(f"**{name}** · {count}")
  st.info("Safety approval, technical QA and render delivery review are separate gates.")
 elif page=="Creative Plan":
  st.subheader("Creative Director")
  with st.form("plan_form"):
   b=st.text_area("Brief",value=st.session_state.project.get("creative_brief") or brief)
   duration=st.number_input("Target duration (seconds)",min_value=10,max_value=43200,value=60)
   fmt=st.selectbox("Format",["general","film","short_video","advertisement","documentary","explainer","music_video","animation"])
   submitted=st.form_submit_button("Generate plan")
  if submitted:
   try:
    p=api(f"/v1/projects/{project_id}/creative-plans","POST",{"projectTitle":selected,"brief":b,"format":fmt,"targetDurationSeconds":duration,"aspectRatio":"16:9","resolution":"1080p","language":"English","genre":[],"mood":[],"visualStyle":"Cinematic, continuity-conscious"});st.session_state.plan_id=p["id"];st.success("Plan drafted")
   except Exception as e:st.error(str(e))
  for p in plans:
   with st.expander(f"Plan v{p.get('version')} · {p.get('status','draft')}"):
    detail=safe(f"/v1/projects/{project_id}/creative-plans/{p['id']}",p)
    content=detail.get("plan",{})
    st.write(content.get("logline"));st.json(content.get("scenes",[]))
    if p.get("status")!="approved" and st.button("Approve plan",key="planapprove"+p["id"]):
     try:api(f"/v1/projects/{project_id}/creative-plans/{p['id']}/approve","POST",{"reviewer":reviewer});st.success("Approved")
     except Exception as e:st.error(str(e))
 elif page=="Script":
  if plans:
   approved=[p for p in plans if p.get("status")=="approved"]
   p=st.selectbox("Approved plan",approved or plans,format_func=lambda x:f"Plan v{x.get('version')} · {x.get('status')}")
   if st.button("Generate script",disabled=not approved):
    try:s=api(f"/v1/projects/{project_id}/creative-plans/{p['id']}/script-packages","POST",{});st.session_state.script_id=s["id"];st.success("Script created for review")
    except Exception as e:st.error(str(e))
  for s in scripts:
   with st.expander(f"Script v{s.get('version')} · {s.get('status')}"):
    d=safe(f"/v1/projects/{project_id}/script-packages/{s['id']}",s);content=d.get("content",{});st.write(content.get("logline"));st.json(content.get("scenes",[]));st.json(d.get("validation",{}))
    x,y=st.columns(2)
    if s.get("status")=="awaiting_review":
     if x.button("Approve",key="scriptok"+s["id"]):
      try:api(f"/v1/projects/{project_id}/script-packages/{s['id']}/review","POST",{"decision":"approve","reviewer":reviewer});st.success("Approved")
      except Exception as e:st.error(str(e))
     if y.button("Reject",key="scriptno"+s["id"]):
      try:api(f"/v1/projects/{project_id}/script-packages/{s['id']}/review","POST",{"decision":"reject","reviewer":reviewer});st.success("Rejected")
      except Exception as e:st.error(str(e))
 elif page=="Storyboard":
  left,right=st.columns([1,2]); 
  with left:
   st.subheader(f"Scenes · {len(scenes)}")
   for s in scenes:
    if st.button(f"{s.get('scene_order',0)+1}. {s['title']}",key="scene"+s["id"]):st.session_state.scene_id=s["id"]
   if st.button("＋ Add scene"):
    try:n=api(f"/v1/projects/{project_id}/scenes","POST",{"title":f"Scene {len(scenes)+1}","prompt":"","durationSeconds":10,"sceneOrder":len(scenes)});st.session_state.scene_id=n["id"];st.rerun()
    except Exception as e:st.error(str(e))
  current=next((s for s in scenes if s["id"]==st.session_state.scene_id),scenes[0] if scenes else None)
  with right:
   if current:
    with st.form("scene_editor"):
     prompt=st.text_area("Scene prompt",value=current.get("prompt") or "",height=180)
     st.caption(f"Duration: {current.get('duration_seconds',10)}s · Status: {current.get('status','draft')}")
     if st.form_submit_button("Save scene"):
      try:api(f"/v1/scenes/{current['id']}","PATCH",{"prompt":prompt});st.success("Saved")
      except Exception as e:st.error(str(e))
   else:st.info("Select or add a scene.")
 elif page=="Assets":
  st.subheader(f"Assets · {len(assets)}")
  for a in assets:
   with st.expander(f"{a['kind']} · {a['status']} · {a['id']}"):
    st.write(a.get("storage_key"),a.get("mime_type"))
    x,y,z=st.columns(3)
    if x.button("Analyze",key="an"+a["id"]):
     try:api(f"/v1/projects/{project_id}/assets/{a['id']}/analyze","POST",{});st.success("Queued")
     except Exception as e:st.error(str(e))
    if y.button("Technical QA",key="qa"+a["id"]):
     try:api(f"/v1/projects/{project_id}/quality/assets/{a['id']}/jobs","POST",{});st.success("Queued")
     except Exception as e:st.error(str(e))
    if a["status"]=="quarantined":
     if z.button("Approve asset",key="ap"+a["id"]):
      try:api(f"/v1/assets/{a['id']}/review","POST",{"decision":"approve","reviewer":reviewer});st.success("Approved")
      except Exception as e:st.error(str(e))
 elif page=="Flow Library":
  with st.form("reference_form"):
   label=st.text_input("Reference label");uri=st.text_input("URI / storage key");kind=st.selectbox("Type",["image","video","audio","document","style"])
   if st.form_submit_button("Add reference"):
    try:api(f"/v1/projects/{project_id}/flow/references","POST",{"kind":kind,"label":label,"uri":uri,"tags":["streamlit"]});st.success("Saved")
    except Exception as e:st.error(str(e))
  st.subheader("References");st.dataframe(refs,use_container_width=True)
  st.subheader("Characters");st.dataframe(characters,use_container_width=True)
 elif page=="Timeline":
  st.subheader("Production cuts")
  approved=[s for s in scripts if s.get("status")=="approved"]
  if approved:
   script=st.selectbox("Approved script package",approved,format_func=lambda x:f"Script v{x.get('version')}")
   if st.button("Compile production cut"):
    try:c=api(f"/v1/projects/{project_id}/production-cuts","POST",{"scriptPackageId":script["id"]});st.success("Cut created")
    except Exception as e:st.error(str(e))
  for c in cuts:
   with st.expander(f"Cut v{c.get('version')} · {c.get('status')} · readiness {c.get('readiness_score')}%"):
    d=safe(f"/v1/projects/{project_id}/production-cuts/{c['id']}",c);st.json(d.get("content",{}))
    if c.get("status")=="draft" and c.get("readiness")=="ready" and st.button("Apply cut",key="cut"+c["id"]):
     try:api(f"/v1/projects/{project_id}/production-cuts/{c['id']}/apply","POST",{});st.success("Applied to timeline")
     except Exception as e:st.error(str(e))
  st.subheader("Timeline tracks");st.dataframe(timeline.get("tracks",[]),use_container_width=True)
  st.subheader("Clips");st.dataframe(timeline.get("clips",[]),use_container_width=True)
  if st.button("Validate edit manifest"):
   try:m=api(f"/v1/projects/{project_id}/timeline/manifest");st.json(m.get("validation",{}))
   except Exception as e:st.error(str(e))
 elif page=="Audio":
  applied=[c for c in cuts if c.get("status")=="applied"]
  if applied:
   cut=st.selectbox("Applied production cut",applied,format_func=lambda x:f"Cut v{x.get('version')}")
   if st.button("Create audio plan"):
    try:a=api(f"/v1/projects/{project_id}/production-cuts/{cut['id']}/audio-plans","POST",{});st.success("Audio plan drafted")
    except Exception as e:st.error(str(e))
  for a in audio_plans:
   with st.expander(f"Audio plan v{a.get('version')} · {a.get('status')}"):
    d=safe(f"/v1/projects/{project_id}/audio-plans/{a['id']}",a);content=d.get("content",{});st.json(content.get("cues",[]))
    x,y,z=st.columns(3)
    if a.get("status")=="draft":
     if x.button("Approve audio",key="audioapprove"+a["id"]):
      try:api(f"/v1/projects/{project_id}/audio-plans/{a['id']}/review","POST",{"decision":"approve","reviewer":reviewer});st.success("Approved")
      except Exception as e:st.error(str(e))
     if y.button("Reject",key="audioreject"+a["id"]):
      try:api(f"/v1/projects/{project_id}/audio-plans/{a['id']}/review","POST",{"decision":"reject","reviewer":reviewer});st.success("Rejected")
      except Exception as e:st.error(str(e))
    if a.get("status")=="approved" and z.button("Apply audio tracks",key="audioapply"+a["id"]):
     try:api(f"/v1/projects/{project_id}/audio-plans/{a['id']}/apply","POST",{});st.success("Applied")
     except Exception as e:st.error(str(e))
 elif page=="Quality & Safety":
  st.subheader("QA reports")
  for q in quality:
   with st.expander(f"{q.get('stage')} · {q.get('status')} · Safety {q.get('safety_verdict')}"):
    st.json(q.get("report",{}))
    x,y,z=st.columns(3)
    if x.button("Clear",key="clear"+q["id"]):
     try:api(f"/v1/projects/{project_id}/quality/reports/{q['id']}/safety-review","POST",{"decision":"clear","reviewer":reviewer,"notes":"Reviewed in Streamlit"});st.success("Clear recorded")
     except Exception as e:st.error(str(e))
    if y.button("Block",key="block"+q["id"]):
     try:api(f"/v1/projects/{project_id}/quality/reports/{q['id']}/safety-review","POST",{"decision":"block","reviewer":reviewer,"notes":"Reviewed in Streamlit"});st.success("Blocked")
     except Exception as e:st.error(str(e))
    if z.button("Needs changes",key="changes"+q["id"]):
     try:api(f"/v1/projects/{project_id}/quality/reports/{q['id']}/safety-review","POST",{"decision":"needs_changes","reviewer":reviewer,"notes":"Reviewed in Streamlit"});st.success("Marked")
     except Exception as e:st.error(str(e))
  st.subheader("Safety review history");st.dataframe(safety,use_container_width=True)
 elif page=="Renders":
  col1,col2=st.columns(2)
  profile=col1.selectbox("Resolution",["720p","1080p","4K"])
  subtitle=col2.selectbox("Subtitle mode",["sidecar","burn_in","none"])
  if st.button("Create render from timeline"):
   w,h={"720p":(1280,720),"1080p":(1920,1080),"4K":(3840,2160)}[profile]
   try:api(f"/v1/projects/{project_id}/render-jobs","POST",{"profile":{"container":"mp4","videoCodec":"h264","audioCodec":"aac","width":w,"height":h,"fps":24,"quality":"standard","audioSampleRate":48000},"options":{"subtitleMode":subtitle}});st.success("Render job created")
   except Exception as e:st.error(str(e))
  for r in renders:
   with st.expander(f"{r.get('status')} · {r.get('stage')} · {int((r.get('progress') or 0)*100)}%"):
    st.json(r.get("qa_report",{}))
    if r.get("status")=="awaiting_review":
     x,y=st.columns(2)
     if x.button("Approve delivery",key="renderok"+r["id"]):
      try:api(f"/v1/render-jobs/{r['id']}/review","POST",{"decision":"approve","reviewer":reviewer,"notes":"Reviewed in Streamlit"});st.success("Approved")
      except Exception as e:st.error(str(e))
     if y.button("Reject render",key="renderno"+r["id"]):
      try:api(f"/v1/render-jobs/{r['id']}/review","POST",{"decision":"reject","reviewer":reviewer,"notes":"Reviewed in Streamlit"});st.success("Rejected")
      except Exception as e:st.error(str(e))
 elif page=="Generation Jobs":
  st.subheader("Generation jobs")
  for j in jobs:
   with st.expander(f"{j.get('task')} · {j.get('status')}"):
    st.write("Safety:",j.get("safety_status"),"Quality:",j.get("quality_status"));st.write(j.get("error"))
    if j.get("status")=="awaiting_approval":
     x,y=st.columns(2)
     if x.button("Approve",key="jobok"+j["id"]):
      try:api(f"/v1/generation-jobs/{j['id']}/review","POST",{"decision":"approve","reviewer":reviewer,"notes":"Reviewed in Streamlit"});st.success("Approved")
      except Exception as e:st.error(str(e))
     if y.button("Reject",key="jobno"+j["id"]):
      try:api(f"/v1/generation-jobs/{j['id']}/review","POST",{"decision":"reject","reviewer":reviewer,"notes":"Reviewed in Streamlit"});st.success("Rejected")
      except Exception as e:st.error(str(e))
