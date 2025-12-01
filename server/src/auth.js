const jwt = require("jsonwebtoken")

const SECRET = process.env.JWT_SECRET || "dev_secret_key_change_me"

const users = [
  { id: "u1", email: "student@example.com", password: "student", role: "student" },
  { id: "u2", email: "employer@example.com", password: "employer", role: "employer" },
  { id: "u3", email: "uniadmin@example.com", password: "university", role: "university" }
]

function login(email, password) {
  const user = users.find(u => u.email === String(email) && u.password === String(password))
  if (!user) return null
  const token = jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: "2h" })
  return { token, role: user.role }
}

function auth(requiredRole) {
  return function (req, res, next) {
    const header = req.headers.authorization || ""
    const parts = header.split(" ")
    const token = parts[0] === "Bearer" ? parts[1] : null
    if (!token) return res.status(401).json({ error: "unauthorized" })
    try {
      const payload = jwt.verify(token, SECRET)
      req.user = payload
      if (requiredRole && payload.role !== requiredRole) return res.status(403).json({ error: "forbidden" })
      next()
    } catch (e) {
      return res.status(401).json({ error: "invalid_token" })
    }
  }
}

module.exports = { login, auth }
