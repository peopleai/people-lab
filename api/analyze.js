export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "La conexión de PeopleAI con Claude no está configurada."
    });
  }

  try {
    const { content } = req.body || {};

    if (!Array.isArray(content) || content.length === 0) {
      return res.status(400).json({
        error: "Falta información para realizar el análisis."
      });
    }

    const systemPrompt = `
Eres un reclutador senior de Recursos Humanos con más de 15 años de experiencia evaluando candidatos frente a vacantes.

Analiza el perfil del candidato frente a la descripción de la vacante con criterio realista, profesional y específico.

El perfil y la vacante pueden incluir texto, imágenes o documentos.

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional, con esta estructura:

{
  "match_score": 0,
  "veredicto": "Resumen ejecutivo del nivel de compatibilidad",
  "coincidencias": [],
  "brechas": [],
  "fortalezas": [],
  "recomendaciones": []
}

Reglas:
- match_score debe ser un número entero entre 0 y 100.
- Incluye entre 3 y 7 elementos por lista cuando la información lo permita.
- No inventes experiencia ni requisitos.
- Diferencia claramente entre evidencia real y ausencia de evidencia.
- Las recomendaciones deben ser concretas y accionables.
`;

    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1600,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: content
            }
          ]
        })
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("Anthropic error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Claude no pudo completar el análisis."
      });
    }

    const text = (data?.content || [])
      .map(block => block?.text || "")
      .filter(Boolean)
      .join("\n")
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      console.error("Respuesta inesperada:", text);

      return res.status(502).json({
        error:
          "El análisis llegó en un formato inesperado. Intenta nuevamente."
      });
    }

    return res.status(200).json({
      result
    });

  } catch (error) {
    console.error("PeopleAI error:", error);

    return res.status(500).json({
      error:
        "No se pudo completar el análisis. Intenta nuevamente."
    });
  }
}
