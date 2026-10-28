import type { Empresa } from "@/lib/types";

// Busca grátis e sem chave no OpenStreetMap (Overpass API).
// https://wiki.openstreetmap.org/wiki/Overpass_API
const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
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

function montarConsulta(nicho: string, cidade: string, uf: string) {
  const linhas = filtrosDoNicho(nicho).map((f) => `  nwr${f}(area.c);`).join("\n");
  return `[out:json][timeout:40];
area["ISO3166-2"="BR-${uf}"]->.uf;
area["boundary"="administrative"]["admin_level"="8"]["name"~"^${escaparRegex(cidade)}$",i](area.uf)->.c;
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
  const consulta = montarConsulta(nicho, cidade, uf);
  let ultimoErro = "";
  for (const url of SERVIDORES) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "AguiaLeads/1.0 (busca de empresas sem site)",
        },
        body: "data=" + encodeURIComponent(consulta),
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      });
      if (!r.ok) {
        ultimoErro = `${url} respondeu ${r.status}`;
        continue;
      }
      const dados = (await r.json()) as { elements?: Elemento[] };
      const elementos = dados.elements ?? [];
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
      return { empresas, analisadas: elementos.length };
    } catch (err) {
      ultimoErro = `${url}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  throw new Error(ultimoErro || "Mapa indisponível");
}
