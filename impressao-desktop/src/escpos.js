import iconv from "iconv-lite";

const ESC = 0x1b;
const GS = 0x1d;

/** Tabelas de caracteres. `table` é o argumento do ESC t nas impressoras compatíveis com Epson (Elgin, Bematech em modo ESC/POS, Tanca, Daruma etc.). */
export const ENCODINGS = {
  cp860: { label: "PC860 (Português)", table: 3 },
  cp850: { label: "PC850 (Multilíngue)", table: 2 },
  ascii: { label: "Sem acentos", table: null },
};

export const PAPER_WIDTHS = {
  48: "80 mm (48 colunas)",
  42: "80 mm (42 colunas)",
  32: "58 mm (32 colunas)",
};

export const DEFAULT_PRINTER_SETTINGS = { device: "", columns: 48, encoding: "cp860", cut: true };

const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Montador simples de documento ESC/POS para térmicas de 58/80 mm. */
class Ticket {
  constructor({ columns = 48, encoding = "cp860" } = {}) {
    this.columns = Number(columns) || 48;
    this.encoding = ENCODINGS[encoding] ? encoding : "cp860";
    this.width = 1;
    this.chunks = [Buffer.from([ESC, 0x40])];
    const table = ENCODINGS[this.encoding].table;
    if (table !== null) this.chunks.push(Buffer.from([ESC, 0x74, table]));
  }

  raw(...bytes) {
    this.chunks.push(Buffer.from(bytes));
    return this;
  }

  encode(text) {
    const clean = String(text ?? "").replace(/[\r\t]/g, " ");
    if (this.encoding === "ascii") {
      return Buffer.from(stripAccents(clean).replace(/·/g, "-").replace(/[^\x20-\x7e\n]/g, "?"), "ascii");
    }
    return iconv.encode(clean.replace(/·/g, "-"), this.encoding);
  }

  get cols() {
    return Math.floor(this.columns / this.width);
  }

  align(where) {
    return this.raw(ESC, 0x61, { left: 0, center: 1, right: 2 }[where] ?? 0);
  }

  bold(on = true) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  /** Ampliação dos caracteres, 1–2 em cada direção. Largura 2 corta as colunas pela metade. */
  size(width = 1, height = 1) {
    this.width = width;
    return this.raw(GS, 0x21, ((width - 1) << 4) | (height - 1));
  }

  text(value = "") {
    for (const line of wrap(String(value), this.cols)) {
      this.chunks.push(this.encode(line), Buffer.from("\n"));
    }
    return this;
  }

  /** Texto à esquerda e valor alinhado à direita na mesma linha; texto longo quebra acima do valor. */
  row(left, right) {
    const r = String(right ?? "");
    const room = this.cols - r.length - 1;
    const lines = wrap(String(left ?? ""), Math.max(room, 1));
    const last = lines.pop() ?? "";
    lines.push(last.padEnd(this.cols - r.length) + r);
    for (const line of lines) this.chunks.push(this.encode(line), Buffer.from("\n"));
    return this;
  }

  divider(char = "-") {
    return this.text(String(char || "-").slice(0, 1).repeat(this.cols));
  }

  feed(lines = 1) {
    return this.raw(ESC, 0x64, Math.max(0, Math.min(10, Number(lines) || 0)));
  }

  /** QR Code nativo da impressora (GS ( k), usado na NFC-e. */
  qrcode(data, moduleSize = 5) {
    const bytes = Buffer.from(String(data ?? ""), "utf8");
    if (!bytes.length) return this;
    const size = Math.max(1, Math.min(16, Number(moduleSize) || 5));
    const len = bytes.length + 3;
    this.raw(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00); // modelo 2
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size); // tamanho do módulo
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31); // correção de erro M
    this.raw(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30);
    this.chunks.push(bytes);
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30); // imprime
    return this.raw(0x0a);
  }

  /** Pulso para abrir a gaveta de dinheiro ligada à impressora. */
  drawer() {
    return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa);
  }

  /** Avança o papel além da guilhotina e faz corte parcial. */
  cut() {
    return this.raw(GS, 0x56, 66, 3);
  }

  build() {
    return Buffer.concat(this.chunks);
  }
}

