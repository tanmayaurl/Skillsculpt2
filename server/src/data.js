const fs = require("fs")
const path = require("path")
const storePath = path.join(__dirname, "..", "data.json")
let pgClient = null
let usePG = false
try {
  const { Client } = require("pg")
  const url = process.env.DATABASE_URL || null
  if (url || process.env.PGHOST) {
    pgClient = new Client({ connectionString: url || undefined })
    usePG = true
  }
} catch {}

let students = []
let jobs = []
let universities = []

let studentIdSeq = 1
let jobIdSeq = 1
let universityIdSeq = 1

function load() {
  try {
    if (fs.existsSync(storePath)) {
      const raw = JSON.parse(fs.readFileSync(storePath, "utf-8"))
      students = Array.isArray(raw.students) ? raw.students : []
      jobs = Array.isArray(raw.jobs) ? raw.jobs : []
      universities = Array.isArray(raw.universities) ? raw.universities : []
      studentIdSeq = Number(raw.studentIdSeq || students.length + 1)
      jobIdSeq = Number(raw.jobIdSeq || jobs.length + 1)
      universityIdSeq = Number(raw.universityIdSeq || universities.length + 1)
    }
  } catch {}
}

function save() {
  const payload = { students, jobs, universities, studentIdSeq, jobIdSeq, universityIdSeq }
  fs.writeFileSync(storePath, JSON.stringify(payload, null, 2))
}

