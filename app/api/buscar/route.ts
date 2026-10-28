import { NextResponse } from "next/server";
import type { Empresa, RespostaBusca } from "@/lib/types";
import { buscarNoOsm } from "@/lib/osm";

export const maxDuration = 60;

// Google Places API (New) - Text Search.
// https://developers.google.com/maps/documentation/places/web-service/text-search
const URL_PLACES = "https://places.googleapis.com/v1/places:searchText";
const CAMPOS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "nextPageToken",
].join(",");
const MAX_PAGINAS = 3; // até 60 empresas por busca; cada página é cobrada pelo Google
const CACHE_MS = 6 * 60 * 60 * 1000;

type Componente = { longText: string; shortText: string; types: string[] };
type Place = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: Componente[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text: string };
  businessStatus?: string;
};

// Cache em memória para não pagar duas vezes pela mesma busca em sequência.
const cache = new Map<string, { em: number; dados: RespostaBusca }>();

function componente(p: Place, tipo: string, curto = false) {
  const c = p.addressComponents?.find((x) => x.types.includes(tipo));
  return c ? (curto ? c.shortText : c.longText) : "";
}

// Quem só tem Instagram, Facebook ou link do WhatsApp no lugar do site também é cliente.
const SO_REDE_SOCIAL = /(instagram\.com|facebook\.com|fb\.com|linktr\.ee|wa\.me|whatsapp\.com|tiktok\.com|ifood\.com\.br)/i;
function semSiteProprio(p: Place) {
  return !p.websiteUri || SO_REDE_SOCIAL.test(p.websiteUri);
}

// Celular brasileiro: DDD + 9 dígitos começando com 9.
function ehCelular(telefone: string) {
  const d = telefone.replace(/\D/g, "");
  return d.length === 11 && d[2] === "9";
}

function paraEmpresa(p: Place, tipoBuscado: string): Empresa {
  const telefone = p.nationalPhoneNumber ?? "";
  return {
    id: p.id,
    nome: p.displayName?.text ?? "Sem nome",
    tipo: p.primaryTypeDisplayName?.text ?? tipoBuscado,
    endereco: p.formattedAddress ?? "",
    bairro: componente(p, "sublocality_level_1") || componente(p, "sublocality"),
    cidade: componente(p, "administrative_area_level_2") || componente(p, "locality"),
    uf: componente(p, "administrative_area_level_1", true),
    telefone,
    whatsapp: ehCelular(telefone),
    nota: p.rating ?? null,
    avaliacoes: p.userRatingCount ?? 0,
    mapsUrl: p.googleMapsUri ?? "",
    redeSocial: p.websiteUri ?? "",
  };
}

// GET /api/buscar?nicho=Barbearia&cidade=Recife&uf=PE (só no mapa grátis; o Google exige POST com senha).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const nicho = (q.get("nicho") ?? "").trim().slice(0, 80);
  const cidade = (q.get("cidade") ?? "").trim().slice(0, 80);
  const uf = (q.get("uf") ?? "").trim().slice(0, 2).toUpperCase();
  if (!nicho || !cidade || !uf) {
    return NextResponse.json({ erro: "Informe nicho, cidade e estado." }, { status: 400 });
  }
  return buscarMapaLivre(nicho, cidade, uf);
}

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => ({}))) as {
    nicho?: string;
    cidade?: string;
    uf?: string;
  };
  const nicho = (corpo.nicho ?? "").trim().slice(0, 80);
  const cidade = (corpo.cidade ?? "").trim().slice(0, 80);
  const uf = (corpo.uf ?? "").trim().slice(0, 2).toUpperCase();
  if (!nicho || !cidade || !uf) {
    return NextResponse.json({ erro: "Informe nicho, cidade e estado." }, { status: 400 });
  }

  // Sem chave do Google, busca no OpenStreetMap (grátis, sem senha).
  const chave = process.env.GOOGLE_PLACES_API_KEY;
  if (!chave) return buscarMapaLivre(nicho, cidade, uf);

  // A senha só protege a cota paga do Google.
  const senha = process.env.APP_SENHA;
  if (senha && req.headers.get("x-senha") !== senha) {
    return NextResponse.json({ erro: "Senha incorreta." }, { status: 401 });
  }

  const consulta = `${nicho} em ${cidade}, ${uf}, Brasil`;
  const chaveCache = consulta.toLowerCase();
  const emCache = cache.get(chaveCache);
  if (emCache && Date.now() - emCache.em < CACHE_MS) {
    return NextResponse.json(emCache.dados);
  }

  const places: Place[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const r = await fetch(URL_PLACES, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": chave,
        "X-Goog-FieldMask": CAMPOS,
      },
      body: JSON.stringify({
        textQuery: consulta,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 20,
        ...(pageToken ? { pageToken } : {}),
      }),
      cache: "no-store",
    });
    if (!r.ok) {
      const detalhe = await r.text();
      console.error("Erro do Google Places", r.status, detalhe);
      if (places.length) break;
      return NextResponse.json(
        { erro: `O Google recusou a busca (${r.status}). Confira a chave e se a Places API (New) está ativada.` },
        { status: 502 },
      );
    }
    const dados = (await r.json()) as { places?: Place[]; nextPageToken?: string };
    places.push(...(dados.places ?? []));
    pageToken = dados.nextPageToken;
    if (!pageToken) break;
  }

  // Entra no radar quem está funcionando, tem telefone e não tem site próprio no Google.
  const empresas = places
    .filter((p) => semSiteProprio(p) && p.nationalPhoneNumber && p.businessStatus !== "CLOSED_PERMANENTLY")
    .map((p) => paraEmpresa(p, nicho))
    .sort((a, b) => Number(b.whatsapp) - Number(a.whatsapp) || b.avaliacoes - a.avaliacoes);

  const resposta: RespostaBusca = { empresas, analisadas: places.length, consulta, fonte: "google" };
  cache.set(chaveCache, { em: Date.now(), dados: resposta });
  return NextResponse.json(resposta);
}

async function buscarMapaLivre(nicho: string, cidade: string, uf: string) {
  const consulta = `${nicho} em ${cidade}, ${uf}`;
  const chaveCache = "osm:" + consulta.toLowerCase();
  const emCache = cache.get(chaveCache);
  if (emCache && Date.now() - emCache.em < CACHE_MS) {
    return NextResponse.json(emCache.dados);
  }
  try {
    const { empresas, analisadas, cidadeEncontrada } = await buscarNoOsm(nicho, cidade, uf);
    if (!cidadeEncontrada) {
      return NextResponse.json({ erro: `Não achei a cidade "${cidade}" em ${uf}. Confira o nome.` }, { status: 404 });
    }
    // Primeiro quem tem celular (WhatsApp), depois quem tem telefone, depois o resto.
    empresas.sort((a, b) => Number(b.whatsapp) - Number(a.whatsapp) || Number(!!b.telefone) - Number(!!a.telefone));
    const resposta: RespostaBusca = { empresas, analisadas, consulta, fonte: "mapa" };
    cache.set(chaveCache, { em: Date.now(), dados: resposta });
    return NextResponse.json(resposta);
  } catch (err) {
    console.error("Erro no OpenStreetMap", err);
    return NextResponse.json(
      { erro: "O mapa está ocupado agora. Tente de novo em alguns segundos." },
      { status: 502 },
    );
  }
}
