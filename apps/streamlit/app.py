import os
import requests
import streamlit as st

API_URL = os.getenv("AIVEDIO_API_URL", "http://localhost:3000").rstrip("/")
st.set_page_config(page_title="AIVEDIO Creative Studio", page_icon="🎬", layout="wide")

st.markdown("""
<style>
.stApp { background: #080b14; color: #e7eaf5; }
[data-testid="stSidebar"] { background: #0b0f1a; }
div[data-testid="stMetric"] { background:#111827; border:1px solid #273149; padding:12px; border-radius:12px; }
button[kind="primary"] { background:linear-gradient(100deg,#6330ed,#a239ff); border:0; }
</style>
""", unsafe_allow_html=True)

if "scene_index" not in st.session_state: st.session_state.scene_index = 0
if "scenes" not in st.session_state:
    st.session_state.scenes = [
        {"title":"Opening — The city","duration":10,"prompt":"Establishing shot of a futuristic city at night."},
        {"title":"Signal in the rain","duration":15,"prompt":"Rain, neon reflections, mysterious signal."},
        {"title":"The Discovery","duration":12,"prompt":"Protagonist discovers a signal on a screen."},
        {"title":"The message","duration":18,"prompt":"A message slowly resolves from static."},
        {"title":"The vessel","duration":20,"prompt":"A mysterious spacecraft approaches."},
        {"title":"First contact","duration":16,"prompt":"A vast, atmospheric first-contact moment."},
    ]

with st.sidebar:
    st.title("🎬 AIVEDIO")
    st.caption("Universal AI Creative Studio")
    if st.button("＋ Create New Project", use_container_width=True):
        st.session_state.project_name = "Untitled Production"
    st.divider()
    st.subheader("Workspace")
    for item in ["Home","Projects","Workflow","Assets Library","Characters","Locations","Props","Images","Videos","Audio & Music","AI Agents","Models & Providers","MCP Tools","Knowledge Base","Settings"]:
        st.button(item, key=f"nav_{item}", use_container_width=True)
    st.divider()
    try:
        health=requests.get(f"{API_URL}/health",timeout=2).json()
        st.success(f"API: {health.get('status','connected')}")
    except Exception:
        st.warning("API offline · UI preview mode")

project_name=st.session_state.get("project_name","The Last Signal")
st.title(project_name)
st.caption("Film · 12 min · 16:9 · 1080p · 24 FPS")
modes=st.tabs(["Simple Mode","Flow Mode","Pro Mode","Studio Mode"])
with modes[0]:
    st.info("Describe your creative idea. The production planner will orchestrate the workflow when implemented.")
    st.text_area("Creative brief",placeholder="Describe the film, video, animation, music or multimedia project…",height=160)
with modes[1]:
    st.subheader("Flow · Storyboard")
    left,center,right=st.columns([1.05,2.1,1.15],gap="medium")
    with left:
        st.markdown(f"**Scenes ({len(st.session_state.scenes)})**")
        for i,scene in enumerate(st.session_state.scenes):
            if st.button(f"{i+1:02d} · {scene['title']} · {scene['duration']}s",key=f"scene_{i}",use_container_width=True):
                st.session_state.scene_index=i
        if st.button("＋ Add Scene",use_container_width=True):
            st.session_state.scenes.append({"title":"New Scene","duration":10,"prompt":""})
            st.session_state.scene_index=len(st.session_state.scenes)-1
    current=st.session_state.scenes[st.session_state.scene_index]
    with center:
        st.markdown("### Scene Preview")
        st.markdown(f"#### Scene {st.session_state.scene_index+1}: {current['title']}")
        st.markdown(f"""
        <div style="height:280px;border-radius:14px;border:1px solid #33415e;background:
        radial-gradient(circle at 68% 35%,#167fa6 0,#17385e 22%,#10182b 50%,#060914 80%);
        display:flex;align-items:center;justify-content:center;font-size:70px;">🌌</div>
        """,unsafe_allow_html=True)
        st.caption("Preview placeholder · connect generation provider in a later phase")
        with st.form("scene_edit"):
            title=st.text_input("Scene title",value=current["title"])
            duration=st.number_input("Duration (seconds)",min_value=1,max_value=600,value=int(current["duration"]))
            prompt=st.text_area("Generation prompt",value=current["prompt"],height=100)
            action=st.text_input("Action / direction",value="Cinematic movement and character action")
            dialogue=st.text_input("Dialogue",value="")
            submitted=st.form_submit_button("Save Scene",type="primary")
            if submitted:
                current.update(title=title,duration=duration,prompt=prompt)
                st.success("Scene updated in this session.")
        st.button("✨ Generate Scene",type="primary",disabled=True,help="Generation provider is not connected yet")
    with right:
        st.subheader("Model Routing")
        route=st.radio("Selection mode",["Auto","Manual","Per-task"],horizontal=True)
        st.caption("Auto respects capability, quality, availability and free-tier constraints.")
        for task in ["Script / Reasoning","Image","Video","Music / Audio"]:
            st.selectbox(task,["Auto","Manual model (not connected)"],key=f"model_{task}")
        st.subheader("AI Agents")
        for name in ["Creative Director","Scene Director","Character Consistency","Visual Continuity","Quality Control","Safety Guard","Production Manager"]:
            st.write("🟢",name)
        st.subheader("Project Status")
        st.progress(0.72)
        st.write("Planning ✓ · Scenes 5/8 · Generation in progress")
with modes[2]:
    st.subheader("Pro Workflow")
    st.write("Node graph, agent configuration, MCP tool permissions and checkpoints will be added in the Pro workflow phase.")
with modes[3]:
    st.subheader("Studio Timeline")
    st.write("Timeline editing, audio mixing, render settings and export will be implemented in Studio phase.")
    tracks=["Video","Voice / Dialogue","Music","Sound Effects","Captions"]
    for track in tracks:
        st.markdown(f"**{track}**")
        st.slider(f"{track} timeline",0,100,0,key=f"timeline_{track}",label_visibility="collapsed")

st.divider()
a,b,c,d=st.columns(4)
a.metric("Scenes",len(st.session_state.scenes))
b.metric("Total duration",f"{sum(s['duration'] for s in st.session_state.scenes)} sec")
c.metric("Mode", "Flow")
d.metric("Safety", "Not connected")
