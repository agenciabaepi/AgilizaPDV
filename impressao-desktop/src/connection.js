const PREFIX = "AGILIZA-";

/** Lê o código gerado no sistema em Configurações › Impressoras › Conectar computador. */
export function decodeConnectionCode(input) {
  const code = String(input ?? "").replace(/\s+/g, "");
  if (!code.startsWith(PREFIX)) {
    throw new Error("Código inválido. Copie o código completo gerado no sistema (começa com AGILIZA-).");
  }
  let data;
  try {
    data = JSON.parse(Buffer.from(code.slice(PREFIX.length), "base64url").toString("utf8"));
  } catch {
    throw new Error("Código incompleto ou corrompido. Copie novamente.");
  }
  const valid =
    data?.v === 1 &&
    typeof data.url === "string" &&
    /^https?:\/\//.test(data.url) &&
    typeof data.key === "string" &&
    typeof data.token === "string" &&
    data.token.startsWith("agl_");
  if (!valid) throw new Error("Código incompleto ou corrompido. Copie novamente.");
  return { url: data.url, key: data.key, token: data.token };
}