async function initDB() {
  if (!usePG) return
  await pgClient.connect()
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS universities (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL,
      skills JSONB NOT NULL DEFAULT '[]',
      certifications JSONB NOT NULL DEFAULT '[]',
      achievements JSONB NOT NULL DEFAULT '[]',
      experience_years NUMERIC NOT NULL DEFAULT 0,
      resume_text TEXT
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT,
      required_skills JSONB NOT NULL DEFAULT '[]',
      min_experience_years NUMERIC NOT NULL DEFAULT 0,
      description TEXT,
      type TEXT,
      location TEXT
    );
  `)
}

async function addUniversity(name) {
  if (usePG) {
    const r = await pgClient.query("INSERT INTO universities(name) VALUES($1) RETURNING id, name", [name])
    const u = { id: String(r.rows[0].id), name: r.rows[0].name }
    return u
  } else {
    const u = { id: String(universityIdSeq++), name }
    universities.push(u)
    save()
    return u
  }
}

async function addStudent(payload) {
  const sPayload = {
    name: payload.name || "",
    email: payload.email || "",
    universityId: payload.universityId || null,
    skills: Array.isArray(payload.skills) ? payload.skills : [],
    certifications: Array.isArray(payload.certifications) ? payload.certifications : [],
    achievements: Array.isArray(payload.achievements) ? payload.achievements : [],
    experienceYears: Number(payload.experienceYears || 0),
    resumeText: payload.resumeText || ""
  }
  if (usePG) {
    const r = await pgClient.query(
      "INSERT INTO students(name,email,university_id,skills,certifications,achievements,experience_years,resume_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [sPayload.name, sPayload.email, sPayload.universityId ? Number(sPayload.universityId) : null, JSON.stringify(sPayload.skills), JSON.stringify(sPayload.certifications), JSON.stringify(sPayload.achievements), sPayload.experienceYears, sPayload.resumeText]
    )
    return { id: String(r.rows[0].id), ...sPayload }
  } else {
    const s = { id: String(studentIdSeq++), ...sPayload }
    students.push(s)
    save()
    return s
  }
}

async function addJob(payload) {
  const jPayload = {
    title: payload.title || "",
    company: payload.company || "",
    requiredSkills: Array.isArray(payload.requiredSkills) ? payload.requiredSkills : [],
    minExperienceYears: Number(payload.minExperienceYears || 0),
    description: payload.description || "",
    type: payload.type || "job",
    location: payload.location || ""
  }
  if (usePG) {
    const r = await pgClient.query(
      "INSERT INTO jobs(title,company,required_skills,min_experience_years,description,type,location) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [jPayload.title, jPayload.company, JSON.stringify(jPayload.requiredSkills), jPayload.minExperienceYears, jPayload.description, jPayload.type, jPayload.location]
    )
    return { id: String(r.rows[0].id), ...jPayload }
  } else {
    const j = { id: String(jobIdSeq++), ...jPayload }
    jobs.push(j)
    save()
    return j
  }
}

async function getUniversities() {
  if (usePG) {
    const r = await pgClient.query("SELECT id, name FROM universities")
    return r.rows.map(u => ({ id: String(u.id), name: u.name }))
  } else {
    return universities
  }
}

async function getStudents() {
  if (usePG) {
    const r = await pgClient.query("SELECT id,name,email,university_id,skills,certifications,achievements,experience_years,resume_text FROM students")
    return r.rows.map(s => ({
      id: String(s.id),
      name: s.name,
      email: s.email,
      universityId: s.university_id ? String(s.university_id) : null,
      skills: Array.isArray(s.skills) ? s.skills : JSON.parse(s.skills || "[]"),
      certifications: Array.isArray(s.certifications) ? s.certifications : JSON.parse(s.certifications || "[]"),
      achievements: Array.isArray(s.achievements) ? s.achievements : JSON.parse(s.achievements || "[]"),
      experienceYears: Number(s.experience_years || 0),
      resumeText: s.resume_text || ""
    }))
  } else {
    return students
  }
}

async function getJobs() {
  if (usePG) {
    const r = await pgClient.query("SELECT id,title,company,required_skills,min_experience_years,description,type,location FROM jobs")
    return r.rows.map(j => ({
      id: String(j.id),
      title: j.title,
      company: j.company,
      requiredSkills: Array.isArray(j.required_skills) ? j.required_skills : JSON.parse(j.required_skills || "[]"),
      minExperienceYears: Number(j.min_experience_years || 0),
      description: j.description || "",
      type: j.type || "job",
      location: j.location || ""
    }))
  } else {
    return jobs
  }
}

async function seed() {
  if (usePG) {
    await initDB()
    const us = await getStudents()
    const js = await getJobs()
    const unis = await getUniversities()
    if (us.length || js.length || unis.length) return
    const u = await addUniversity("Tech University")
    await addStudent({
      name: "Asha",
      email: "asha@example.com",
      universityId: u.id,
      skills: ["Java", "Spring", "SQL", "DSA"],
      certifications: ["Oracle SQL"],
      achievements: ["Smart India Hackathon finalist"],
      experienceYears: 0.5,
      resumeText: "Java developer with Spring and SQL, built APIs and solved DSA problems"
    })
    await addStudent({
      name: "Rahul",
      email: "rahul@example.com",
      universityId: u.id,
      skills: ["Python", "Pandas", "ML", "NLP"],
      certifications: ["Coursera ML"],
      achievements: ["Published blog on sentiment analysis"],
      experienceYears: 1,
      resumeText: "Data science projects using Pandas, scikit-learn and NLP"
    })
    await addJob({
      title: "Java Backend Intern",
      company: "Acme Corp",
      requiredSkills: ["Java", "Spring", "SQL"],
      minExperienceYears: 0,
      description: "Build REST APIs and work with relational databases",
      type: "internship",
      location: "Remote"
    })
    await addJob({
      title: "Data Analyst",
      company: "InsightX",
      requiredSkills: ["Python", "Pandas", "SQL"],
      minExperienceYears: 0,
      description: "Analyze datasets and build dashboards",
      type: "job",
      location: "Bangalore"
    })
  } else {
    load()
    if (students.length || jobs.length || universities.length) return
    const u = addUniversity("Tech University")
    addStudent({
      name: "Asha",
      email: "asha@example.com",
      universityId: u.id,
      skills: ["Java", "Spring", "SQL", "DSA"],
      certifications: ["Oracle SQL"],
      achievements: ["Smart India Hackathon finalist"],
      experienceYears: 0.5,
      resumeText: "Java developer with Spring and SQL, built APIs and solved DSA problems"
    })
    addStudent({
      name: "Rahul",
      email: "rahul@example.com",
      universityId: u.id,
      skills: ["Python", "Pandas", "ML", "NLP"],
      certifications: ["Coursera ML"],
      achievements: ["Published blog on sentiment analysis"],
      experienceYears: 1,
      resumeText: "Data science projects using Pandas, scikit-learn and NLP"
    })
    addJob({
      title: "Java Backend Intern",
      company: "Acme Corp",
      requiredSkills: ["Java", "Spring", "SQL"],
      minExperienceYears: 0,
      description: "Build REST APIs and work with relational databases",
      type: "internship",
      location: "Remote"
    })
    addJob({
      title: "Data Analyst",
      company: "InsightX",
      requiredSkills: ["Python", "Pandas", "SQL"],
      minExperienceYears: 0,
      description: "Analyze datasets and build dashboards",
      type: "job",
      location: "Bangalore"
    })
    save()
  }
}

module.exports = { getStudents, getJobs, getUniversities, addUniversity, addStudent, addJob, seed }
