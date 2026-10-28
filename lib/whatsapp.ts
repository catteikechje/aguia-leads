import type { Empresa } from "./types";

// O app só abre a conversa com o texto pronto. Quem revisa e aperta enviar é a pessoa,
// uma conversa de cada vez. Nada de envio automático ou em massa.

export const LIMITE_DIARIO = 20;

export function linkWhatsApp(telefone: string, texto: string) {
  return `https://wa.me/55${telefone.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const local = (e: Empresa) => e.cidade || "sua cidade";
const nota = (e: Empresa) => (e.nota ? e.nota.toFixed(1).replace(".", ",") : "");

export type Modelo = { nome: string; texto: (e: Empresa, eu: string) => string };

export const MODELOS: Modelo[] = [
  {
    nome: "Achei no Google",
    texto: (e, eu) =>
      `${saudacao()}, tudo bem? ${eu ? `Meu nome é ${eu}. ` : ""}Encontrei a ${e.nome} no Google aqui em ${local(e)} e vi que vocês ainda não têm site. Fiz um modelo de como poderia ficar o de vocês, posso te mandar pra dar uma olhada?`,
  },
  {
    nome: "Elogio às avaliações",
    texto: (e, eu) =>
      `Oi! ${eu ? `Aqui é ${eu}, trabalho` : "Trabalho"} com sites para comércios em ${local(e)}. ${e.avaliacoes ? `Vi as avaliações da ${e.nome} no Google${nota(e) ? `, nota ${nota(e)}` : ""}, parabéns pelo trabalho!` : `Conheci a ${e.nome} e gostei do trabalho de vocês.`} Senti falta só de um site com os serviços e o botão do WhatsApp. Faz sentido conversarmos sobre isso?`,
  },
  {
    nome: "Clientes da região",
    texto: (e, eu) =>
      `Olá, pessoal da ${e.nome}! ${eu ? `Sou ${eu}. ` : ""}Muita gente${e.bairro ? ` na região do ${e.bairro}` : ` em ${local(e)}`} procura ${e.tipo.toLowerCase()} pelo celular antes de sair de casa, e hoje vocês não aparecem com site. Montei uma proposta simples, sem compromisso. Quer ver?`,
  },
  {
    nome: "Curta e direta",
    texto: (e, eu) =>
      `${saudacao()}! ${eu ? `Meu nome é ${eu}, faço` : "Faço"} sites para negócios em ${local(e)}. Vi que a ${e.nome} ainda não tem um. Posso te mostrar um exemplo de como ficaria?`,
  },
];

// Contador do dia e lista de quem pediu para não ser contatado (ficam no navegador por enquanto).
const hoje = () => "aguia-wa-" + new Date().toISOString().slice(0, 10);

function ler<T>(k: string, padrao: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}
function gravar(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

export const registro = {
  contatadosHoje: () => ler<string[]>(hoje(), []),
  marcarContato(id: string) {
    const ids = registro.contatadosHoje();
    if (!ids.includes(id)) gravar(hoje(), [...ids, id]);
  },
  naoContatar: () => ler<string[]>("aguia-wa-nao-contatar", []),
  marcarNaoContatar(id: string) {
    gravar("aguia-wa-nao-contatar", [...registro.naoContatar(), id]);
  },
  meuNome: () => ler<string>("aguia-wa-nome", ""),
  salvarNome: (n: string) => gravar("aguia-wa-nome", n),
};
