const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

function isValidScale(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

app.post("/api/submit", async (req, res) => {
  const body = req.body || {};
  const {
    nombre,
    rol,
    empresa,
    claridadOnboarding,
    calidadSoporte,
    tiempoRespuesta,
    facilidadUso,
    nps,
    featureValorada,
    featureFaltante,
    comentarios,
  } = body;

  if (typeof empresa !== "string" || !empresa.trim()) {
    return res.status(400).json({ error: "empresa_required" });
  }

  const scales = [claridadOnboarding, calidadSoporte, tiempoRespuesta, facilidadUso];
  if (!scales.every(isValidScale)) {
    return res.status(400).json({ error: "invalid_scale_values" });
  }

  if (!Number.isInteger(nps) || nps < 0 || nps > 10) {
    return res.status(400).json({ error: "invalid_nps" });
  }

  const openFields = { featureValorada, featureFaltante, comentarios };
  for (const [key, value] of Object.entries(openFields)) {
    if (typeof value !== "string" || !value.trim()) {
      return res.status(400).json({ error: `${key}_required` });
    }
  }

  const fields = {
    Empresa: empresa.trim().slice(0, 160),
    Claridad_Onboarding: claridadOnboarding,
    Calidad_Soporte: calidadSoporte,
    Tiempo_Respuesta: tiempoRespuesta,
    Facilidad_Uso_Diario: facilidadUso,
    NPS: nps,
    Feature_Valorada: featureValorada.trim().slice(0, 2000),
    Feature_Faltante: featureFaltante.trim().slice(0, 2000),
    Comentarios: comentarios.trim().slice(0, 2000),
  };

  if (typeof nombre === "string" && nombre.trim()) fields.Nombre = nombre.trim().slice(0, 120);
  if (typeof rol === "string" && rol.trim()) fields.Rol = rol.trim().slice(0, 120);

  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !tableId || !token) {
    console.error("Missing Airtable env vars");
    return res.status(500).json({ error: "server_misconfigured" });
  }

  try {
    const airtableRes = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!airtableRes.ok) {
      const errText = await airtableRes.text();
      console.error("Airtable error", airtableRes.status, errText);
      return res.status(502).json({ error: "airtable_write_failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Submit handler error", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Survey server listening on port ${port}`);
});
