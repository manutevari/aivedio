import os
import requests
import streamlit as st

API=str(st.secrets.get("AIVEDIO_API_URL",os.getenv("AIVEDIO_API_URL","http://localhost:3000"))).rstrip("/")
st.set_page_config(page_title="AIVEDIO Studio",page_icon="🎬",layout="wide")
st.markdown("""<style>.stApp{background:#080b14;color:#e7eaf5}[data-testid=stSidebar]{background:#0b0f1a}div[data-testid=stMetric]{background:#111827;border:1px solid #273149;padding:12px;border-radius:12px}input,textarea,[data-baseweb="input"],[data-baseweb="textarea"]{background:#f8fafc!important;color:#111827!important;border-radius:10px!important}input::placeholder,textarea::placeholder{color:#64748b!important}button[kind="primary"],button[kind="secondary"],[data-testid="stFormSubmitButton"] button{background:#e5e7eb!important;color:#111827!important;border:1px solid #9ca3af!important;font-weight:600!important}button[kind="primary"]:hover,button[kind="secondary"]:hover{background:#cbd5e1!important;color:#0f172a!important}[data-testid="stTabs"] button{color:#e5e7eb!important;white-space:nowrap}</style>""",unsafe_allow_html=True)

def api(path,method="GET",data=None):
    token=st.session_state.get("aivedio_session","")
    headers={"Authorization":"Bearer "+token} if token else {}
    response=requests.request(method,API+path,json=data,headers=headers,timeout=20)
    response.raise_for_status()
    return response.json() if response.content else None

def safe(path,default):
    try:
        return api(path)
    except Exception:
        return default

def api_connection_message():
    if API.startswith(("http://localhost", "http://127.0.0.1")):
        return "AIVEDIO API is configured as localhost. On Streamlit Cloud, localhost is the Streamlit container—not your API server. Deploy the API service and set AIVEDIO_API_URL in Streamlit Cloud → App settings → Secrets."
    return f"Cannot connect to the AIVEDIO API at {API}. Verify AIVEDIO_API_URL, that the API is running, and that its /health endpoint is reachable."

def action(fn,message):
    try:
        result=fn()
        st.success(message)
        return result
    except Exception as exc:
        st.error(str(exc))
        return None

if "aivedio_session" not in st.session_state:
    st.session_state.aivedio_session=""

