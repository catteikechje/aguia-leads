export type Empresa = {
  id: string;
  nome: string;
  tipo: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefone: string; // formato nacional, ex.: (21) 99999-9999
  whatsapp: boolean; // celular brasileiro: quase sempre tem WhatsApp
  nota: number | null;
  avaliacoes: number;
  mapsUrl: string;
  redeSocial: string; // Instagram/Facebook que a empresa usa no lugar do site, se houver
};

export type RespostaBusca = {
  empresas: Empresa[];
  analisadas: number; // quantas a fonte devolveu antes de filtrar quem tem site
  consulta: string;
  fonte: "google" | "mapa"; // mapa = OpenStreetMap, usado quando não há chave do Google
};