/** Quebra palavras na largura `width`, mantendo linhas que já cabem e o recuo do parágrafo. */
function wrap(text, width) {
  const out = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length <= width) {
      out.push(paragraph);
      continue;
    }
    const indent = paragraph.match(/^\s*/)[0].slice(0, Math.floor(width / 2));
    const room = width - indent.length;
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      if (!line) line = word;
      else if (line.length + 1 + word.length <= room) line += ` ${word}`;
      else {
        out.push(indent + line);
        line = word;
      }
      while (line.length > room) {
        out.push(indent + line.slice(0, room));
        line = line.slice(room);
      }
    }
    out.push(indent + line);
  }
  return out;
}

const ALIGN = { esquerda: "left", centro: "center", direita: "right", left: "left", center: "center", right: "right" };

/**
 * Documento montado pelo sistema como lista de blocos:
 *   { t: "texto", v, alinhar?: "esquerda"|"centro"|"direita", negrito?, largura?: 1|2, altura?: 1|2 }
 *   { t: "linha", esq, dir, negrito? }      texto à esquerda e valor à direita
 *   { t: "divisor", c?: "-" }
 *   { t: "pular", n?: 1 }
 *   { t: "qrcode", v, tamanho?: 1-16 }
 */
function renderBlocks(t, blocos) {
  for (const b of Array.isArray(blocos) ? blocos : []) {
    if (!b || typeof b !== "object") continue;
    switch (b.t) {
      case "texto": {
        const largura = b.largura === 2 ? 2 : 1;
        const altura = b.altura === 2 ? 2 : 1;
        t.align(ALIGN[b.alinhar] ?? "left");
        if (b.negrito) t.bold();
        if (largura !== 1 || altura !== 1) t.size(largura, altura);
        t.text(b.v ?? "");
        if (largura !== 1 || altura !== 1) t.size(1, 1);
        if (b.negrito) t.bold(false);
        t.align("left");
        break;
      }
      case "linha":
        if (b.negrito) t.bold();
        t.row(b.esq ?? "", b.dir ?? "");
        if (b.negrito) t.bold(false);
        break;
      case "divisor":
        t.divider(b.c ?? "-");
        break;
      case "pular":
        t.feed(b.n ?? 1);
        break;
      case "qrcode":
        t.align("center").qrcode(b.v, b.tamanho ?? 5).align("left");
        break;
      default:
        break;
    }
  }
}

function renderDocument(t, p) {
  renderBlocks(t, p.blocos);
}

function renderTest(t, p) {
  t.align("center").bold().size(2, 2).text("TESTE").size(1, 1).bold(false);
  t.text(p.empresa ?? "Agiliza Impressão");
  if (p.impressora) t.text(`Impressora: ${p.impressora}`);
  t.align("left").divider();
  if (p.enviado_por) t.text(`Enviado por: ${p.enviado_por}`);
  if (p.created_at) t.text(p.created_at);
  t.text("Acentos: ÁÉÍÓÚ ÂÊÔ ÃÕ Ç áéíóú âêô ãõ ç");
  t.text("1234567890".repeat(Math.ceil(t.cols / 10)).slice(0, t.cols));
  t.row("Valor alinhado à direita", "R$ 12,34");
  t.divider();
  t.align("center").qrcode("https://agilizapdv.app", 4);
  t.text("Se os acentos saíram errados, troque a").text("acentuação no Agiliza Impressão.").align("left");
  t.feed(1).align("center").text("Agiliza PDV · agilizapdv.app").align("left");
}

const RENDERERS = { documento: renderDocument, teste: renderTest };

/** Bytes ESC/POS de um documento do tipo "documento" | "teste". */
export function renderJob(kind, payload, settings) {
  const render = RENDERERS[kind];
  if (!render) throw new Error(`Tipo de impressão desconhecido: ${kind}`);
  const ticket = new Ticket(settings);
  const p = payload ?? {};
  if (p.abrir_gaveta) ticket.drawer();
  render(ticket, p);
  ticket.feed(4);
  if (settings?.cut !== false) ticket.cut();
  return ticket.build();
}
