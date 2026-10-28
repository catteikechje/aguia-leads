import type { Empresa } from "@/lib/types";

// Busca grátis e sem chave no OpenStreetMap (Overpass API).
// https://wiki.openstreetmap.org/wiki/Overpass_API
const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const AGENTE = "AguiaLeads/1.0 (aivio-ia.com.br)";
const NOMES_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};
const MAX_RESULTADOS = 300;

// Nicho -> filtros de tags do OpenStreetMap. Cada filtro vira uma linha `nwr[...]` da consulta.
const FILTROS: Record<string, string[]> = {
  hamburgueria: ['["cuisine"~"burger",i]', '["amenity"~"fast_food|restaurant"]["name"~"burger|hamb",i]'],
  pizzaria: ['["cuisine"~"pizza",i]', '["amenity"~"fast_food|restaurant"]["name"~"pizz",i]'],
  barbearia: ['["shop"="hairdresser"]["hairdresser"="barber"]', '["shop"="hairdresser"]["name"~"barb",i]'],
  "salao de beleza": ['["shop"="hairdresser"]', '["shop"="beauty"]'],
  "oficina mecanica": ['["shop"="car_repair"]', '["craft"="car_repair"]'],
  padaria: ['["shop"="bakery"]'],
  lanchonete: ['["amenity"="fast_food"]', '["amenity"="cafe"]["name"~"lanch",i]'],
  restaurante: ['["amenity"="restaurant"]'],
  acaiteria: ['["name"~"a[çc]a[ií]",i]["amenity"~"fast_food|cafe|ice_cream|restaurant"]', '["shop"]["name"~"a[çc]a[ií]",i]'],
  marmitaria: ['["name"~"marmit",i]'],
  doceria: ['["shop"~"confectionery|pastry"]', '["name"~"doce|confeit",i]["shop"]'],
  "studio de unhas": ['["shop"="beauty"]["beauty"~"nails"]', '["shop"="beauty"]["name"~"unha|nail",i]'],
  "clinica de estetica": ['["shop"="beauty"]', '["amenity"="clinic"]["name"~"est[eé]tica",i]'],
  "pet shop": ['["shop"="pet"]'],
  "banho e tosa": ['["shop"="pet_grooming"]', '["shop"="pet"]["name"~"tosa|banho",i]'],
  "lava jato": ['["amenity"="car_wash"]'],
  borracharia: ['["shop"="tyres"]', '["name"~"borrach",i]'],
  "auto eletrica": ['["shop"="car_repair"]["name"~"el[eé]tric",i]'],
  academia: ['["leisure"="fitness_centre"]'],
  "studio de pilates": ['["name"~"pilates",i]'],
  "clinica odontologica": ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  otica: ['["shop"="optician"]'],
  "material de construcao": ['["shop"~"hardware|doityourself|building_materials"]'],
  vidracaria: ['["craft"="glaziery"]', '["shop"="glaziery"]', '["name"~"vidra",i]'],
  serralheria: ['["craft"="metal_construction"]', '["name"~"serralh",i]'],
  chaveiro: ['["shop"="locksmith"]', '["craft"~"locksmith|key_cutter"]', '["name"~"chaveir",i]'],
  "assistencia tecnica de celular": ['["shop"="mobile_phone"]', '["craft"="electronics_repair"]'],
  "loja de roupas": ['["shop"="clothes"]'],
  floricultura: ['["shop"="florist"]'],
  imobiliaria: ['["office"="estate_agent"]'],
  contabilidade: ['["office"~"accountant|tax_advisor"]'],
  "escola de idiomas": ['["amenity"="language_school"]'],
  "buffet infantil": ['["name"~"buffet",i]'],
};

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function escaparRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");
}

function filtrosDoNicho(nicho: string) {
  const conhecido = FILTROS[semAcento(nicho)];
  if (conhecido) return conhecido;
  // Nicho livre: procura o texto no nome do estabelecimento.
  return [`["name"~"${escaparRegex(nicho)}",i]`];
}

// Caixa da cidade (sul, oeste, norte, leste) pelo Nominatim, o buscador de endereços do OpenStreetMap.
const caixas = new Map<string, string>();
async function caixaDaCidade(cidade: string, uf: string) {
  const chave = `${semAcento(cidade)}|${uf}`;
  const salva = caixas.get(chave);
  if (salva) return salva;
  const q = new URLSearchParams({
    city: cidade,
    state: NOMES_UF[uf] ?? uf,
    country: "Brasil",
    format: "json",
    limit: "1",
  });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
    headers: { "User-Agent": AGENTE, "Accept-Language": "pt-BR" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`Nominatim respondeu ${r.status}`);
  const [lugar] = (await r.json()) as { boundingbox?: string[] }[];
  if (!lugar?.boundingbox) return null;
  const [sul, norte, oeste, leste] = lugar.boundingbox;
  const caixa = `${sul},${oeste},${norte},${leste}`;
  caixas.set(chave, caixa);
  return caixa;
}

