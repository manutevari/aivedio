import os, requests, streamlit as st
API=os.getenv("AIVEDIO_API_URL","http://localhost:3000").rstrip("/")
st.set_page_config(page_title="AIVEDIO Studio",page_icon="🎬",layout="wide")
st.markdown("""<style>.stApp{background:#080b14;color:#e7eaf5}[data-testid=stSidebar]{background:#0b0f1a}div[data-testid=stMetric]{background:#111827;border:1px solid #273149;padding:12px;border-radius:12px}</style>""",unsafe_allow_html=True)
def api(path,method="GET",data=None):
 r=requests.request(method,API+path,json=data,timeout=10);r.raise_for_status();return r.json() if r.content else None
if "project" not in st.session_state:st.session_state.project=None
if "scene_id" not in st.session_state:st.session_state.scene_id=None
with st.sidebar:
 st.title("🎬 AIVEDIO");st.caption("Universal AI Creative Studio")
 try:st.success(api("/health").get("status","connected"))
 except Exception:st.error("API offline · persistence disabled")
 st.header("Workspace")
 page=st.radio("Open",["Projects","Flow / Storyboard","Assets Library","Generation Jobs","Studio / Timeline"])
 st.divider()
 title=st.text_input("New project title",key="new_project_title")
 if st.button("＋ Create Project",use_container_width=True) and title:
  try:st.session_state.project=api("/v1/projects","POST",{"title":title,"mode":"flow"});st.success("Created")
  except Exception as e:st.error(str(e))
try:projects=api("/v1/projects")
except Exception as e:projects=[];st.error(f"API not available: {e}")
if projects:
 choices={p["title"]:p["id"] for p in projects}
 chosen=st.selectbox("Project",list(choices),index=list(choices.values()).index(st.session_state.project["id"]) if st.session_state.project and st.session_state.project["id"] in choices.values() else 0)
 project_id=choices[chosen];st.session_state.project=next(p for p in projects if p["id"]==project_id)
else:project_id=None
st.title("AIVEDIO · "+(st.session_state.project.get("title","Studio") if st.session_state.project else "Studio"))
if page=="Projects":
 st.subheader("Projects")
 if projects:st.dataframe(projects,use_container_width=True)
 st.info("Project records are loaded from the API.")
elif page=="Flow / Storyboard":
 if not project_id:st.warning("Create or select a project first.")
 else:
  scenes=api(f"/v1/projects/{project_id}/scenes")
  l,c,r=st.columns([1,2,1])
  with l:
   st.subheader(f"Scenes · {len(scenes)}")
   for s in scenes:
    if st.button(f"{s.get('scene_order',0)+1} · {s['title']}",key=s["id"]):st.session_state.scene_id=s["id"]
   if st.button("＋ Add Scene"):
    new=api(f"/v1/projects/{project_id}/scenes","POST",{"title":f"Scene {len(scenes)+1}","prompt":"","durationSeconds":10,"sceneOrder":len(scenes)});st.session_state.scene_id=new["id"];st.rerun()
  current=next((s for s in scenes if s["id"]==st.session_state.scene_id),scenes[0] if scenes else None)
  with c:
   st.subheader(current["title"] if current else "Scene")
   st.markdown('<div style="height:240px;border-radius:14px;background:radial-gradient(circle at 70% 35%,#167fa6,#17385e,#10182b,#060914);display:grid;place-items:center;font-size:64px">🌌</div>',unsafe_allow_html=True)
   if current:
    with st.form("scene_form"):
     prompt=st.text_area("Prompt",value=current.get("prompt") or "")
     st.text_input("Title",value=current["title"],disabled=True)
     save=st.form_submit_button("Save Scene")
     if save:api(f"/v1/scenes/{current['id']}","PATCH",{"prompt":prompt});st.success("Saved")
  with r:
   st.subheader("Production")
   st.caption("Provider routing is backend-controlled.")
   st.write("Auto routing · capability matching · free-tier policy")
elif page=="Assets Library":
 if not project_id:st.warning("Select a project.")
 else:
  assets=api(f"/v1/assets?projectId={project_id}")
  st.subheader(f"Assets · {len(assets)}")
  for a in assets:
   with st.expander(f"{a['kind']} · {a['status']} · {a['id']}"):
    st.write(a.get("storage_key"),a.get("mime_type"))
    if a["status"]=="quarantined":
     reviewer=st.text_input("Reviewer",key="rev_"+a["id"]);x,y=st.columns(2)
     if x.button("Approve",key="approve_"+a["id"]):api(f"/v1/assets/{a['id']}/review","POST",{"decision":"approve","reviewer":reviewer or "Streamlit reviewer"});st.success("Approved")
     if y.button("Reject",key="reject_"+a["id"]):api(f"/v1/assets/{a['id']}/review","POST",{"decision":"reject","reviewer":reviewer or "Streamlit reviewer"});st.success("Rejected")
elif page=="Generation Jobs":
 jobs=api(f"/v1/generation-jobs?projectId={project_id}") if project_id else api("/v1/generation-jobs")
 st.subheader(f"Generation Queue · {len(jobs)}")
 for j in jobs:
  with st.expander(f"{j['task']} · {j['status']} · {j['id']}"):
   st.write("Safety:",j.get("safety_status"),"Quality:",j.get("quality_status"));st.write(j.get("error"))
   if j["status"]=="awaiting_approval":
    reviewer=st.text_input("Reviewer",key="jobrev_"+j["id"]);a,b=st.columns(2)
    if a.button("Approve",key="jobapprove_"+j["id"]):api(f"/v1/generation-jobs/{j['id']}/review","POST",{"decision":"approve","reviewer":reviewer or "Streamlit reviewer"});st.success("Approved; queued")
    if b.button("Reject",key="jobreject_"+j["id"]):api(f"/v1/generation-jobs/{j['id']}/review","POST",{"decision":"reject","reviewer":reviewer or "Streamlit reviewer"});st.success("Rejected")
elif page=="Studio / Timeline":
 st.subheader("Timeline / Production Overview")
 if project_id:
  scenes=api(f"/v1/projects/{project_id}/scenes")
  for s in scenes:st.markdown(f"**Scene {s.get('scene_order',0)+1} · {s['title']}** — {s.get('duration_seconds',10)} sec")
  st.caption("Timeline is currently read-only preview; editing/render/export will follow.")
