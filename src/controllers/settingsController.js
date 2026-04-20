const SettingsModel = require('../models/settingsModel');

const ALLOWED_KEYS = ['accent_color', 'brand_name', 'brand_logo', 'theme', 'text_on_accent'];

const settingsCtrl = {
  async getAll(req, res) {
    try {
      const results = {};
      await Promise.all(
        ALLOWED_KEYS.map(async key => {
          results[key] = await SettingsModel.get(key);
        })
      );
      res.json(results);
    } catch {
      res.status(500).json({ error: 'Error al obtener ajustes' });
    }
  },

  async save(req, res) {
    try {
      const body = req.body ?? {};
      await Promise.all(
        Object.entries(body)
          .filter(([key]) => ALLOWED_KEYS.includes(key))
          .map(([key, value]) => SettingsModel.set(key, String(value ?? '')))
      );
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Error al guardar ajustes' });
    }
  },
};

module.exports = settingsCtrl;