function montarConsulta(nicho: string, caixa: string) {
  const linhas = filtrosDoNicho(nicho).map((f) => `  nwr${f}(${caixa});`).join("\n");
  return `[out:json][timeout:25];
(
${linhas}
);
out center tags ${MAX_RESULTADOS};`;
}

type Elemento = { type: string; id: number; tags?: Record<string, string> };

// Quem só tem Instagram, Facebook ou link do WhatsApp no lugar do site também é cliente.
const SO_REDE_SOCIAL = /(instagram\.com|facebook\.com|fb\.com|linktr\.ee|wa\.me|whatsapp\.com|tiktok\.com|ifood\.com\.br)/i;

function ehCelular(telefone: string) {
  const d = telefone.replace(/\D/g, "");
  return d.length === 11 && d[2] === "9";
}

// "+55 81 99999-8888" -> "(81) 99999-8888". Pega só o primeiro número quando há vários.
function telefoneNacional(bruto: string) {
  let d = bruto.split(/[;,/]/)[0].replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return "";
}

function paraEmpresa(el: Elemento, nicho: string, cidade: string, uf: string): Empresa | null {
  const t = el.tags ?? {};
  if (!t.name || t.disused === "yes" || t["disused:shop"] || t["abandoned:shop"]) return null;
  const site = t.website || t["contact:website"] || t.url || "";
  const rede = t["contact:instagram"] || t["contact:facebook"] || (SO_REDE_SOCIAL.test(site) ? site : "");
  if (site && !SO_REDE_SOCIAL.test(site)) return null;

  const fones = [t["contact:whatsapp"], t["contact:mobile"], t.mobile, t.phone, t["contact:phone"]]
    .filter(Boolean)
    .map((f) => telefoneNacional(f!))
    .filter(Boolean);
  const telefone = fones.find(ehCelular) ?? fones[0] ?? "";

  const rua = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  const bairro = t["addr:suburb"] || t["addr:neighbourhood"] || "";
  const cidadeEmp = t["addr:city"] || cidade;
  const endereco = [rua, bairro, `${cidadeEmp}/${uf}`].filter(Boolean).join(" · ");
  const busca = encodeURIComponent(`${t.name} ${rua} ${cidadeEmp} ${uf}`);

  return {
    id: `osm-${el.type}-${el.id}`,
    nome: t.name,
    tipo: nicho,
    endereco,
    bairro,
    cidade: cidadeEmp,
    uf,
    telefone,
    whatsapp: ehCelular(telefone),
    nota: null,
    avaliacoes: 0,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${busca}`,
    redeSocial: rede,
  };
}

export async function buscarNoOsm(nicho: string, cidade: string, uf: string) {
  const caixa = await caixaDaCidade(cidade, uf);
  if (!caixa) return { empresas: [], analisadas: 0, cidadeEncontrada: false };
  const consulta = montarConsulta(nicho, caixa);

  // Os servidores públicos do Overpass às vezes ficam lotados: pergunta a todos e usa o primeiro que responder.
  const controle = new AbortController();
  const tentativas = SERVIDORES.map(async (url) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": AGENTE },
      body: "data=" + encodeURIComponent(consulta),
      cache: "no-store",
      signal: AbortSignal.any([controle.signal, AbortSignal.timeout(30_000)]),
    });
    if (!r.ok) throw new Error(`${url} respondeu ${r.status}`);
    const dados = (await r.json()) as { elements?: Elemento[]; remark?: string };
    if (!dados.elements) throw new Error(`${url}: ${dados.remark ?? "resposta sem dados"}`);
    return dados.elements;
  });
  let elementos: Elemento[];
  try {
    elementos = await Promise.any(tentativas);
  } catch (err) {
    const motivos = err instanceof AggregateError ? err.errors.map(String).join(" | ") : String(err);
    throw new Error(motivos || "Mapa indisponível");
  } finally {
    controle.abort();
  }

  const vistos = new Set<string>();
  const empresas = elementos
    .map((el) => paraEmpresa(el, nicho, cidade, uf))
    .filter((e): e is Empresa => {
      if (!e) return false;
      const chave = semAcento(e.nome) + "|" + e.telefone;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
  return { empresas, analisadas: elementos.length, cidadeEncontrada: true };
}
