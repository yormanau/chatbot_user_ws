const UserModel  = require('../models/userModel');
const { formatDateToDisplay, formatDateToSQL } = require('../utils/dateHelpers');
const { normalizeNames } = require('../utils/normalizeNames');
const { toStr }  = require('../middleware/auth');
const { CHANNELS } = require('../config/channels');

const ALLOWED_FIELDS = ['email', 'ciudad', 'birth_date', 'gender'];

async function search(req, res) {
  const { q = '' } = req.query;
  if (!q.trim()) return res.json([]);

  try {
    const rows = await UserModel.search(q);
    res.json(rows.map(row => ({
      id:        row.id,
      name:      normalizeNames(toStr(row.name)),
      phone:     toStr(row.phone),
      create_at: row.create_at,
    })));
  } catch (err) {
    console.error('[Search] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function getById(req, res) {
  const { id } = req.params;
  try {
    const user = await UserModel.findById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const raw = toStr(user.gender);
    res.json({
      id:         user.id,
      name:       normalizeNames(toStr(user.name)),
      phone:      toStr(user.phone),
      email:      toStr(user.email),
      ciudad:     toStr(user.ciudad),
      birth_date: formatDateToDisplay(user.birth_date),
      gender:     raw === 'M' ? 'Masculino' : raw === 'F' ? 'Femenino' : raw,
      create_at:  user.create_at,
      channel:    toStr(user.channel) || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function update(req, res) {
  const { id }   = req.params;
  const { name } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

  const normalizedName = normalizeNames(name.trim());
  try {
    await UserModel.updateName(id, normalizedName);
    res.json({ ok: true, name: normalizedName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateInfo(req, res) {
  const { id }         = req.params;
  let { field, value } = req.body;

  if (!field || !ALLOWED_FIELDS.includes(field)) {
    return res.status(400).json({ error: 'Campo no permitido' });
  }
  if (!value?.toString().trim()) {
    return res.status(400).json({ error: 'El valor no puede estar vacío' });
  }

  if (field === 'gender') {
    value = value === 'Masculino' ? 'M' : value === 'Femenino' ? 'F' : value;
  }
  if (field === 'birth_date') {
    value = formatDateToSQL(value);
    if (!value) return res.status(400).json({ error: 'Formato de fecha inválido' });
  }
  if (field === 'ciudad') {
    value = normalizeNames(value);
  }
  if (field === 'email') {
    value = value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }
  }

  try {
    const user = await UserModel.findById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await UserModel.updateField(id, field, value.toString().trim());
    res.json({ ok: true, field, value: value.toString().trim() });
  } catch (err) {
    console.error('[users/info] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    const user = await UserModel.findById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await UserModel.deleteById(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE user] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function register(req, res) {
  let { nombre, telefono, email, gender, ciudad, birth_date } = req.body;

  if (!nombre?.trim() || !telefono?.trim()) {
    return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
  }

  telefono = telefono.replace(/[\s\-\(\)\+]/g, '');

  try {
    const existing = await UserModel.findByPhone(telefono);
    if (existing) return res.status(409).json({ error: 'El teléfono ya está registrado' });

    const newId = await UserModel.create(telefono, normalizeNames(nombre.trim()), CHANNELS.MANUAL);
    if (!newId) return res.status(500).json({ error: 'Error al registrar contacto' });

    const fields = {};
    if (email?.trim()) fields.email = email.trim().toLowerCase();
    if (gender) fields.gender = gender === 'Masculino' ? 'M' : gender === 'Femenino' ? 'F' : gender;
    if (ciudad?.trim()) fields.ciudad = normalizeNames(ciudad.trim());
    if (birth_date) {
      const sqlDate = formatDateToSQL(birth_date);
      if (sqlDate) fields.birth_date = sqlDate;
    }
    if (Object.keys(fields).length) await UserModel.updateFields(newId, fields);

    const { io } = require('../index.js');
    io.emit('user-registered', { nombre: normalizeNames(nombre.trim()), telefono });

    res.json({ ok: true, id: newId });
  } catch (err) {
    console.error('[register] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { search, getById, update, updateInfo, remove, register };
