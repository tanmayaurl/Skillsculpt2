const api = "http://localhost:3000"
let token = localStorage.getItem("tb_token") || ""
let role = localStorage.getItem("tb_role") || ""

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts)
  return res.json()
}

async function refreshStudents() {
  const data = await fetchJSON(`${api}/students`)
  const ul = document.getElementById("students")
  ul.innerHTML = ""
  if (!data.length) {
    const li = document.createElement("li")
    li.innerHTML = `<span class="muted">No students yet</span>`
    ul.appendChild(li)
  }
  data.forEach(s => {
    const li = document.createElement("li")
    const left = document.createElement("div")
    left.innerHTML = `<strong>${s.name}</strong> <span style="color:#9ca3af">(#${s.id})</span>`
    const chips = document.createElement("div")
    chips.className = "chips"
    ;(s.skills||[]).forEach(k => { const c=document.createElement("span"); c.className="chip"; c.textContent=k; chips.appendChild(c) })
    left.appendChild(chips)
    li.appendChild(left)
    ul.appendChild(li)
  })
  const sel = document.getElementById("studentSelect")
  sel.innerHTML = ""
  data.forEach(s => {
    const o = document.createElement("option")
    o.value = s.id
    o.textContent = `${s.name} (#${s.id})`
    sel.appendChild(o)
  })
}

async function refreshJobs() {
  const data = await fetchJSON(`${api}/jobs`)
  const ul = document.getElementById("jobs")
  ul.innerHTML = ""
  if (!data.length) {
    const li = document.createElement("li")
    li.innerHTML = `<span class="muted">No jobs yet</span>`
    ul.appendChild(li)
  }
  data.forEach(j => {
    const li = document.createElement("li")
    const left = document.createElement("div")
    left.innerHTML = `<strong>${j.title}</strong> <span style="color:#9ca3af">@ ${j.company}</span> <span style="color:#64748b">• ${j.location}</span>`
    const chips = document.createElement("div")
    chips.className = "chips"
    ;(j.requiredSkills||[]).forEach(k => { const c=document.createElement("span"); c.className="chip"; c.textContent=k; chips.appendChild(c) })
    left.appendChild(chips)
    li.appendChild(left)
    ul.appendChild(li)
  })
}