if not st.session_state.aivedio_session:
    st.title("AIVEDIO · Account")
    if API.startswith(("http://localhost", "http://127.0.0.1")):
        st.warning(api_connection_message())
    else:
        try:
            health=requests.get(API+"/health",timeout=5)
            health.raise_for_status()
            st.caption("API connection: online")
        except requests.RequestException:
            st.error(api_connection_message())
    if API.startswith(("http://localhost", "http://127.0.0.1")):
        st.info("Authentication is temporarily unavailable until the backend is connected. Configure AIVEDIO_API_URL in Streamlit Cloud Secrets with your deployed API HTTPS URL.")
        st.code('AIVEDIO_API_URL = "https://your-api-host.example.com"',language="toml")
        st.markdown("**Deployment checklist**\n1. Deploy the API service using `Dockerfile.api`.\n2. Confirm the API's `/health` endpoint is publicly reachable over HTTPS.\n3. Add the API URL to Streamlit Cloud → App settings → Secrets.\n4. Restart/reboot the Streamlit app.")
        st.stop()
    auth_tab=st.tabs(["Sign in","Create account","Forgot password","Reset password"])
    with auth_tab[0]:
        with st.form("login_form"):
            login_email=st.text_input("Email",key="auth_login_email")
            login_password=st.text_input("Password",type="password",key="auth_login_password")
            submit_login=st.form_submit_button("Sign in")
        if submit_login:
            try:
                session=api("/v1/auth/login","POST",{"email":login_email,"password":login_password})
                st.session_state.aivedio_session=session["token"]
                st.rerun()
            except requests.HTTPError as exc:
                status=exc.response.status_code if exc.response is not None else None
                if status==401:
                    st.error("Sign-in failed: the account/email or password is incorrect, or the account is disabled.")
                elif status==429:
                    st.error("Too many sign-in attempts. Please wait and try again.")
                elif status and status>=500:
                    st.error("The AIVEDIO API is having a server error. Check API health and deployment logs.")
                else:
                    st.error(f"Sign-in request failed (HTTP {status or 'unknown'}). Check API URL and deployment.")
            except requests.ConnectionError:
                st.error(api_connection_message())
            except requests.Timeout:
                st.error("The API request timed out. Check API health and retry.")
            except requests.RequestException:
                st.error(api_connection_message())
    with auth_tab[1]:
        with st.form("register_form"):
            register_email=st.text_input("Email")
            register_password=st.text_input("Password (12+ characters)",type="password")
            register_name=st.text_input("Display name")
            submit_register=st.form_submit_button("Create account")
        if submit_register:
            try:
                session=api("/v1/auth/register","POST",{"email":register_email,"password":register_password,"displayName":register_name})
                st.session_state.aivedio_session=session["token"]
                st.rerun()
            except requests.ConnectionError: st.error(api_connection_message())
            except requests.Timeout: st.error("The API request timed out. Check API health and retry.")
            except requests.HTTPError as exc:
                status=exc.response.status_code if exc.response is not None else "unknown"
                detail=exc.response.text[:500] if exc.response is not None else "API error"
                st.error(f"Registration failed (HTTP {status}): {detail}")
            except Exception as exc: st.error(f"Registration failed: {exc}")
    with auth_tab[2]:
        with st.form("forgot_form"):
            forgot_email=st.text_input("Account email")
            submit_forgot=st.form_submit_button("Send reset link")
        if submit_forgot:
            try:
                api("/v1/auth/forgot-password","POST",{"email":forgot_email})
                st.info("If an account exists, reset instructions have been sent.")
            except requests.ConnectionError:
                st.error(api_connection_message())
            except requests.Timeout:
                st.error("The API request timed out. Check API health and retry.")
            except Exception:
                st.info("If an account exists, reset instructions have been sent.")
    with auth_tab[3]:
        with st.form("reset_form"):
            reset_token=st.text_input("Reset token")
            new_password=st.text_input("New password (12+ characters)",type="password")
            submit_reset=st.form_submit_button("Reset password")
        if submit_reset:
            try:
                api("/v1/auth/reset-password","POST",{"token":reset_token,"password":new_password})
                st.success("Password reset. Sign in again.")
            except requests.ConnectionError: st.error(api_connection_message())
            except requests.Timeout: st.error("The API request timed out. Check API health and retry.")
            except Exception as exc: st.error(f"Password reset failed: {exc}")
    st.stop()

if "project" not in st.session_state:
    st.session_state.project=None
if "scene_id" not in st.session_state:
    st.session_state.scene_id=None

with st.sidebar:
    st.title("🎬 AIVEDIO")
    st.caption("Universal AI Creative Studio")
    if st.button("Sign out",use_container_width=True):
        try: api("/v1/auth/logout","POST")
        except Exception: pass
        st.session_state.aivedio_session=""
        st.rerun()
    try:
        st.success(api("/health").get("status","connected"))
    except Exception:
        st.error("API offline · persistence disabled")
    page=st.radio("Workspace",["Overview","Team","Creative Plan","Script","Storyboard","Assets","Flow Library","Timeline","Audio","Quality & Safety","Renders","Generation Jobs","Agent Pipeline"])
    st.divider()
    new_title=st.text_input("New production title")
    new_brief=st.text_area("Creative brief",height=100)
    if st.button("＋ Create project",use_container_width=True) and new_title.strip():
        created=action(lambda:api("/v1/projects","POST",{"title":new_title,"mode":"flow","creativeBrief":new_brief}),"Project created")
        if created:
            st.session_state.project=created
            st.rerun()

projects=safe("/v1/projects",[])
if projects:
    choices={p["title"]:p["id"] for p in projects}
    current_id=st.session_state.project.get("id") if st.session_state.project else None
    index=list(choices.values()).index(current_id) if current_id in choices.values() else 0
    selected_title=st.selectbox("Project",list(choices),index=index)
    project_id=choices[selected_title]
    st.session_state.project=next(p for p in projects if p["id"]==project_id)
else:
    project_id=None

