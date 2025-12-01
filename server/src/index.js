const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const { getStudents, getJobs, getUniversities, addUniversity, addStudent, addJob, seed } = require("./data")
const { login, auth } = require("./auth")

const app = express()
app.use(cors())
app.use(bodyParser.json())

seed()

function textIncludesAll(t, arr) {
  const lower = String(t || "").toLowerCase()
  return arr.every(x => lower.includes(String(x).toLowerCase()))
}

function jaccard(a, b) {
  const sa = new Set(a.map(x => String(x).toLowerCase()))
  const sb = new Set(b.map(x => String(x).toLowerCase()))
  const inter = [...sa].filter(x => sb.has(x)).length
  const union = new Set([...sa, ...sb]).size
  return union === 0 ? 0 : inter / union
}

async function matchJobsForStudent(student) {
  const jobs = await getJobs()
  const scored = jobs.map(j => {
    const skillScore = jaccard(student.skills, j.requiredSkills)
    const expScore = student.experienceYears >= j.minExperienceYears ? 1 : student.experienceYears / Math.max(1, j.minExperienceYears)
    const resumeScore = textIncludesAll(student.resumeText, j.requiredSkills) ? 1 : 0
    const descScore = textIncludesAll(j.description, student.skills) ? 0.5 : 0
    const total = skillScore * 0.6 + expScore * 0.2 + resumeScore * 0.15 + descScore * 0.05
    return { job: j, score: Number(total.toFixed(3)) }
  })
  return scored.sort((a, b) => b.score - a.score)
}

async function optimizeResumeForStudent(student) {
  const required = new Set()
  const jobs = await getJobs()
  jobs.forEach(j => j.requiredSkills.forEach(s => required.add(String(s).toLowerCase())))
  const have = new Set(student.skills.map(s => String(s).toLowerCase()))
  const missing = [...required].filter(s => !have.has(s))
  const keywords = [...required].filter(s => textIncludesAll(student.resumeText, [s]))
  const suggestions = []
  if (missing.length) suggestions.push({ type: "skills", message: "Add missing industry skills", items: missing.slice(0, 10) })
  if (!textIncludesAll(student.resumeText, [student.name])) suggestions.push({ type: "branding", message: "Include name and role summary", items: [] })
  if (!student.achievements.find(x => /\d/.test(String(x)))) suggestions.push({ type: "quantify", message: "Quantify achievements with metrics", items: [] })
  if (keywords.length < 3) suggestions.push({ type: "keywords", message: "Add role-specific keywords", items: [...required].slice(0, 10) })
  return { suggestions }
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

app.get("/students", async (req, res) => {
  res.json(await getStudents())
})

app.post("/students", async (req, res) => {
  const s = await addStudent(req.body || {})
  res.status(201).json(s)
})

app.post("/secure/students", auth("student"), async (req, res) => {
  const s = await addStudent(req.body || {})
  res.status(201).json(s)
})

app.get("/jobs", async (req, res) => {
  res.json(await getJobs())
})

app.post("/jobs", async (req, res) => {
  const j = await addJob(req.body || {})
  res.status(201).json(j)
})

app.post("/secure/jobs", auth("employer"), async (req, res) => {
  const j = await addJob(req.body || {})
  res.status(201).json(j)
})

app.get("/match/:studentId", async (req, res) => {
  const students = await getStudents()
  const s = students.find(x => x.id === String(req.params.studentId))
  if (!s) return res.status(404).json({ error: "student_not_found" })
  const results = await matchJobsForStudent(s)
  res.json(results)
})

app.get("/resume/optimize/:studentId", async (req, res) => {
  const students = await getStudents()
  const s = students.find(x => x.id === String(req.params.studentId))
  if (!s) return res.status(404).json({ error: "student_not_found" })
  const out = await optimizeResumeForStudent(s)
  res.json(out)
})

app.get("/dashboard/university/:universityId/insights", async (req, res) => {
  const uid = String(req.params.universityId)
  const universities = await getUniversities()
  const uni = universities.find(u => u.id === uid)
  if (!uni) return res.status(404).json({ error: "university_not_found" })
  const students = await getStudents()
  const jobs = await getJobs()
  const stu = students.filter(s => s.universityId === uid)
  const avgSkills = stu.length ? stu.reduce((acc, s) => acc + s.skills.length, 0) / stu.length : 0
  const demand = new Map()
  jobs.forEach(j => j.requiredSkills.forEach(s => demand.set(s, (demand.get(s) || 0) + 1)))
  const supply = new Map()
  stu.forEach(s => s.skills.forEach(k => supply.set(k, (supply.get(k) || 0) + 1)))
  const gaps = [...demand.entries()].map(([k, d]) => ({ skill: k, demand: d, supply: supply.get(k) || 0, gap: d - (supply.get(k) || 0) }))
  gaps.sort((a, b) => b.gap - a.gap)
  res.json({ university: uni, totals: { students: stu.length, jobs: jobs.length }, avgSkills: Number(avgSkills.toFixed(2)), topSkillGaps: gaps.slice(0, 10) })
})

app.get("/search", async (req, res) => {
  const q = req.query || {}
  const skills = String(q.skills || "").split(",").map(x => x.trim()).filter(Boolean)
  const type = q.type ? String(q.type) : null
  const location = q.location ? String(q.location).toLowerCase() : null
  const minExp = q.minExperienceYears ? Number(q.minExperienceYears) : null
  const jobs = await getJobs()
  const filtered = jobs.filter(j => {
    if (skills.length && jaccard(skills, j.requiredSkills) === 0) return false
    if (type && j.type !== type) return false
    if (location && !String(j.location).toLowerCase().includes(location)) return false
    if (minExp != null && j.minExperienceYears > minExp) return false
    return true
  })
  const ranked = filtered.map(j => {
    const sc = skills.length ? jaccard(skills, j.requiredSkills) : 0
    return { job: j, score: Number(sc.toFixed(3)) }
  }).sort((a, b) => b.score - a.score)
  res.json(ranked)
})

app.get("/universities", async (req, res) => {
  res.json(await getUniversities())
})

app.get("/candidates/search", async (req, res) => {
  const q = req.query || {}
  const skills = String(q.skills || "").split(",").map(x => x.trim()).filter(Boolean)
  const universityId = q.universityId ? String(q.universityId) : null
  const minExp = q.minExperienceYears ? Number(q.minExperienceYears) : null
  const students = await getStudents()
  let filtered = students
  if (universityId) filtered = filtered.filter(s => s.universityId === universityId)
  if (minExp != null) filtered = filtered.filter(s => s.experienceYears >= minExp)
  if (skills.length) filtered = filtered.filter(s => jaccard(skills, s.skills) > 0)
  const ranked = filtered.map(s => {
    const sc = skills.length ? jaccard(skills, s.skills) : 0
    return { student: s, score: Number(sc.toFixed(3)) }
  }).sort((a, b) => b.score - a.score)
  res.json(ranked)
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log("server_listening", { port })
})
app.post("/auth/login", (req, res) => {
  const body = req.body || {}
  const out = login(body.email, body.password)
  if (!out) return res.status(401).json({ error: "invalid_credentials" })
  res.json(out)
})

app.get("/me", auth(), (req, res) => {
  res.json({ role: req.user.role })
})