async function addStudent() {
  const payload = {
    name: document.getElementById("s_name").value,
    email: document.getElementById("s_email").value,
    universityId: document.getElementById("s_university").value,
    skills: document.getElementById("s_skills").value.split(",").map(x => x.trim()).filter(Boolean),
    certifications: document.getElementById("s_certs").value.split(",").map(x => x.trim()).filter(Boolean),
    achievements: document.getElementById("s_ach").value.split(",").map(x => x.trim()).filter(Boolean),
    experienceYears: Number(document.getElementById("s_exp").value || 0),
    resumeText: document.getElementById("s_resume").value
  }
  await fetchJSON(`${api}/students`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
  await refreshStudents()
}

async function addJob() {
  const payload = {
    title: document.getElementById("j_title").value,
    company: document.getElementById("j_company").value,
    requiredSkills: document.getElementById("j_skills").value.split(",").map(x => x.trim()).filter(Boolean),
    minExperienceYears: Number(document.getElementById("j_exp").value || 0),
    description: document.getElementById("j_desc").value,
    type: document.getElementById("j_type").value,
    location: document.getElementById("j_loc").value
  }
  const endpoint = token ? `${api}/secure/jobs` : `${api}/jobs`
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  await fetchJSON(endpoint, { method: "POST", headers, body: JSON.stringify(payload) })
  await refreshJobs()
}

async function runMatch() {
  const id = document.getElementById("studentSelect").value
  const data = await fetchJSON(`${api}/match/${id}`)
  const ul = document.getElementById("matches")
  ul.innerHTML = ""
  if (!data.length) {
    const li = document.createElement("li")
    li.innerHTML = `<span class="muted">No matches yet</span>`
    ul.appendChild(li)
  }
  data.forEach(r => {
    const li = document.createElement("li")
    const left = document.createElement("div")
    left.innerHTML = `<strong>${r.job.title}</strong> <span style="color:#9ca3af">@ ${r.job.company}</span>`
    const bar = document.createElement("div")
    bar.className = "bar"
    const fill = document.createElement("div")
    fill.style.width = `${Math.min(100, Math.round(r.score*100))}%`
    bar.appendChild(fill)
    left.appendChild(bar)
    li.appendChild(left)
    ul.appendChild(li)
  })
}

async function optResume() {
  const id = document.getElementById("studentSelect").value
  const data = await fetchJSON(`${api}/resume/optimize/${id}`)
  const ul = document.getElementById("suggestions")
  ul.innerHTML = ""
  data.suggestions.forEach(s => {
    const li = document.createElement("li")
    li.textContent = `${s.type}: ${s.message} ${s.items && s.items.length ? "→ " + s.items.join(", ") : ""}`
    ul.appendChild(li)
  })
}

document.getElementById("addStudent").addEventListener("click", addStudent)
document.getElementById("addJob").addEventListener("click", addJob)
document.getElementById("runMatch").addEventListener("click", runMatch)
document.getElementById("optResume").addEventListener("click", optResume)

refreshStudents()
refreshJobs()
function renderAuth() {
  const el = document.getElementById("authBadge")
  if (el) {
    el.textContent = token ? `Logged in: ${role}` : "Not logged in"
  }
  updateVisibility()
}

async function login() {
  const email = prompt("Email", "employer@example.com")
  if (!email) return
  const password = prompt("Password", "employer")
  if (!password) return
  const out = await fetchJSON(`${api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })
  token = out.token
  role = out.role
  localStorage.setItem("tb_token", token)
  localStorage.setItem("tb_role", role)
  renderAuth()
}

function logout() {
  token = ""
  role = ""
  localStorage.removeItem("tb_token")
  localStorage.removeItem("tb_role")
  renderAuth()
}

document.getElementById("btnLoginHeader").addEventListener("click", login)
document.getElementById("btnLogoutHeader").addEventListener("click", logout)
renderAuth()
function setupNav() {
  document.querySelectorAll('header .nav a').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href')
      if (href && href.startsWith('#')) {
        e.preventDefault()
        const el = document.querySelector(href)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  })
}
setupNav()
function updateVisibility() {
  const studentForm = document.getElementById("studentForm")
  const jobForm = document.getElementById("jobForm")
  const jobBadge = document.getElementById("jobBadge")
  const candidateCard = document.getElementById("candidates")
  if (studentForm) studentForm.style.display = role === "student" ? "block" : "none"
  if (jobForm) jobForm.style.display = role === "employer" ? "block" : "block"
  if (jobBadge) jobBadge.style.display = role === "employer" ? "inline-block" : "none"
  if (candidateCard) candidateCard.style.display = role === "employer" || role === "university" ? "block" : "block"
}
async function runSearch() {
  const skills = document.getElementById("q_skills").value
  const type = document.getElementById("q_type").value
  const loc = document.getElementById("q_loc").value
  const minexp = document.getElementById("q_minexp").value
  const params = new URLSearchParams()
  if (skills) params.set("skills", skills)
  if (type) params.set("type", type)
  if (loc) params.set("location", loc)
  if (minexp) params.set("minExperienceYears", minexp)
  const data = await fetchJSON(`${api}/search?${params.toString()}`)
  const ul = document.getElementById("searchResults")
  ul.innerHTML = ""
  if (!data.length) {
    const li = document.createElement("li")
    li.innerHTML = `<span class="muted">No jobs found</span>`
    ul.appendChild(li)
  }
  data.forEach(r => {
    const li = document.createElement("li")
    li.innerHTML = `<span class="score">${r.score}</span> • ${r.job.title} @ ${r.job.company} • ${r.job.location}`
    ul.appendChild(li)
  })
}

document.getElementById("runSearch").addEventListener("click", runSearch)

async function runCandidateSearch() {
  const skills = document.getElementById("c_skills").value
  const uni = document.getElementById("c_uni").value
  const minexp = document.getElementById("c_minexp").value
  const params = new URLSearchParams()
  if (skills) params.set("skills", skills)
  if (uni) params.set("universityId", uni)
  if (minexp) params.set("minExperienceYears", minexp)
  const data = await fetchJSON(`${api}/candidates/search?${params.toString()}`)
  const ul = document.getElementById("candidateResults")
  ul.innerHTML = ""
  if (!data.length) {
    const li = document.createElement("li")
    li.innerHTML = `<span class="muted">No candidates found</span>`
    ul.appendChild(li)
  }
  data.forEach(r => {
    const li = document.createElement("li")
    li.innerHTML = `<span class="score">${r.score}</span> • ${r.student.name} • exp ${r.student.experienceYears}`
    ul.appendChild(li)
  })
}

document.getElementById("runCandidateSearch").addEventListener("click", runCandidateSearch)