st.title("AIVEDIO · "+(st.session_state.project.get("title","Studio") if st.session_state.project else "Studio"))
if not project_id:
    st.info("Create or select a production to start.")
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
    references=safe(f"/v1/projects/{project_id}/flow/references",[])
    characters=safe(f"/v1/projects/{project_id}/flow/characters",[])
    reviewer=st.text_input("Reviewer identity",value="Streamlit reviewer",key="reviewer")

    if page=="Overview":
        cols=st.columns(4)
        cols[0].metric("Scenes",len(scenes))
        cols[1].metric("Assets",len(assets))
        cols[2].metric("Generation jobs",len(jobs))
        cols[3].metric("Render jobs",len(renders))
        st.subheader("Production pipeline")
        for name,count in [("Creative Plans",len(plans)),("Script Packages",len(scripts)),("Storyboard",len(scenes)),("Assets",len(assets)),("Timeline Clips",len(timeline.get("clips",[]))),("Audio Plans",len(audio_plans)),("QA Reports",len(quality)),("Renders",len(renders))]:
            st.write(f"**{name}** · {count}")
        st.info("Safety, technical QA and delivery approval are separate gates.")

    elif page=="Team":
        role=safe(f"/v1/projects/{project_id}/role",{}).get("role","unknown")
        st.subheader("Project members")
        st.info(f"Your role: **{role}**")
        members=safe(f"/v1/projects/{project_id}/members",[])
        if role=="owner":
            with st.form("invite_member"):
                invite_email=st.text_input("Existing account email")
                invite_role=st.selectbox("Role",["editor","reviewer","viewer"])
                invite=st.form_submit_button("Add member")
            if invite and invite_email.strip():
                action(lambda:api(f"/v1/projects/{project_id}/members","POST",{"email":invite_email,"role":invite_role}),"Member added")
                st.rerun()
        for member in members:
            cols=st.columns([3,1,1])
            cols[0].write(f"**{member.get('display_name') or member['email']}**")
            cols[1].write(member["role"])
            if role=="owner" and member["role"]!="owner" and cols[2].button("Remove",key="remove-member-"+member["user_id"]):
                action(lambda:api(f"/v1/projects/{project_id}/members/{member['user_id']}","DELETE"),"Member removed")
                st.rerun()
        if role!="owner":
            st.caption("Only the project owner can manage members.")
    elif page=="Creative Plan":
        st.subheader("Creative Director")
        with st.form("plan_form"):
            brief=st.text_area("Creative brief",value=st.session_state.project.get("creative_brief") or "")
            duration=st.number_input("Target duration (seconds)",min_value=10,max_value=43200,value=60)
            fmt=st.selectbox("Format",["general","film","short_video","advertisement","documentary","explainer","music_video","animation"])
            submit=st.form_submit_button("Generate plan")
        if submit:
            action(lambda:api(f"/v1/projects/{project_id}/creative-plans","POST",{"projectTitle":selected_title,"brief":brief,"format":fmt,"targetDurationSeconds":duration,"aspectRatio":"16:9","resolution":"1080p","language":"English","genre":[],"mood":[],"visualStyle":"Cinematic, continuity-conscious"}),"Creative plan drafted")
        for plan_row in plans:
            with st.expander(f"Plan v{plan_row.get('version')} · {plan_row.get('status','draft')}"):
                detail=safe(f"/v1/projects/{project_id}/creative-plans/{plan_row['id']}",plan_row)
                content=detail.get("plan",{})
                st.write(content.get("logline"))
                st.json(content.get("scenes",[]))
                if plan_row.get("status")!="approved":
                    if st.button("Approve plan",key="approve-plan-"+plan_row["id"]):
                        action(lambda:api(f"/v1/projects/{project_id}/creative-plans/{plan_row['id']}/approve","POST",{"reviewer":reviewer}),"Plan approved")

    elif page=="Script":
        approved=[p for p in plans if p.get("status")=="approved"]
        if plans:
            chosen=st.selectbox("Creative plan",plans,format_func=lambda p:f"Plan v{p.get('version')} · {p.get('status')}")
            if st.button("Generate script",disabled=not approved):
                created=action(lambda:api(f"/v1/projects/{project_id}/creative-plans/{chosen['id']}/script-packages","POST",{}),"Script package created for review")
        for script_row in scripts:
            with st.expander(f"Script v{script_row.get('version')} · {script_row.get('status')}"):
                detail=safe(f"/v1/projects/{project_id}/script-packages/{script_row['id']}",script_row)
                content=detail.get("content",{})
                st.write(content.get("logline"))
                st.json(content.get("scenes",[]))
                st.json(detail.get("validation",{}))
                if script_row.get("status")=="awaiting_review":
                    c1,c2=st.columns(2)
                    if c1.button("Approve",key="approve-script-"+script_row["id"]):
                        action(lambda:api(f"/v1/projects/{project_id}/script-packages/{script_row['id']}/review","POST",{"decision":"approve","reviewer":reviewer}),"Script approved")
                    if c2.button("Reject",key="reject-script-"+script_row["id"]):
                        action(lambda:api(f"/v1/projects/{project_id}/script-packages/{script_row['id']}/review","POST",{"decision":"reject","reviewer":reviewer}),"Script rejected")

    elif page=="Storyboard":
        left,right=st.columns([1,2])
        with left:
            st.subheader(f"Scenes · {len(scenes)}")
            for scene_row in scenes:
                if st.button(f"{scene_row.get('scene_order',0)+1}. {scene_row['title']}",key="select-scene-"+scene_row["id"]):
                    st.session_state.scene_id=scene_row["id"]
            if st.button("＋ Add scene"):
                created=action(lambda:api(f"/v1/projects/{project_id}/scenes","POST",{"title":f"Scene {len(scenes)+1}","prompt":"","durationSeconds":10,"sceneOrder":len(scenes)}),"Scene added")
                if created:
                    st.session_state.scene_id=created["id"]
                    st.rerun()
        current=next((s for s in scenes if s["id"]==st.session_state.scene_id),scenes[0] if scenes else None)
        with right:
            if current:
                with st.form("scene_editor"):
                    prompt=st.text_area("Scene prompt",value=current.get("prompt") or "",height=180)
                    st.caption(f"Duration: {current.get('duration_seconds',10)}s · Status: {current.get('status','draft')}")
                    save=st.form_submit_button("Save scene")
                if save:
                    action(lambda:api(f"/v1/scenes/{current['id']}","PATCH",{"prompt":prompt}),"Scene saved")
            else:
                st.info("Select or add a scene.")

    elif page=="Assets":
        st.subheader(f"Assets · {len(assets)}")
        for asset in assets:
            with st.expander(f"{asset['kind']} · {asset['status']} · {asset['id']}"):
                st.write(asset.get("storage_key"),asset.get("mime_type"))
                c1,c2,c3=st.columns(3)
                if c1.button("Analyze",key="analyze-"+asset["id"]):
                    action(lambda:api(f"/v1/projects/{project_id}/assets/{asset['id']}/analyze","POST",{}),"Asset analysis queued")
                if c2.button("Technical QA",key="qa-"+asset["id"]):
                    action(lambda:api(f"/v1/projects/{project_id}/quality/assets/{asset['id']}/jobs","POST",{}),"Technical QA queued")
                if asset["status"]=="quarantined" and c3.button("Approve",key="approve-asset-"+asset["id"]):
                    action(lambda:api(f"/v1/assets/{asset['id']}/review","POST",{"decision":"approve","reviewer":reviewer}),"Asset approved")

    elif page=="Flow Library":
        with st.form("reference_form"):
            label=st.text_input("Reference label")
            uri=st.text_input("URI / storage key")
            kind=st.selectbox("Reference type",["image","video","audio","document","style"])
            submit=st.form_submit_button("Add reference")
        if submit:
            action(lambda:api(f"/v1/projects/{project_id}/flow/references","POST",{"kind":kind,"label":label,"uri":uri,"tags":["streamlit"]}),"Reference saved")
        st.subheader("References")
        st.dataframe(references,use_container_width=True)
        st.subheader("Characters")
        st.dataframe(characters,use_container_width=True)

    elif page=="Timeline":
        approved_scripts=[s for s in scripts if s.get("status")=="approved"]
        if approved_scripts:
            selected_script=st.selectbox("Approved screenplay",approved_scripts,format_func=lambda s:f"Script v{s.get('version')}")
            if st.button("Compile production cut"):
                action(lambda:api(f"/v1/projects/{project_id}/production-cuts","POST",{"scriptPackageId":selected_script["id"]}),"Production cut drafted")
        for cut in cuts:
            with st.expander(f"Cut v{cut.get('version')} · {cut.get('status')} · readiness {cut.get('readiness_score')}%"):
                detail=safe(f"/v1/projects/{project_id}/production-cuts/{cut['id']}",cut)
                st.json(detail.get("content",{}))
                if cut.get("status")=="draft" and cut.get("readiness")=="ready" and st.button("Apply cut",key="apply-cut-"+cut["id"]):
                    action(lambda:api(f"/v1/projects/{project_id}/production-cuts/{cut['id']}/apply","POST",{}),"Cut applied")
        st.subheader("Timeline tracks")
        st.dataframe(timeline.get("tracks",[]),use_container_width=True)
        st.subheader("Timeline clips")
        st.dataframe(timeline.get("clips",[]),use_container_width=True)
        if st.button("Validate edit manifest"):
            result=action(lambda:api(f"/v1/projects/{project_id}/timeline/manifest"),"Manifest checked")
            if result:
                st.json(result.get("validation",{}))

    elif page=="Audio":
        applied=[c for c in cuts if c.get("status")=="applied"]
        if applied:
            selected_cut=st.selectbox("Applied production cut",applied,format_func=lambda c:f"Cut v{c.get('version')}")
            if st.button("Create audio plan"):
                action(lambda:api(f"/v1/projects/{project_id}/production-cuts/{selected_cut['id']}/audio-plans","POST",{}),"Audio plan drafted")
        for audio_plan in audio_plans:
            with st.expander(f"Audio plan v{audio_plan.get('version')} · {audio_plan.get('status')}"):
                detail=safe(f"/v1/projects/{project_id}/audio-plans/{audio_plan['id']}",audio_plan)
                st.json(detail.get("content",{}).get("cues",[]))
                c1,c2,c3=st.columns(3)
                if audio_plan.get("status")=="draft":
                    if c1.button("Approve audio",key="approve-audio-"+audio_plan["id"]):
                        action(lambda:api(f"/v1/projects/{project_id}/audio-plans/{audio_plan['id']}/review","POST",{"decision":"approve","reviewer":reviewer}),"Audio plan approved")
                    if c2.button("Reject",key="reject-audio-"+audio_plan["id"]):
                        action(lambda:api(f"/v1/projects/{project_id}/audio-plans/{audio_plan['id']}/review","POST",{"decision":"reject","reviewer":reviewer}),"Audio plan rejected")
                if audio_plan.get("status")=="approved" and c3.button("Apply tracks",key="apply-audio-"+audio_plan["id"]):
                    action(lambda:api(f"/v1/projects/{project_id}/audio-plans/{audio_plan['id']}/apply","POST",{}),"Audio tracks applied")

    elif page=="Quality & Safety":
        st.subheader("Quality reports")
        for report in quality:
            with st.expander(f"{report.get('stage')} · {report.get('status')} · safety {report.get('safety_verdict')}"):
                st.json(report.get("report",{}))
                c1,c2,c3=st.columns(3)
                if c1.button("Clear",key="clear-safety-"+report["id"]):
                    action(lambda:api(f"/v1/projects/{project_id}/quality/reports/{report['id']}/safety-review","POST",{"decision":"clear","reviewer":reviewer,"notes":"Reviewed in Streamlit"}),"Safety cleared")
                if c2.button("Block",key="block-safety-"+report["id"]):
                    action(lambda:api(f"/v1/projects/{project_id}/quality/reports/{report['id']}/safety-review","POST",{"decision":"block","reviewer":reviewer,"notes":"Reviewed in Streamlit"}),"Safety blocked")
                if c3.button("Needs changes",key="changes-safety-"+report["id"]):
                    action(lambda:api(f"/v1/projects/{project_id}/quality/reports/{report['id']}/safety-review","POST",{"decision":"needs_changes","reviewer":reviewer,"notes":"Reviewed in Streamlit"}),"Changes requested")
        st.subheader("Safety review history")
        st.dataframe(safety,use_container_width=True)

    elif page=="Renders":
        c1,c2=st.columns(2)
        profile=c1.selectbox("Resolution",["720p","1080p","4K"])
        subtitle=c2.selectbox("Subtitle mode",["sidecar","burn_in","none"])
        if st.button("Create render from timeline"):
            width,height={"720p":(1280,720),"1080p":(1920,1080),"4K":(3840,2160)}[profile]
            action(lambda:api(f"/v1/projects/{project_id}/render-jobs","POST",{"profile":{"container":"mp4","videoCodec":"h264","audioCodec":"aac","width":width,"height":height,"fps":24,"quality":"standard","audioSampleRate":48000},"options":{"subtitleMode":subtitle}}),"Render job created")
        for render in renders:
            with st.expander(f"{render.get('status')} · {render.get('stage')} · {int((render.get('progress') or 0)*100)}%"):
                st.json(render.get("qa_report",{}))
                if render.get("status")=="awaiting_review":
                    c1,c2=st.columns(2)
                    if c1.button("Approve delivery",key="approve-render-"+render["id"]):
                        action(lambda:api(f"/v1/render-jobs/{render['id']}/review","POST",{"decision":"approve","reviewer":reviewer,"notes":"Reviewed in Streamlit"}),"Render approved")
                    if c2.button("Reject render",key="reject-render-"+render["id"]):
                        action(lambda:api(f"/v1/render-jobs/{render['id']}/review","POST",{"decision":"reject","reviewer":reviewer,"notes":"Reviewed in Streamlit"}),"Render rejected")

    elif page=="Agent Pipeline":
        st.subheader("Improvisor · Implementation · Auditor · Patcher")
        st.info("Human-in-the-loop: proposals are not applied unless you approve the run and then explicitly apply the patch.")
        with st.form("agent_pipeline"):
            agent_brief=st.text_area("Brief override (optional)",value=st.session_state.project.get("creative_brief") or "")
            agent_outcome=st.text_area("Desired outcome",value="Improve creative direction, continuity, production readiness and quality.")
            start_agent=st.form_submit_button("Run agents")
        if start_agent:
            action(lambda:api(f"/v1/projects/{project_id}/agent-pipeline/runs","POST",{"brief":agent_brief,"requestedOutcome":agent_outcome}),"Agent proposal created")
            st.rerun()
        agent_runs=safe(f"/v1/projects/{project_id}/agent-pipeline/runs",[])
        for run in agent_runs:
            with st.expander(f"{run.get('status')} · {run.get('created_at')}"):
                detail=safe(f"/v1/projects/{project_id}/agent-pipeline/runs/{run['id']}",run)
                st.metric("Audit score",detail.get("audit",{}).get("score","—"))
                st.write("Verdict",detail.get("audit",{}).get("verdict"))
                st.json(detail.get("improvisor",{}))
                st.subheader("Implementation plan")
                st.json(detail.get("implementation_plan",{}))
                st.subheader("Auditor findings")
                st.json(detail.get("audit",{}))
                st.subheader("Patch proposal")
                st.json(detail.get("patch",{}))
                if detail.get("status")=="awaiting_approval":
                    c1,c2=st.columns(2)
                    if c1.button("Reject proposal",key="agent-reject-"+detail["id"]):
                        action(lambda:api(f"/v1/projects/{project_id}/agent-pipeline/runs/{detail['id']}/decision","POST",{"decision":"reject","notes":"Rejected in Streamlit HITL"}),"Run rejected")
                        st.rerun()
                    if c2.button("Approve proposal",key="agent-approve-"+detail["id"]):
                        action(lambda:api(f"/v1/projects/{project_id}/agent-pipeline/runs/{detail['id']}/decision","POST",{"decision":"approve","notes":"Approved in Streamlit HITL"}),"Run approved")
                        st.rerun()
                if detail.get("status")=="approved" and st.button("Apply approved patch",key="agent-apply-"+detail["id"]):
                    action(lambda:api(f"/v1/projects/{project_id}/agent-pipeline/runs/{detail['id']}/apply","POST",{}),"Patch applied")
                    st.rerun()

    elif page=="Generation Jobs":
        st.subheader("Generation queue")
        for job in jobs:
            with st.expander(f"{job.get('task')} · {job.get('status')}"):
                st.write("Safety:",job.get("safety_status"),"Quality:",job.get("quality_status"))
                st.write(job.get("error"))
                if job.get("status")=="awaiting_approval":
                    c1,c2=st.columns(2)
                    if c1.button("Approve",key="approve-job-"+job["id"]):
                        action(lambda:api(f"/v1/generation-jobs/{job['id']}/review","POST",{"decision":"approve","reviewer":reviewer,"notes":"Reviewed in Streamlit"}),"Generation job approved")
                    if c2.button("Reject",key="reject-job-"+job["id"]):
                        action(lambda:api(f"/v1/generation-jobs/{job['id']}/review","POST",{"decision":"reject","reviewer":reviewer,"notes":"Reviewed in Streamlit"}),"Generation job rejected")
